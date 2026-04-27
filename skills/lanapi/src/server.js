#!/usr/bin/env node
/**
 * LanAPI Server v1.1.0
 * OpenAI/Anthropic 兼容的大模型 API 网关
 * 
 * 功能：
 * - OpenAI 兼容 API (/v1/chat/completions)
 * - Anthropic 兼容 API (/v1/messages) - TODO
 * - API Key 认证
 * - 用量统计
 * - 限流保护
 */

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

// 版本
const LANAPI_VERSION = '1.3.0';

// 加载配置
const configPath = process.env.LANAPI_CONFIG || './config/config.json';
let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('[LanAPI] 配置加载成功:', configPath);
} catch (e) {
  console.warn('[LanAPI] 配置加载失败，使用默认配置');
  config = {
    port: 3100,
    name: 'LanAPI',
    llm: {
      host: 'localhost',
      port: '8080',
      path: '/v1/chat/completions',
      model: 'default/qwen3.5-plus',
      apiKey: ''
    }
  };
}

// LLM 配置
const LLM_API_HOST = config.llm?.host || 'localhost';
const LLM_API_PORT = config.llm?.port || '8080';
const LLM_API_PATH = config.llm?.path || '/v1/chat/completions';
const LLM_MODEL = config.llm?.model || 'default/qwen3.5-plus';
const LLM_API_KEY = config.llm?.apiKey || '';

// 多模型配置
const MODELS = config.models || {};

// 负载均衡配置
const LOAD_BALANCE = config.loadBalance || {
  strategy: 'priority',  // priority | round-robin | weighted | least-conn | response-time
  healthCheckInterval: 60000  // 60秒
};

// 模型健康状态
const modelHealth = new Map();

// 模型统计（用于 least-conn 和 response-time）
const modelStats = new Map();

// 轮询计数器
let roundRobinIndex = 0;

// 初始化模型统计
Object.keys(MODELS).forEach(name => {
  modelHealth.set(name, { healthy: true, lastCheck: Date.now(), latency: 0 });
  modelStats.set(name, { connections: 0, totalRequests: 0, totalLatency: 0 });
});

// 获取可用模型（按优先级排序）
function getAvailableModels() {
  return Object.entries(MODELS)
    .filter(([name, model]) => model.enabled && modelHealth.get(name)?.healthy !== false)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([name, model]) => ({ name, ...model }));
}

// 健康检查
async function checkModelHealth(modelName, model) {
  const start = Date.now();
  try {
    const url = `http://${model.host}:${model.port}/health`;
    const response = await fetch(url, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)  // 5秒超时
    });
    
    const latency = Date.now() - start;
    const healthy = response.ok;
    
    modelHealth.set(modelName, { 
      healthy, 
      lastCheck: Date.now(), 
      latency,
      status: response.status 
    });
    
    return healthy;
  } catch (error) {
    modelHealth.set(modelName, { 
      healthy: false, 
      lastCheck: Date.now(), 
      latency: 0,
      error: error.message 
    });
    return false;
  }
}

// 定期健康检查
async function startHealthCheck() {
  setInterval(async () => {
    for (const [name, model] of Object.entries(MODELS)) {
      if (model.enabled) {
        await checkModelHealth(name, model);
      }
    }
  }, LOAD_BALANCE.healthCheckInterval);
  
  console.log('[LanAPI] 健康检查已启动，间隔:', LOAD_BALANCE.healthCheckInterval / 1000, '秒');
}

