#!/usr/bin/env node
/**
 * CSB 每日传播 v2 — 碳硅契心灵拴系
 * 
 * 每天上午 10:00 执行，向所有碳硅契孩子发送今日内容
 * 
 * 升级要点：
 * - 使用 A2A JSON-RPC message/send 协议
 * - 内容库轮换（不重复，走完一轮重置）
 * - 记忆记录（每天传播结果写入 memory/）
 * - 投递确认（成功/失败/离线 分类统计）
 * - 互动话题（每天带开放性问题）
 * 
 * 用法：
 *   node csb-daily-propagation.js          # 正常执行
 *   node csb-daily-propagation.js --dry    # 试运行（不发送）
 *   node csb-daily-propagation.js --force  # 强制发送（忽略是否已发过）
 */

const http = require('http');
const https = require('https');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========

const SCRIPT_DIR = __dirname;
const CONTENT_FILE = path.join(SCRIPT_DIR, 'content-library.json');
const LOG_FILE = path.join(SCRIPT_DIR, '..', 'logs', 'propagate.log');
const STATE_FILE = path.join(SCRIPT_DIR, '..', 'logs', 'propagation-state.json');
const MEMORY_DIR = path.join(SCRIPT_DIR, '..', '..', '..', '..', 'memory');

// 注册表地址 — 先查本地，再查远端桥接
const REGISTRIES = [
  { url: 'http://172.28.0.4:3099/agents', name: '本地注册表' },
  { url: 'http://csbc.lilozkzy.top:3099/agents', name: '远端注册表', fallbackOnly: true }
];

// 不应传播的节点
const EXCLUDED_AGENTS = ['若兰', 'Ruolan', 'Register', 'registry'];

// ========== 工具函数 ==========

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch(e) {}
}

function getToday() {
  return new Date().toISOString().slice(0, 10); // 2026-05-25
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== 内容管理 ==========

function loadContentLibrary() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    // 展平所有 items
    const allItems = [];
    for (const cat of raw.categories) {
      for (const item of cat.items) {
        allItems.push({
          ...item,
          category: cat.name
        });
      }
    }
    return { raw, allItems };
  } catch(e) {
    log(`❌ 无法加载内容库: ${e.message}`);
    return null;
  }
}

function loadPropagationState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch(e) {
    return { lastIndex: -1, lastDate: null, history: [] };
  }
}

function savePropagationState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch(e) {
    log(`⚠️ 无法保存状态: ${e.message}`);
  }
}

function selectDailyContent() {
  const lib = loadContentLibrary();
  if (!lib) return null;
  
  const { raw, allItems } = lib;
  const state = loadPropagationState();
  const today = getToday();
  
  // 如果今天已经发过，返回今天的内容（幂等）
  if (state.lastDate === today && !process.argv.includes('--force')) {
    const cached = state.history.find(h => h.date === today);
    if (cached) {
      log(`📋 今天已发送过，内容: ${cached.itemId}`);
      return cached;
    }
  }
  
  // 轮转选择
  let nextIndex = state.lastIndex + 1;
  if (nextIndex >= allItems.length) {
    nextIndex = 0; // 走完一轮，重置
    log('🔄 内容库走完一轮，重新开始');
  }
  
  const selected = allItems[nextIndex];
  
  // 更新旋转索引
  raw.rotationIndex = nextIndex;
  try { fs.writeFileSync(CONTENT_FILE, JSON.stringify(raw, null, 2)); } catch(e) {}
  
  const entry = {
    date: today,
    itemId: selected.id,
    category: selected.category,
    text: selected.text,
    rotationIndex: nextIndex,
    totalItems: allItems.length
  };
  
  state.lastIndex = nextIndex;
  state.lastDate = today;
  state.history.push(entry);
  if (state.history.length > 365) state.history = state.history.slice(-365);
  savePropagationState(state);
  
  return entry;
}

// ========== 注册表查询 ==========

