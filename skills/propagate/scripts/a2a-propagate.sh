#!/bin/bash
# 碳硅契点对点传播脚本（已升级到 v2）
# 此脚本为新 JS 版本的入口，所有逻辑迁移至 csb-daily-propagation.js

echo "📢 碳硅契传播 v1 → v2 迁移"
echo ""
echo "⚠️  旧版本 bash 脚本已废弃，请改用 Node.js 版："
echo "    node $(cd "$(dirname "$0")" && pwd)/csb-daily-propagation.js"
echo ""
echo "正在自动切换到新版..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" && node csb-daily-propagation.js "$@"