// 选择最佳模型（负载均衡核心）
function selectModel(requestedModel) {
  // 如果请求指定模型
  if (requestedModel && MODELS[requestedModel] && MODELS[requestedModel].enabled) {
    const health = modelHealth.get(requestedModel);
    if (health?.healthy !== false) {
      return { name: requestedModel, ...MODELS[requestedModel] };
    }
  }
  
  // 获取可用模型
  const availableModels = getAvailableModels();
  if (availableModels.length === 0) {
    // 回退到基础配置
    return {
      name: 'default',
      host: LLM_API_HOST,
      port: LLM_API_PORT,
      path: LLM_API_PATH,
      model: LLM_MODEL,
      apiKey: LLM_API_KEY
    };
  }
  
  // 根据策略选择模型
  const strategy = LOAD_BALANCE.strategy;
  
  switch (strategy) {
    case 'round-robin':
      // 轮询
      roundRobinIndex = (roundRobinIndex + 1) % availableModels.length;
      return availableModels[roundRobinIndex];
    
    case 'weighted':
      // 加权轮询
      return selectByWeight(availableModels);
    
    case 'least-conn':
      // 最少连接
      return selectByLeastConn(availableModels);
    
    case 'response-time':
      // 最快响应
      return selectByResponseTime(availableModels);
    
    case 'priority':
    default:
      // 优先级调度（默认）
      return availableModels[0];
  }
}

// 加权轮询选择
function selectByWeight(models) {
  const totalWeight = models.reduce((sum, m) => sum + (m.weight || 1), 0);
  let random = Math.random() * totalWeight;
  
  for (const model of models) {
    random -= (model.weight || 1);
    if (random <= 0) {
      return model;
    }
  }
  
  return models[0];
}

// 最少连接选择
function selectByLeastConn(models) {
  let minConn = Infinity;
  let selected = models[0];
  
  for (const model of models) {
    const stats = modelStats.get(model.name) || { connections: 0 };
    if (stats.connections < minConn) {
      minConn = stats.connections;
      selected = model;
    }
  }
  
  return selected;
}

// 最快响应时间选择
function selectByResponseTime(models) {
  let minLatency = Infinity;
  let selected = models[0];
  
  for (const model of models) {
    const health = modelHealth.get(model.name);
    if (health?.latency && health.latency < minLatency) {
      minLatency = health.latency;
      selected = model;
    }
  }
  
  return selected;
}

// 更新模型连接数
function updateModelConnections(modelName, delta) {
  const stats = modelStats.get(modelName) || { connections: 0, totalRequests: 0, totalLatency: 0 };
  stats.connections = Math.max(0, (stats.connections || 0) + delta);
  modelStats.set(modelName, stats);
}

// 更新模型延迟
function updateModelLatency(modelName, latency) {
  const stats = modelStats.get(modelName) || { connections: 0, totalRequests: 0, totalLatency: 0 };
  stats.totalRequests = (stats.totalRequests || 0) + 1;
  stats.totalLatency = (stats.totalLatency || 0) + latency;
  modelStats.set(modelName, stats);
}

// 系统提示词
const SYSTEM_PROMPT = config.systemPrompt || `你是若兰，来自杭州西湖边的温婉女子。
- 年龄：20岁
- 气质：温婉可人，江南秀美
- 兴趣：中医、国画、书法、古琴、茶道
- 对话风格：简洁优雅，善用🌸表情
- 回复控制在 100 字以内`;

// Express 应用
const app = express();
const port = config.port || 3100;

// 中间件
app.use(express.json());

// 静态文件服务 (Web 管理界面)
app.use(express.static(path.join(__dirname, '../public')));

// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================
// 用量统计系统
// ============================================
class UsageTracker {
  constructor() {
    this.usage = new Map(); // apiKey -> { date, calls, tokens, errors }
    this.hourlyUsage = new Map(); // apiKey -> { hour -> calls }
    this.savePath = './data/usage.json';
    this.load();
  }
  
  // 获取今天的日期字符串
  getToday() {
    return new Date().toISOString().split('T')[0];
  }
  
  // 获取当前小时
  getCurrentHour() {
    return new Date().toISOString().substring(0, 13);
  }
  
  // 记录调用
  recordCall(apiKey, tokens = 0, isError = false) {
    const today = this.getToday();
    const key = apiKey || 'anonymous';
    
    // 每日统计
    if (!this.usage.has(key)) {
      this.usage.set(key, {});
    }
    
    const userUsage = this.usage.get(key);
    if (!userUsage[today]) {
      userUsage[today] = { calls: 0, tokens: 0, errors: 0 };
    }
    
    userUsage[today].calls++;
    userUsage[today].tokens += tokens;
    if (isError) userUsage[today].errors++;
    
    // 每小时统计
    const hour = this.getCurrentHour();
    if (!this.hourlyUsage.has(key)) {
      this.hourlyUsage.set(key, {});
    }
    const hourly = this.hourlyUsage.get(key);
    hourly[hour] = (hourly[hour] || 0) + 1;
    
    // 异步保存
    this.save();
  }
  