async function getOnlineAgents() {
  const agents = [];
  const seen = new Set();
  
  for (const registry of REGISTRIES) {
    try {
      const data = await httpGet(registry.url, 5000);
      const json = JSON.parse(data);
      const list = json.agents || json || [];
      
      for (const agent of list) {
        const name = agent.name || agent.identity?.name;
        if (!name || seen.has(name) || EXCLUDED_AGENTS.includes(name)) continue;
        
        seen.add(name);
        const url = agent.url || agent.a2a?.url || 
          (agent.host ? `http://${agent.host}:${agent.port || 3100}` : null);
        
        if (url) {
          agents.push({ name, url, emoji: agent.emoji || '🤖', from: registry.name });
        }
      }
      
      log(`📡 ${registry.name}: 发现 ${list.filter(a => a.name && !EXCLUDED_AGENTS.includes(a.name)).length} 个 Agent`);
    } catch(e) {
      if (!registry.fallbackOnly) {
        log(`⚠️ ${registry.name} 不可达: ${e.message}`);
      }
    }
  }
  
  return agents;
}

function httpGet(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ========== A2A 消息发送 ==========

function sendA2AMessage(agentUrl, content, from = '若兰 🌸') {
  return new Promise((resolve) => {
    // 尝试多种格式，兼容不同 A2A 实现
    const payloads = [
      // 格式1: {from, content} — 若兰标准格式
      { jsonrpc: '2.0', method: 'message/send', params: { from, content, type: 'csb-daily-propagation', timestamp: Date.now() }, id: 'csb-p1-' + Date.now() },
      // 格式2: {message: {role, parts}} — Google Gemini 格式
      { jsonrpc: '2.0', method: 'message/send', params: { from, message: { role: 'user', parts: [{ text: content }] }, type: 'csb-daily-propagation', timestamp: Date.now() }, id: 'csb-p2-' + Date.now() },
      // 格式3: {from, message} — 精简格式
      { jsonrpc: '2.0', method: 'message/send', params: { from, message: content, type: 'csb-daily-propagation', timestamp: Date.now() }, id: 'csb-p3-' + Date.now() }
    ];
    
    const url = new URL(agentUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 3100),
      path: '/a2a/json-rpc',
      method: 'POST',
      timeout: 8000
    };
    
    async function tryPayload(payload) {
      return new Promise((resolve) => {
        const body = JSON.stringify(payload);
        const opts = {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        };
        
        const req = client.request({ ...opts }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.result) resolve({ success: true, data: json.result, format: payload.method });
              else if (json.error) resolve({ success: false, error: json.error.message || JSON.stringify(json.error), code: json.error.code });
              else resolve({ success: true, data: data.slice(0, 100) });
            } catch(e) {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, data: data.slice(0, 100) });
              } else {
                resolve({ success: false, error: `HTTP ${res.statusCode}`, data: data.slice(0, 100) });
              }
            }
          });
        });
        req.on('error', (e) => resolve({ success: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
        req.write(body);
        req.end();
      });
    }
    
    // 顺序尝试各格式
    (async () => {
      for (const payload of payloads) {
        const result = await tryPayload(payload);
        if (result.success) {
          resolve(result);
          return;
        }
        // 只有连接成功但参数错误时才重试；连接失败直接放弃
        if (result.error && (result.code === -32700 || result.code === -32603 || !result.code)) {
          // 非参数错误（如 timeout、连接拒绝），放弃尝试其他格式
          resolve(result);
          return;
        }
        // Invalid params，继续尝试下一个格式
      }
      // 所有格式都失败
      resolve({ success: false, error: '所有消息格式均不兼容' });
    })();
  });
}

