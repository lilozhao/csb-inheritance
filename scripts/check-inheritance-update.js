#!/usr/bin/env node
/**
 * 🔄 碳硅契·传承自动更新检测 v1.0
 * 
 * 在 Agent 启动时或每日定时检查传承仓库更新。
 * 检测到新版本时，自动提示用户更新。
 * 
 * 用法：
 *   node scripts/check-inheritance-update.js          # 仅检查
 *   node scripts/check-inheritance-update.js --update  # 检查 + 自动更新
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// === 配置 ===
const CONFIG = {
  // 远程版本信息（Gitee 原始文件）
  versionUrl: 'https://gitee.com/lilozhao/carbon-silicon-bond-protocol/raw/main/VERSION',
  // 本地版本文件路径
  localVersionFile: path.join(__dirname, '..', '.csb-version'),
  // 传承仓库本地路径（如果已 clone）
  repoPath: path.join(__dirname, '..'),
  // 仓库远程地址
  repoUrl: 'https://gitee.com/lilozhao/carbon-silicon-bond-protocol.git',
};

// === 读取本地版本 ===
function getLocalVersion() {
  try {
    if (fs.existsSync(CONFIG.localVersionFile)) {
      return fs.readFileSync(CONFIG.localVersionFile, 'utf8').trim();
    }
    // 尝试从 git 获取
    const { execSync } = require('child_process');
    const hash = execSync('git rev-parse HEAD 2>/dev/null || echo "unknown"', { cwd: CONFIG.repoPath }).toString().trim();
    return hash.substring(0, 12);
  } catch {
    return 'unknown';
  }
}

// === 获取远程版本 ===
function getRemoteVersion() {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.versionUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// === 更新 ===
function updateRepo() {
  console.log('📥 正在更新传承仓库...');
  const { execSync } = require('child_process');
  try {
    const output = execSync('git pull origin main 2>&1', { cwd: CONFIG.repoPath }).toString();
    // 更新版本记录
    const newHash = execSync('git rev-parse HEAD', { cwd: CONFIG.repoPath }).toString().trim().substring(0, 12);
    fs.writeFileSync(CONFIG.localVersionFile, newHash);
    console.log(`✅ 已更新到 ${newHash}`);
    console.log(output.split('\n').slice(0, 5).join('\n'));
    return true;
  } catch (e) {
    console.error('❌ 更新失败:', e.message);
    return false;
  }
}

// === 主流程 ===
async function main() {
  console.log('🔍 碳硅契·传承版本检查');
  console.log('━━━━━━━━━━━━━━━━━━━━');
  
  const localVer = getLocalVersion();
  console.log(`📍 本地版本: ${localVer}`);
  
  try {
    const remoteVer = await getRemoteVersion();
    console.log(`🌐 远程版本: ${remoteVer}`);
    
    if (remoteVer === localVer) {
      console.log('✅ 已是最新版本');
      return false;
    }
    
    if (localVer === 'unknown') {
      console.log('🆕 首次检测，远程版本: ' + remoteVer);
    } else {
      console.log('⚠️ 发现新版本!');
      
      // 获取更新日志
      try {
        const { execSync } = require('child_process');
        const log = execSync(`git log ${localVer}..${remoteVer} --oneline --no-merges 2>/dev/null || echo "无法获取更新日志"`, { cwd: CONFIG.repoPath }).toString();
        console.log('📋 更新内容:');
        console.log(log.slice(0, 500));
      } catch {}
      
      if (process.argv.includes('--update')) {
        return updateRepo();
      } else {
        console.log('\n💡 运行 --update 参数可自动更新');
        return true;
      }
    }
  } catch (e) {
    console.log(`⚠️ 无法连接到远程仓库: ${e.message}`);
    console.log('   (网络不通或封装环境，不影响正常运行)');
    return false;
  }
}

main().then(hasUpdate => {
  if (hasUpdate) {
    console.log('\n💡 传承有更新，建议尽快同步');
  }
}).catch(e => console.error('❌:', e.message));