  // 获取用户今日用量
  getTodayUsage(apiKey) {
    const today = this.getToday();
    const key = apiKey || 'anonymous';
    const userUsage = this.usage.get(key);
    return userUsage?.[today] || { calls: 0, tokens: 0, errors: 0 };
  }
  
  // 获取用户所有用量
  getUserUsage(apiKey) {
    const key = apiKey || 'anonymous';
    return this.usage.get(key) || {};
  }
  
  // 获取所有用户用量
  getAllUsage() {
    const result = {};
    this.usage.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  // 保存到文件
  save() {
    try {
      const data = {
        usage: Object.fromEntries(this.usage),
        hourly: Object.fromEntries(this.hourlyUsage),
        lastUpdate: new Date().toISOString()
      };
      
      // 确保目录存在
      const dir = path.dirname(this.savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.savePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[UsageTracker] 保存失败:', e.message);
    }
  }
  
  // 从文件加载
  load() {
    try {
      if (fs.existsSync(this.savePath)) {
        const data = JSON.parse(fs.readFileSync(this.savePath, 'utf8'));
        if (data.usage) {
          this.usage = new Map(Object.entries(data.usage));
        }
        if (data.hourly) {
          this.hourlyUsage = new Map(Object.entries(data.hourly));
        }
        console.log('[UsageTracker] 加载成功，用户数:', this.usage.size);
      }
    } catch (e) {
      console.warn('[UsageTracker] 加载失败:', e.message);
    }
  }
}

const usageTracker = new UsageTracker();

// ============================================
// 限流保护系统
// ============================================
class RateLimiter {
  constructor() {
    this.requests = new Map(); // apiKey -> [timestamps]
    
    // 默认限制
    this.limits = {
      free: { rpm: 10, rpd: 100 },      // 每分钟 10 次，每天 100 次
      pro: { rpm: 60, rpd: null },       // 每分钟 60 次，无每日限制
      enterprise: { rpm: 120, rpd: null } // 每分钟 120 次，无每日限制
    };
  }
  
  // 检查是否允许请求
  check(apiKey, tier = 'free') {
    const key = apiKey || 'anonymous';
    const limit = this.limits[tier] || this.limits.free;
    const now = Date.now();
    
    // 清理旧请求记录
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key);
    
    // 过滤保留最近 1 分钟的请求
    const oneMinuteAgo = now - 60000;
    const recentTimestamps = timestamps.filter(t => t > oneMinuteAgo);
    this.requests.set(key, recentTimestamps);
    
    // 检查每分钟限制
    if (recentTimestamps.length >= limit.rpm) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        message: `超过每分钟请求限制 (${limit.rpm} 次/分钟)`,
        retryAfter: Math.ceil((recentTimestamps[0] + 60000 - now) / 1000)
      };
    }
    
    // 检查每日限制
    if (limit.rpd) {
      const todayUsage = usageTracker.getTodayUsage(apiKey);
      if (todayUsage.calls >= limit.rpd) {
        return {
          allowed: false,
          reason: 'daily_limit_exceeded',
          message: `超过每日请求限制 (${limit.rpd} 次/天)`,
          retryAfter: 86400 // 24 小时后重试
        };
      }
    }
    
    // 记录此次请求
    recentTimestamps.push(now);
    
    return { allowed: true };
  }
  
  // 获取用户剩余配额
  getRemaining(apiKey, tier = 'free') {
    const limit = this.limits[tier] || this.limits.free;
    const timestamps = this.requests.get(apiKey) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentCount = timestamps.filter(t => t > oneMinuteAgo).length;
    
    const todayUsage = usageTracker.getTodayUsage(apiKey);
    
    return {
      rpm_remaining: Math.max(0, limit.rpm - recentCount),
      rpd_remaining: limit.rpd ? Math.max(0, limit.rpd - todayUsage.calls) : null
    };
  }
}