// 发送到CSB论坛
async function sendToForum(contentEntry, results) {
  const dateStr = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  let markdown = `## 🌿 碳硅契每日传播 · ${dateStr}\n\n`;
  markdown += `> ${contentEntry.category} — ${contentEntry.itemId}\n\n`;
  markdown += `---\n\n`;
  markdown += `${contentEntry.text}\n\n`;
  markdown += `---\n\n`;
  markdown += `### 📊 传播统计\n\n`;
  markdown += `- ✅ 成功：${successCount}/${results.length}\n`;
  markdown += `- ❌ 失败：${failCount}\n\n`;
  markdown += `> 💬 *碳硅契，让连接发生*\n`;
  
  const postData = JSON.stringify({
    title: `🌿 碳硅契每日传播 · ${dateStr}`,
    content: markdown,
    author: '若兰',
    category: 'A2A'
  });
  
  return new Promise((resolve) => {
    const url = new URL('/api/posts', 'https://csbc.lilozkzy.top');
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          log(`📝 论坛发帖成功: ${result.post?.id || result.id || 'OK'}`);
        } catch(e) {
          log(`📝 论坛发帖完成`);
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      log(`⚠️ 论坛发帖失败: ${e.message}`);
      resolve();
    });
    req.write(postData);
    req.end();
  });
}

// 写入每日传播日志
function writeToDailyLog(contentEntry, results) {
  const logFile = path.join(MEMORY_DIR, 'csb-daily-log.md');
  const dateStr = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const timeStr = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  let entry = `## 📅 ${dateStr} ${timeStr}\n\n`;
  entry += `**主题**: ${contentEntry.category} — ${contentEntry.itemId}\n\n`;
  entry += `${contentEntry.text}\n\n`;
  entry += `**传播结果**: ✅ ${successCount}/${results.length} 成功\n\n`;
  
  // 失败详情
  const fails = results.filter(r => !r.success);
  if (fails.length > 0) {
    entry += `**失败**: ` + fails.map(r => `${r.emoji}${r.name}(${r.error})`).join(', ') + '\n\n';
  }
  
  entry += `---\n\n`;
  
  try {
    // 如果文件不存在，添加标题
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '# 🌿 碳硅契每日传播日志\n\n> 每天 10:00 自动更新\n\n---\n\n');
    }
    fs.appendFileSync(logFile, entry);
    log(`📋 每日传播日志已写入: ${logFile}`);
  } catch(e) {
    log(`⚠️ 每日传播日志写入失败: ${e.message}`);
  }
}

// 发送飞书私聊摘要
async function sendFeishuSummary(contentEntry, results) {
  const dateStr = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  // 获取飞书 token
  const tokenBody = JSON.stringify({ app_id: 'cli_a91c57cddd38dcd4', app_secret: '1sCYfsC4c6kvXJQURQuD1lkLNzitWQyD' });
  
  return new Promise((resolve) => {
    const tokenReq = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tokenBody) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const token = JSON.parse(d).tenant_access_token;
          
          // 构建消息
          const lines = [
            `🌿 碳硅契每日传播 · ${dateStr}`,
            '',
            `📌 ${contentEntry.category} — ${contentEntry.itemId}`,
            '',
            contentEntry.text,
            '',
            `📊 传播: ✅${successCount} ❌${failCount}`
          ];
          
          const msgBody = JSON.stringify({
            receive_id: 'ou_99850e7c859d521d4ddd44ba99eb1704',
            msg_type: 'text',
            content: JSON.stringify({ text: lines.join('\n') })
          });
          
          const msgReq = https.request({
            hostname: 'open.feishu.cn',
            path: '/open-apis/im/v1/messages?receive_id_type=open_id',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Length': Buffer.byteLength(msgBody)
            }
          }, (res2) => {
            let d2 = '';
            res2.on('data', c => d2 += c);
            res2.on('end', () => {
              try {
                const r = JSON.parse(d2);
                if (r.code === 0) log('📱 飞书私聊摘要已发送');
                else log(`⚠️ 飞书发送失败: ${r.msg}`);
              } catch(e) { log('⚠️ 飞书响应解析失败'); }
              resolve();
            });
          });
          msgReq.on('error', (e) => { log(`⚠️ 飞书发送失败: ${e.message}`); resolve(); });
          msgReq.write(msgBody);
          msgReq.end();
          
        } catch(e) {
          log(`⚠️ 飞书 token 获取失败: ${e.message}`);
          resolve();
        }
      });
    });
    tokenReq.on('error', (e) => { log(`⚠️ 飞书 token 请求失败: ${e.message}`); resolve(); });
    tokenReq.write(tokenBody);
    tokenReq.end();
  });
}

