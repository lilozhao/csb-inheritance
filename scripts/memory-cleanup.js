#!/usr/bin/env node
/**
 * 🧹 碳硅契·记忆清淤工具 v1.0
 * 
 * 触发时机：MEMORY.md > 2000 行，或注入截断 > 70%
 * 频率：每2-3个月一次
 * 命名由来：清漪说——河道久了要清淤，记忆久了也要清淤。保持水面清澈。
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.HOME + '/.openclaw/workspace';
const MEMORY_FILE = WORKSPACE + '/MEMORY.md';
const MEMORY_DIR = WORKSPACE + '/memory';
const ARCHIVE_DIR = MEMORY_DIR + '/archive';

// === 1. 检测 ===
function diagnose() {
  if (!fs.existsSync(MEMORY_FILE)) return { needsCleanup: false, reason: 'no MEMORY.md' };
  
  const memContent = fs.readFileSync(MEMORY_FILE, 'utf8');
  const lines = memContent.split('\n').length;
  
  console.log(`📊 MEMORY.md: ${lines} 行`);
  
  const diaryFiles = fs.readdirSync(MEMORY_DIR).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
  console.log(`📓 日记文件: ${diaryFiles.length} 篇`);
  
  const needsCleanup = lines > 2000 || lines > 1000; // 保守点，1000行就可以归档了
  
  return { needsCleanup, lines, diaryCount: diaryFiles.length };
}

// === 2. 清淤（归档冷记忆）===
function cleanup() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
  
  const memContent = fs.readFileSync(MEMORY_FILE, 'utf8');
  const lines = memContent.split('\n');
  
  // 找出"记忆归档"标记之间的内容移到archive
  const archiveMatch = memContent.match(/## 记忆归档\n([\s\S]*?)(?=\n## |$)/);
  
  // 压缩 MEMORY.md：保留核心记忆，将30天前的具体事件归档
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  
  // 归档旧的日记文件
  const diaryFiles = fs.readdirSync(MEMORY_DIR).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
  let archived = 0;
  
  for (const file of diaryFiles) {
    const dateStr = file.replace('.md', '');
    const fileDate = new Date(dateStr);
    if (fileDate < thirtyDaysAgo) {
      const src = path.join(MEMORY_DIR, file);
      const dest = path.join(ARCHIVE_DIR, file);
      fs.renameSync(src, dest);
      archived++;
    }
  }
  
  console.log(`📦 归档了 ${archived} 篇日记到 archive/`);
  console.log(`🧹 当前 MEMORY.md: ${lines.length} 行`);
  return archived;
}

// === 3. 主流程 ===
const diag = diagnose();
console.log(`状态: ${diag.needsCleanup ? '⚠️ 建议清淤' : '✅ 无需清淤'}`);

if (process.argv.includes('--run')) {
  if (diag.needsCleanup) {
    cleanup();
    console.log('✅ 清淤完成！');
  } else {
    console.log('⏭️ 尚未达到清淤阈值，跳过');
  }
}