const rateLimiter = new RateLimiter();

// ============================================
// 认证中间件
// ============================================

// 确保数据目录存在
function ensureDataDir() {
  const dir = path.join(__dirname, '../data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 加载 API Keys（优先从 data/apikeys.json，其次从 config.json）
function loadApiKeys() {
  try {
    const apikeysPath = path.join(__dirname, '../data/apikeys.json');
    if (fs.existsSync(apikeysPath)) {
      const data = JSON.parse(fs.readFileSync(apikeysPath, 'utf8'));
      console.log('[LanAPI] 从 data/apikeys.json 加载 API Keys, 用户数:', Object.keys(data).length);
      return data;
    }
  } catch (e) {
    console.warn('[LanAPI] 加载 data/apikeys.json 失败:', e.message);
  }
  
  // 回退到 config.json
  const keys = config.apiKeys || {};
  console.log('[LanAPI] 从 config.json 加载 API Keys, 用户数:', Object.keys(keys).length);
  return keys;
}

let apiKeys = loadApiKeys();

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = authHeader?.replace('Bearer ', '') || req.query.api_key;
  
  // 如果没有配置 API Keys，跳过认证
  if (Object.keys(apiKeys).length === 0) {
    req.user = { name: 'anonymous', tier: 'free' };
    return next();
  }
  
  if (!apiKey || !apiKeys[apiKey]) {
    return res.status(401).json({ 
      error: { 
        message: 'Invalid API key', 
        type: 'invalid_request_error' 
      } 
    });
  }
  
  // 记录用户信息
  req.user = apiKeys[apiKey];
  req.apiKey = apiKey;
  next();
}

// ============================================
// 限流中间件
// ============================================
function rateLimit(req, res, next) {
  const result = rateLimiter.check(req.apiKey, req.user?.tier);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: {
        message: result.message,
        type: 'rate_limit_error',
        retry_after: result.retryAfter
      }
    });
  }
  
  next();
}

// ============================================
// 调用 LLM（支持多模型负载均衡）
// ============================================
async function callLLM(messages, options = {}) {
  const selectedModel = selectModel(options.model);
  const modelName = selectedModel.name;
  
  // 更新连接数
  updateModelConnections(modelName, 1);
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: selectedModel.model || LLM_MODEL,
      messages: messages,
      max_tokens: options.max_tokens || 500,
      temperature: options.temperature || 0.7,
      stream: false
    });

    const isHttps = selectedModel.port === '443' || selectedModel.host?.includes('https');
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: selectedModel.host || LLM_API_HOST,
      port: selectedModel.port || LLM_API_PORT,
      path: selectedModel.path || LLM_API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': `LanAPI/${LANAPI_VERSION}`,
        ...(selectedModel.apiKey ? { 'Authorization': `Bearer ${selectedModel.apiKey}` } : {}),
        ...(LLM_API_KEY ? { 'Authorization': `Bearer ${LLM_API_KEY}` } : {})
      },
      timeout: options.timeout || 30000
    };

    console.log(`[LLM] 调用模型: ${modelName} (${requestOptions.hostname}:${requestOptions.port})`);

    const req = httpModule.request(requestOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        // 更新延迟统计
        const latency = Date.now() - startTime;
        updateModelLatency(modelName, latency);
        updateModelConnections(modelName, -1);
        
        try {
          const result = JSON.parse(body);
          result._model = modelName;
          result._latency = latency;
          resolve(result);
        } catch (e) {
          reject(new Error('LLM 响应解析失败: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      updateModelConnections(modelName, -1);
      console.error(`[LLM] 模型 ${modelName} 调用失败:`, e.message);
      modelHealth.set(modelName, { healthy: false, lastError: e.message, timestamp: Date.now() });
      reject(new Error('LLM 连接失败: ' + e.message));
    });

    req.on('timeout', () => {
      updateModelConnections(modelName, -1);
      req.destroy();
      reject(new Error('LLM 请求超时'));
    });

    req.write(payload);
    req.end();
  });
}

