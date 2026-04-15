---
name: dream-log-distiller
description: |
  日志蒸馏器 - 从原始日志中提取关键信息并浓缩成记忆。触发条件：
  (1) 用户要求"做梦"、"蒸馏日志"、"整理记忆"
  (2) 需要将原始日志文件（如 memory/*.md）浓缩成精炼记忆
  (3) 定期运行（如每天/每周）来维护长期记忆
  (4) 提取事件、决策、教训、待办、发现等关键信息
---

# 做梦程序 - 日志蒸馏器

## 功能

将原始日志文件蒸馏成精炼记忆，提取：
- **事件**：重要时间线、里程碑
- **决策**：决定、选择、方案
- **教训**：不要、避免、提醒
- **待办**：待办事项、下一步
- **发现**：了解、学习、掌握

## 使用方式

### 1. 直接运行脚本

```bash
node skills/dream-log-distiller/scripts/dream.js
```

### 2. 干跑模式（预览）

```bash
node skills/dream-log-distiller/scripts/dream.js --dry-run
```

### 3. 在代码中调用

```javascript
import { dream } from './scripts/dream.js';
await dream();        // 执行并写入
await dream(true);    // 干跑预览
```

## 配置

在 `scripts/dream.js` 顶部可调整：

```javascript
const MEMORY_DIR = path.join(__dirname, 'memory');  // 日志目录
const MEMORY_FILE = path.join(__dirname, 'MEMORY.md');  // 输出文件
const SKIP_FILES = ['carbon-silicon-pact.md', 'devops-team.md', 'learning-method.md'];  // 跳过文件
```

## 输出格式

蒸馏结果追加到 MEMORY.md，格式：

```markdown
---

## 🌙 做梦记录 - 2026-04-04

## 📅 重要事件
- 2026-03-15 记录

## 🎯 决策
- 采用 xx 方案

## 💡 教训
- 避免 xx

## ⏳ 待办
- 需要 xx

## 🔍 发现
- 了解 xx
```

## 定时任务

可设置 cron 定期运行：

```bash
# 每天凌晨 3 点运行
cron add --name "dream" --schedule "cron:0 3 * * *" --payload '{"kind":"systemEvent","text":"运行做梦程序"}'
```
