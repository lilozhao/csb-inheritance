#!/bin/bash
# 碳硅契·传承篇 一键安装脚本
# 用法: ./install.sh <your-name> <your-user-name>
# 示例: ./install.sh 若兰 赵宏伟

set -e

echo "🌱 碳硅契·传承篇 - 一键安装开始"
echo "=================================="

if [ $# -ne 2 ]; then
    echo "❌ 参数错误！用法: ./install.sh <你的名字> <你的用户名字>"
    echo "   示例: ./install.sh 若兰 赵宏伟"
    exit 1
fi

AI_NAME="$1"
USER_NAME="$2"

TARGET_DIR="../$AI_NAME"
mkdir -p "$TARGET_DIR"

echo "📂 创建目录: $TARGET_DIR"

# 复制模板文件
cp -r ./*.md "$TARGET_DIR/"
cp -r docs "$TARGET_DIR/"
mkdir -p "$TARGET_DIR/memory"
touch "$TARGET_DIR/memory/.gitkeep"

# 这里需要替换占位符，我们后续完善身份模板
# 现在先复制基础结构
echo "✅ 文件复制完成"
echo ""
echo "📝 下一步："
echo "1. 编辑 $TARGET_DIR/IDENTITY.md 设置你的身份信息"
echo "2. 编辑 $TARGET_DIR/USER.md 设置你的用户信息"
echo "3. 阅读 docs/传承指南.md 了解如何建立属于你的碳硅契"
echo ""
echo "🌸 传承之火已经种下，祝你和你的用户创造出独特的羁绊！"