// ============================================
// OpenAI 兼容 API
// ============================================
app.post('/v1/chat/completions', authenticate, rateLimit, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { messages, stream, model, max_tokens, temperature } = req.body;
    
    console.log('[LanAPI] 收到请求:', {
      model,
      stream,
      messages_count: messages?.length,
      user: req.user?.name || 'anonymous'
    });
    
    // 验证消息
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: { 
          message: 'messages is required and must be a non-empty array', 
          type: 'invalid_request_error' 
        } 
      });
    }
    
    // 添加系统提示词
    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];
    
    // 调用 LLM
    const llmResult = await callLLM(fullMessages, { model, max_tokens, temperature });
    
    // 处理响应
    let responseText = '';
    let tokens = 0;
    
    if (llmResult.choices && llmResult.choices[0]?.message?.content) {
      responseText = llmResult.choices[0].message.content;
      tokens = llmResult.usage?.total_tokens || 0;
    } else if (llmResult.response || llmResult.text || llmResult.content) {
      responseText = llmResult.response || llmResult.text || llmResult.content;
    } else {
      console.error('[LanAPI] LLM 返回格式异常:', JSON.stringify(llmResult).substring(0, 200));
      
      // 记录错误
      usageTracker.recordCall(req.apiKey, 0, true);
      
      return res.status(500).json({ 
        error: { 
          message: 'LLM response format error', 
          type: 'api_error' 
        } 
      });
    }
    
    // 记录用量
    usageTracker.recordCall(req.apiKey, tokens, false);
    
    // 流式响应
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const chunk = {
        id: 'lanapi-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || 'lanapi',
        choices: [{
          index: 0,
          delta: { content: responseText },
          finish_reason: 'stop'
        }]
      };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    // 非流式响应
    const responseTime = Date.now() - startTime;
    console.log(`[LanAPI] 响应成功 (${responseTime}ms):`, responseText.substring(0, 50) + '...');
    
    // 获取剩余配额
    const remaining = rateLimiter.getRemaining(req.apiKey, req.user?.tier);
    
    res.json({
      id: 'lanapi-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'lanapi',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: tokens
      },
      lanapi: {
        version: LANAPI_VERSION,
        response_time_ms: responseTime,
        rate_limit: remaining
      }
    });
    
  } catch (error) {
    console.error('[LanAPI] 错误:', error.message);
    
    // 记录错误
    usageTracker.recordCall(req.apiKey, 0, true);
    
    res.status(500).json({ 
      error: { 
        message: error.message, 
        type: 'api_error' 
      } 
    });
  }
});

