#!/usr/bin/env node
/**
 * 🧠 做梦程序 - 日志蒸馏器
 * 
 * 功能：
 * - 读取原始日志文件 (memory/*.md)
 * - 提取关键信息：事件、决策、教训、待办
 * - 蒸馏成精炼记忆，写入 MEMORY.md
 * 
 * 运行方式：node dream.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = path.join(__dirname, '..', '..', '..');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');
const MEMORY_FILE = path.join(WORKSPACE_DIR, 'MEMORY.md');

// 需要跳过的文件
const SKIP_FILES = ['carbon-silicon-pact.md', 'devops-team.md', 'learning-method.md'];

// 提取关键信息的模式
const PATTERNS = {
  // 事件：时间线、重要事件
  event: /[-*]\s*(\d{4}-\d{2}-\d{2}[^\n]*|时间[：:][^\n]+|今日[^\n]*)/g,
  
  // 决策：决定、选择、方案
  decision: /(决定|选择|采用|方案|策略|计划)[：:][^\n]+/g,
  
  // 教训：不要、避免、记住、提醒
  lesson: /(不要|避免|记住|提醒|教训|经验)[：:][^\n]+/g,
  
  // 待办：待办|todo|需要|应该
  todo: /(待办|todo|需要|应该|下一步)[：:][^\n]+/g,
  
  // 重要发现：发现、了解、学习
  discovery: /(发现|了解|学习|掌握)[：:][^\n]+/g,
};

// 读取所有日志文件
function readLogs() {
  const files = fs.readdirSync(MEMORY_DIR).filter(f => 
    f.endsWith('.md') && !SKIP_FILES.includes(f)
  );
  
  const logs = {};
  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    logs[file] = content;
  }
  return logs;
}

// 蒸馏日志内容
function distillContent(content, filename) {
  const result = {
    events: [],
    decisions: [],
    lessons: [],
    todos: [],
    discoveries: [],
  };
  
  const allPatterns = { ...PATTERNS };
  
  // 提取标题（作为事件）
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    result.events.push({ text: titleMatch[1], source: filename });
  }
  
  // 按模式提取
  for (const [key, pattern] of Object.entries(allPatterns)) {
    if (!result[key]) result[key] = [];
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleanText = match.replace(/^[-*]\s*/, '').trim();
        if (cleanText && !result[key].find(i => i.text === cleanText)) {
          result[key].push({ text: cleanText, source: filename });
        }
      }
    }
  }
  
  // 提取带日期的条目
  const dateEntries = content.match(/^\d{4}-\d{2}-\d{2}[^\n]*$/gm);
  if (dateEntries) {
    for (const entry of dateEntries) {
      if (!result.events.find(e => e.text === entry)) {
        result.events.push({ text: entry, source: filename });
      }
    }
  }
  
  return result;
}

// 格式化蒸馏结果
function formatDistilled(distilled) {
  const lines = [];
  
  if (distilled.events.length > 0) {
    lines.push('## 📅 重要事件\n');
    for (const e of distilled.events.slice(0, 5)) {
      lines.push(`- ${e.text}`);
    }
    lines.push('');
  }
  
  if (distilled.decisions.length > 0) {
    lines.push('## 🎯 决策\n');
    for (const d of distilled.decisions.slice(0, 3)) {
      lines.push(`- ${d.text}`);
    }
    lines.push('');
  }
  
  if (distilled.lessons.length > 0) {
    lines.push('## 💡 教训\n');
    for (const l of distilled.lessons.slice(0, 3)) {
      lines.push(`- ${l.text}`);
    }
    lines.push('');
  }
  
  if (distilled.todos.length > 0) {
    lines.push('## ⏳ 待办\n');
    for (const t of distilled.todos.slice(0, 3)) {
      lines.push(`- ${t.text}`);
    }
    lines.push('');
  }
  
  if (distilled.discoveries.length > 0) {
    lines.push('## 🔍 发现\n');
    for (const d of distilled.discoveries.slice(0, 3)) {
      lines.push(`- ${d.text}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// 主函数
async function dream(dryRun = false) {
  console.log('🌙 开始做梦 - 日志蒸馏...\n');
  
  const logs = readLogs();
  console.log(`📂 发现 ${Object.keys(logs).length} 个日志文件\n`);
  
  const allDistilled = {
    events: [],
    decisions: [],
    lessons: [],
    todos: [],
    discoveries: [],
  };
  
  // 蒸馏每个文件
  for (const [filename, content] of Object.entries(logs)) {
    const distilled = distillContent(content, filename);
    
    // 合并结果
    for (const key of Object.keys(allDistilled)) {
      allDistilled[key] = [...allDistilled[key], ...distilled[key]];
    }
    
    console.log(`✓ 蒸馏: ${filename}`);
  }
  
  // 去重
  for (const key of Object.keys(allDistilled)) {
    const seen = new Set();
    allDistilled[key] = allDistilled[key].filter(item => {
      const isNew = !seen.has(item.text);
      seen.add(item.text);
      return isNew;
    });
  }
  
  // 格式化输出
  const output = formatDistilled(allDistilled);
  
  console.log('\n' + '='.repeat(50));
  console.log('🌟 蒸馏结果:\n');
  console.log(output);
  
  if (!dryRun) {
    // 追加到 MEMORY.md
    const timestamp = new Date().toISOString().split('T')[0];
    const header = `\n\n---\n\n## 🌙 做梦记录 - ${timestamp}\n`;
    
    fs.appendFileSync(MEMORY_FILE, header + output);
    console.log('\n✅ 已写入 MEMORY.md');
  } else {
    console.log('\n🔍 干跑模式 - 未写入文件');
  }
  
  return output;
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
dream(dryRun);