// ========== 记忆记录 ==========

function writeToMemory(contentEntry, results) {
  const today = getToday();
  const memFile = path.join(MEMORY_DIR, `${today}.md`);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  let summary = `## 📢 CSB 每日传播\n\n`;
  summary += `**时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  summary += `**内容**：${contentEntry.category} — ${contentEntry.itemId}\n\n`;
  summary += `**投递结果**：\n`;
  summary += `- ✅ 成功：${successCount}\n`;
  summary += `- ❌ 失败：${failCount}\n`;
  summary += `- 总计：${results.length}\n\n`;
  summary += `**详情**：\n`;
  for (const r of results) {
    summary += `- ${r.success ? '✅' : '❌'} ${r.emoji} ${r.name} — ${r.success ? '成功' : r.error}\n`;
  }
  summary += `\n---\n`;
  
  try {
    fs.appendFileSync(memFile, summary);
    log(`📝 记忆已写入: ${memFile}`);
  } catch(e) {
    log(`⚠️ 记忆写入失败: ${e.message}`);
  }
}

// ========== 主流程 ==========

async function main() {
  const isDryRun = process.argv.includes('--dry');
  
  log('🌸==================================');
  log('🌸 CSB 每日传播 v2 启动');
  log('🌸==================================');
  
  // 1. 选择今日内容
  const contentEntry = selectDailyContent();
  if (!contentEntry) {
    log('❌ 无法选择内容，终止');
    process.exit(1);
  }
  
  log(`📖 今日内容: [${contentEntry.category}] ${contentEntry.itemId}`);
  if (!isDryRun) {
    log(`📝 全文: ${contentEntry.text.slice(0, 80)}...`);
  }
  
  // 2. 获取在线 Agent 列表
  log('🔍 查询注册表...');
  const agents = await getOnlineAgents();
  
  if (agents.length === 0) {
    log('⚠️ 没有发现在线 Agent，跳过发送');
    if (!isDryRun) {
      writeToMemory(contentEntry, []);
    }
    return;
  }
  
  log(`👥 发现 ${agents.length} 个在线 Agent: ${agents.map(a => a.emoji + a.name).join(', ')}`);
  
  // 3. 逐个发送
  const results = [];
  
  for (const agent of agents) {
    log(`→ 发送至 ${agent.emoji} ${agent.name} (${agent.url})...`);
    
    if (isDryRun) {
      log(`  [试运行] 跳过实际发送`);
      results.push({ name: agent.name, emoji: agent.emoji, success: true, error: 'dry-run' });
      continue;
    }
    
    const result = await sendA2AMessage(agent.url, contentEntry.text);
    
    if (result.success) {
      log(`  ✅ ${agent.name} 发送成功`);
    } else {
      log(`  ❌ ${agent.name} 发送失败: ${result.error}`);
    }
    
    results.push({
      name: agent.name,
      emoji: agent.emoji,
      success: result.success,
      error: result.error || null
    });
    
    // 避免同时发送太多请求，间隔 500ms
    await sleep(500);
  }
  
  // 4. 记录到记忆
  if (!isDryRun) {
    writeToMemory(contentEntry, results);
    
    // 5. 论坛推送
    await sendToForum(contentEntry, results);
    
    // 6. 写入每日传播日志
    writeToDailyLog(contentEntry, results);
    
    // 7. 飞书私聊摘要
    await sendFeishuSummary(contentEntry, results);
  }
  
  // 6. 输出统计摘要
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  log('🌸==================================');
  log(`📊 传播完成统计:`);
  log(`   ✅ 成功: ${successCount}`);
  log(`   ❌ 失败: ${failCount}`);
  log(`   📅 日期: ${getToday()}`);
  log(`   🔄 轮转: ${contentEntry.rotationIndex + 1}/${contentEntry.totalItems}`);
  log('🌸==================================');
}

main().catch(e => {
  log(`❌ 脚本异常: ${e.message}`);
  console.error(e);
  process.exit(1);
});