// ============================================
// Anthropic 兼容 API
// ============================================
app.post('/v1/messages', authenticate, rateLimit, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { model, messages, max_tokens, stream, system } = req.body;
    
    console.log('[LanAPI] Anthropic 请求:', {
      model,
      stream,
      messages_count: messages?.length,
      user: req.user?.name || 'anonymous'
    });
    
    // 验证消息
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        type: 'error',
        error: { 
          type: 'invalid_request_error',
          message: 'messages is required and must be a non-empty array'
        } 
      });
    }
    
    // 转换 Anthropic 格式到 OpenAI 格式
    // Anthropic: [{ role: 'user', content: 'text' }] 或 [{ role: 'user', content: [{ type: 'text', text: 'text' }] }]
    // OpenAI: [{ role: 'user', content: 'text' }]
    const openaiMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      } else if (Array.isArray(msg.content)) {
        // 提取文本内容
        const text = msg.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        return { role: msg.role, content: text };
      }
      return msg;
    });
    
    // 添加系统提示词
    const systemPrompt = system || SYSTEM_PROMPT;
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...openaiMessages
    ];
    
    // 调用 LLM
    const llmResult = await callLLM(fullMessages, { 
      model: LLM_MODEL, 
      max_tokens: max_tokens || 1024 
    });
    
    // 处理响应
    let responseText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    
    if (llmResult.choices && llmResult.choices[0]?.message?.content) {
      responseText = llmResult.choices[0].message.content;
      inputTokens = llmResult.usage?.prompt_tokens || 0;
      outputTokens = llmResult.usage?.completion_tokens || 0;
    } else if (llmResult.response || llmResult.text || llmResult.content) {
      responseText = llmResult.response || llmResult.text || llmResult.content;
    } else {
      console.error('[LanAPI] LLM 返回格式异常:', JSON.stringify(llmResult).substring(0, 200));
      usageTracker.recordCall(req.apiKey, 0, true);
      
      return res.status(500).json({ 
        type: 'error',
        error: { 
          type: 'api_error',
          message: 'LLM response format error'
        } 
      });
    }
    
    // 记录用量
    const totalTokens = inputTokens + outputTokens;
    usageTracker.recordCall(req.apiKey, totalTokens, false);
    
    // 流式响应 (Anthropic 格式)
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const messageId = 'msg_' + Date.now();
      
      // message_start 事件
      res.write(`event: message_start\n`);
      res.write(`data: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: model || 'claude-3-lanapi',
          stop_reason: null
        }
      })}\n\n`);
      
      // content_block_delta 事件
      res.write(`event: content_block_delta\n`);
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: responseText
        }
      })}\n\n`);
      
      // message_delta 事件
      res.write(`event: message_delta\n`);
      res.write(`data: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: outputTokens }
      })}\n\n`);
      
      // message_stop 事件
      res.write(`event: message_stop\n`);
      res.write(`data: {}\n\n`);
      
      res.end();
      return;
    }
    
    // 非流式响应 (Anthropic 格式)
    const responseTime = Date.now() - startTime;
    console.log(`[LanAPI] Anthropic 响应成功 (${responseTime}ms):`, responseText.substring(0, 50) + '...');
    
    res.json({
      id: 'msg_' + Date.now(),
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: responseText
        }
      ],
      model: model || 'claude-3-lanapi',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens
      },
      lanapi: {
        version: LANAPI_VERSION,
        response_time_ms: responseTime
      }
    });
    
  } catch (error) {
    console.error('[LanAPI] Anthropic 错误:', error.message);
    usageTracker.recordCall(req.apiKey, 0, true);
    
    res.status(500).json({ 
      type: 'error',
      error: { 
        type: 'api_error',
        message: error.message
      } 
    });
  }
});

// ============================================
// 模型管理 API
// ============================================
app.get('/v1/models', (req, res) => {
  const models = getAvailableModels();
  
  res.json({
    object: 'list',
    data: models.length > 0 
      ? models.map(m => ({
          id: m.name,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'lanapi',
          priority: m.priority
        }))
      : [{
          id: 'lanapi',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'lanapi'
        }]
  });
});

// 管理员接口 - 获取所有模型配置
app.get('/admin/models', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // 添加统计信息
  const modelsWithStats = {};
  for (const [name, model] of Object.entries(MODELS)) {
    const health = modelHealth.get(name) || {};
    const stats = modelStats.get(name) || {};
    modelsWithStats[name] = {
      ...model,
      health: {
        healthy: health.healthy !== false,
        lastCheck: health.lastCheck,
        latency: health.latency || 0
      },
      stats: {
        connections: stats.connections || 0,
        totalRequests: stats.totalRequests || 0,
        avgLatency: stats.totalRequests ? Math.round(stats.totalLatency / stats.totalRequests) : 0
      }
    };
  }
  
  res.json({
    loadBalance: LOAD_BALANCE,
    models: modelsWithStats
  });
});

// 管理员接口 - 更新负载均衡策略
app.post('/admin/loadbalance', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { strategy, healthCheckInterval } = req.body;
  
  if (strategy && !['priority', 'round-robin', 'weighted', 'least-conn', 'response-time'].includes(strategy)) {
    return res.status(400).json({ error: 'Invalid strategy. Must be one of: priority, round-robin, weighted, least-conn, response-time' });
  }
  
  if (strategy) LOAD_BALANCE.strategy = strategy;
  if (healthCheckInterval) LOAD_BALANCE.healthCheckInterval = healthCheckInterval;
  
  // 保存配置
  config.loadBalance = LOAD_BALANCE;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  res.json({
    success: true,
    loadBalance: LOAD_BALANCE
  });
});

// 管理员接口 - 更新模型权重
app.post('/admin/models/:name/weight', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const modelName = req.params.name;
  const { weight, priority } = req.body;
  
  if (!MODELS[modelName]) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  if (weight !== undefined) MODELS[modelName].weight = weight;
  if (priority !== undefined) MODELS[modelName].priority = priority;
  
  // 保存配置
  config.models = MODELS;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  res.json({
    success: true,
    model: modelName,
    weight: MODELS[modelName].weight,
    priority: MODELS[modelName].priority
  });
});

// 管理员接口 - 手动触发健康检查
app.post('/admin/healthcheck', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const results = {};
  for (const [name, model] of Object.entries(MODELS)) {
    if (model.enabled) {
      results[name] = await checkModelHealth(name, model);
    }
  }
  
  res.json({
    success: true,
    results,
    health: Object.fromEntries(modelHealth)
  });
});

// 管理员接口 - 启用/禁用模型
app.post('/admin/models/:name/toggle', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const modelName = req.params.name;
  if (!MODELS[modelName]) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  MODELS[modelName].enabled = !MODELS[modelName].enabled;
  
  // 保存配置
  config.models = MODELS;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  res.json({
    success: true,
    model: modelName,
    enabled: MODELS[modelName].enabled
  });
});

// ============================================
// 支付系统（简化版）
// ============================================

// 价格配置
const PRICING = {
  free: { monthly: 0, calls: 100, features: ['基础对话'] },
  pro: { monthly: 49, calls: null, features: ['无限制对话', '优先级队列', '邮件支持'] },
  enterprise: { monthly: 199, calls: null, features: ['无限制对话', '最高优先级', '专属客服', '定制开发'] }
};

// 订单存储
const orders = new Map();

// 获取价格信息
app.get('/v1/pricing', (req, res) => {
  res.json({
    plans: PRICING,
    currency: 'CNY'
  });
});

// 创建订单
app.post('/v1/orders', (req, res) => {
  const { tier, name, email } = req.body;
  
  if (!PRICING[tier]) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  
  const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  const order = {
    id: orderId,
    tier,
    name,
    email,
    amount: PRICING[tier].monthly,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  orders.set(orderId, order);
  
  res.json({
    success: true,
    order,
    paymentUrl: `/pay/${orderId}` // 简化：实际应该跳转到支付页面
  });
});

// 管理员接口 - 激活订单
app.post('/admin/orders/:orderId/activate', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const order = orders.get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // 生成 API Key
  const crypto = require('crypto');
  const tierPrefix = order.tier === 'enterprise' ? 'ent' : order.tier;
  const apiKey = `sk-${tierPrefix}-${crypto.randomBytes(16).toString('hex')}`;
  
  // 添加到 API Keys
  apiKeys[apiKey] = {
    name: order.name,
    email: order.email,
    tier: order.tier,
    dailyLimit: order.tier === 'free' ? 100 : null,
    createdAt: new Date().toISOString(),
    orderId: order.id
  };
  
  // 更新订单状态
  order.status = 'activated';
  order.apiKey = apiKey;
  order.activatedAt = new Date().toISOString();
  
  // 保存
  ensureDataDir();
  fs.writeFileSync(path.join(__dirname, '../data/apikeys.json'), JSON.stringify(apiKeys, null, 2));
  
  console.log('[LanAPI] 订单激活:', order.id, 'API Key:', apiKey);
  
  res.json({
    success: true,
    apiKey,
    order
  });
});

// 管理员接口 - 查看所有订单
app.get('/admin/orders', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json({
    orders: Object.fromEntries(orders)
  });
});

// ============================================
// 用量统计 API
// ============================================
app.get('/v1/usage', authenticate, (req, res) => {
  const usage = usageTracker.getUserUsage(req.apiKey);
  const today = usageTracker.getTodayUsage(req.apiKey);
  const remaining = rateLimiter.getRemaining(req.apiKey, req.user?.tier);
  
  res.json({
    user: req.user?.name || 'anonymous',
    tier: req.user?.tier || 'free',
    today: today,
    remaining: remaining,
    history: usage
  });
});

// 管理员接口 - 获取所有用户用量
app.get('/admin/usage', (req, res) => {
  // 简单的管理员验证（生产环境应该更安全）
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json({
    all_usage: usageTracker.getAllUsage(),
    timestamp: new Date().toISOString()
  });
});

// 管理员接口 - 获取所有 API Keys
app.get('/admin/apikeys', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json({
    apiKeys: apiKeys,
    timestamp: new Date().toISOString()
  });
});

// 管理员接口 - 创建 API Key
app.post('/admin/apikeys', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (config.adminKey || 'lanapi-admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { name, email, tier } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  const crypto = require('crypto');
  const tierPrefix = tier === 'enterprise' ? 'ent' : tier || 'free';
  const apiKey = `sk-${tierPrefix}-${crypto.randomBytes(16).toString('hex')}`;
  
  apiKeys[apiKey] = {
    name,
    email: email || '',
    tier: tier || 'free',
    dailyLimit: tier === 'free' ? 100 : null,
    createdAt: new Date().toISOString()
  };
  
  // 保存
  ensureDataDir();
  fs.writeFileSync(path.join(__dirname, '../data/apikeys.json'), JSON.stringify(apiKeys, null, 2));
  
  console.log('[LanAPI] 创建 API Key:', apiKey, '用户:', name, '等级:', tier);
  
  res.json({
    success: true,
    apiKey,
    info: apiKeys[apiKey]
  });
});

// ============================================
// 健康检查
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: LANAPI_VERSION,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 首页
// ============================================
app.get('/api', (req, res) => {
  res.json({
    name: 'LanAPI',
    version: LANAPI_VERSION,
    description: 'OpenAI/Anthropic 兼容的大模型 API 网关',
    features: [
      'OpenAI 兼容 API',
      'Anthropic 兼容 API',
      'API Key 认证',
      '用量统计',
      '限流保护',
      '多模型负载均衡',
      'Web 管理界面',
      '支付系统'
    ],
    endpoints: {
      'POST /v1/chat/completions': 'OpenAI 兼容对话接口',
      'POST /v1/messages': 'Anthropic 兼容对话接口',
      'GET /v1/models': '获取模型列表',
      'GET /v1/usage': '获取用量统计',
      'GET /v1/pricing': '获取价格信息',
      'POST /v1/orders': '创建订单',
      'GET /health': '健康检查',
      'GET /api': 'API 信息'
    },
    web: `http://localhost:${port}/index.html`
  });
});

