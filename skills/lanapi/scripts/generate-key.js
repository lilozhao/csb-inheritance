#!/usr/bin/env node
/**
 * API Key 生成器
 * 
 * 用法：
 *   node scripts/generate-key.js --tier=pro --name="张三"
 *   node scripts/generate-key.js --tier=free --name="李四" --email="li@ex.com"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置路径
const APIKEYS_PATH = path.join(__dirname, '../data/apikeys.json');
const CONFIG_PATH = path.join(__dirname, '../config/config.json');

// 支持的等级
const TIERS = {
  free: { rpm: 10, rpd: 100, price: '免费' },
  pro: { rpm: 60, rpd: null, price: '¥49/月' },
  enterprise: { rpm: 120, rpd: null, price: '¥199/月' }
};

// 生成随机 API Key
function generateApiKey(tier) {
  const prefix = tier === 'enterprise' ? 'ent' : tier;
  const random = crypto.randomBytes(16).toString('hex');
  return `sk-${prefix}-${random}`;
}

// 确保 data 目录存在
function ensureDataDir() {
  const dir = path.dirname(APIKEYS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 加载现有 API Keys
function loadApiKeys() {
  try {
    if (fs.existsSync(APIKEYS_PATH)) {
      return JSON.parse(fs.readFileSync(APIKEYS_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('加载 API Keys 失败:', e.message);
  }
  return {};
}

// 保存 API Keys
function saveApiKeys(apiKeys) {
  ensureDataDir();
  fs.writeFileSync(APIKEYS_PATH, JSON.stringify(apiKeys, null, 2));
  console.log('✅ API Keys 已保存到:', APIKEYS_PATH);
}

// 同步到 config.json（可选）
function syncToConfig(apiKeys) {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      config.apiKeys = apiKeys;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log('✅ 已同步到 config.json');
    }
  } catch (e) {
    console.warn('同步到 config.json 失败:', e.message);
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const params = {};
  args.forEach(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    params[key] = value;
  });
  
  // 检查必需参数
  if (!params.tier) {
    console.log('用法: node generate-key.js --tier=<free|pro|enterprise> --name="用户名" [--email="邮箱"]');
    console.log('\n示例:');
    console.log('  node generate-key.js --tier=free --name="张三"');
    console.log('  node generate-key.js --tier=pro --name="李四" --email="li@example.com"');
    console.log('\n等级:');
    Object.entries(TIERS).forEach(([tier, info]) => {
      console.log(`  ${tier}: ${info.rpm} 次/分钟, ${info.rpd || '无限制'} 次/天, ${info.price}`);
    });
    process.exit(1);
  }
  
  const tier = params.tier.toLowerCase();
  if (!TIERS[tier]) {
    console.error('❌ 无效的等级:', tier);
    console.log('支持的等级:', Object.keys(TIERS).join(', '));
    process.exit(1);
  }
  
  if (!params.name) {
    console.error('❌ 必须指定 --name 参数');
    process.exit(1);
  }
  
  // 生成 API Key
  const apiKey = generateApiKey(tier);
  const tierInfo = TIERS[tier];
  
  // 用户信息
  const userInfo = {
    name: params.name,
    email: params.email || '',
    tier: tier,
    dailyLimit: tierInfo.rpd,
    createdAt: new Date().toISOString()
  };
  
  // 加载现有数据
  const apiKeys = loadApiKeys();
  apiKeys[apiKey] = userInfo;
  
  // 保存
  saveApiKeys(apiKeys);
  
  // 同步到 config.json
  syncToConfig(apiKeys);
  
  // 输出结果
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 API Key 生成成功！\n');
  console.log('API Key:', apiKey);
  console.log('用户名:', params.name);
  console.log('等级:', tier);
  console.log('限制:', `${tierInfo.rpm} 次/分钟, ${tierInfo.rpd || '无限制'} 次/天`);
  console.log('价格:', tierInfo.price);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 使用示例
  console.log('使用示例:');
  console.log(`curl -X POST http://localhost:3110/v1/chat/completions \\`);
  console.log(`  -H "Authorization: Bearer ${apiKey}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"model":"lanapi","messages":[{"role":"user","content":"你好"}]}'`);
}

main();