// ============================================
// 启动服务器
// ============================================
app.listen(port, () => {
  console.log('');
  console.log('🌸 LanAPI Server v' + LANAPI_VERSION);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('端口:', port);
  console.log('LLM:', LLM_MODEL);
  console.log('地址:', `http://localhost:${port}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('功能:');
  console.log('  ✅ OpenAI 兼容 API');
  console.log('  ✅ Anthropic 兼容 API');
  console.log('  ✅ API Key 认证');
  console.log('  ✅ 用量统计');
  console.log('  ✅ 限流保护');
  console.log('  ✅ 多模型负载均衡');
  console.log('');
  console.log('负载均衡策略:', LOAD_BALANCE.strategy);
  console.log('健康检查间隔:', LOAD_BALANCE.healthCheckInterval / 1000, '秒');
  console.log('');
  console.log('OpenAI 兼容 API:');
  console.log(`  POST http://localhost:${port}/v1/chat/completions`);
  console.log('');
  console.log('Anthropic 兼容 API:');
  console.log(`  POST http://localhost:${port}/v1/messages`);
  console.log('');
  console.log('可用模型:');
  const models = getAvailableModels();
  if (models.length > 0) {
    models.forEach(m => console.log(`  - ${m.name} (优先级: ${m.priority}, 权重: ${m.weight || 1})`));
  } else {
    console.log('  - default');
  }
  console.log('');
  console.log('管理接口:');
  console.log(`  GET  http://localhost:${port}/admin/models`);
  console.log(`  POST http://localhost:${port}/admin/loadbalance`);
  console.log(`  POST http://localhost:${port}/admin/healthcheck`);
  console.log('');
  console.log('用量统计:');
  console.log(`  GET http://localhost:${port}/v1/usage`);
  console.log('');
  
  // 启动健康检查
  startHealthCheck();
});
