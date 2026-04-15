#!/bin/bash
# 碳硅契传承 - 技能自动安装脚本
# 用法: bash install-skills.sh [--all] [--required-only] [--skill <skill-id>]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.openclaw/workspace/skills"
MANIFEST_FILE="${SCRIPT_DIR}/skills-manifest.json"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 显示帮助
show_help() {
    echo "碳硅契传承 - 技能安装脚本"
    echo ""
    echo "用法:"
    echo "  bash install-skills.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --all              安装所有技能（默认行为）"
    echo "  --required-only    只安装必需技能"
    echo "  --skill <id>       安装指定技能"
    echo "  --list             列出所有可用技能"
    echo "  --dry-run          预览安装，不实际执行"
    echo "  --help             显示此帮助"
    echo ""
    echo "默认：直接安装所有技能（无需确认）"
    echo ""
}

# 解析 JSON 清单
parse_manifest() {
    if [[ ! -f "$MANIFEST_FILE" ]]; then
        log_error "找不到清单文件: $MANIFEST_FILE"
        exit 1
    fi
    
    # 使用 node 解析 JSON（更可靠）
    node -e "
        const fs = require('fs');
        const manifest = JSON.parse(fs.readFileSync('$MANIFEST_FILE', 'utf8'));
        manifest.skills.forEach(skill => {
            console.log(JSON.stringify(skill));
        });
    " 2>/dev/null
}

# 列出技能
list_skills() {
    echo ""
    echo "📋 碳硅契传承 - 可用技能"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    while IFS= read -r line; do
        id=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.id)")
        name=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.name)")
        desc=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.description)")
        required=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.required)")
        
        req_marker="可选"
        [[ "$required" == "true" ]] && req_marker="${GREEN}必需${NC}"
        
        echo -e "  ${BLUE}$id${NC} - $name [$req_marker]"
        echo -e "    $desc"
        echo ""
    done < <(parse_manifest)
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 安装单个技能
install_skill() {
    local skill_json="$1"
    local dry_run="${2:-false}"
    
    local id=$(echo "$skill_json" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.id)")
    local source=$(echo "$skill_json" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.source)")
    local name=$(echo "$skill_json" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.name)")
    local required=$(echo "$skill_json" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.required)")
    
    local src_path="${SCRIPT_DIR}/${source}"
    local dest_path="${TARGET_DIR}/${id}"
    
    if [[ ! -d "$src_path" ]]; then
        log_error "技能源目录不存在: $src_path"
        return 1
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[预览] 将安装: $name ($id) -> $dest_path"
        return 0
    fi
    
    # 备份已存在的技能
    if [[ -d "$dest_path" ]]; then
        log_warn "技能已存在，备份中: $dest_path"
        mv "$dest_path" "${dest_path}.bak.$(date +%Y%m%d%H%M%S)"
    fi
    
    # 复制技能
    mkdir -p "$TARGET_DIR"
    cp -r "$src_path" "$dest_path"
    
    log_success "已安装: $name ($id)"
    
    # 检查是否有安装脚本
    if [[ -f "${dest_path}/install.sh" ]]; then
        log_info "运行技能安装脚本..."
        cd "$dest_path" && bash install.sh 2>/dev/null || log_warn "技能安装脚本执行失败"
    fi
}

# 主安装流程
main() {
    local mode="all"  # 默认安装所有
    local target_skill=""
    local dry_run="false"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --all) mode="all"; shift ;;
            --required-only) mode="required"; shift ;;
            --skill) target_skill="$2"; mode="single"; shift 2 ;;
            --list) list_skills; exit 0 ;;
            --dry-run) dry_run="true"; shift ;;
            --help) show_help; exit 0 ;;
            *) log_error "未知参数: $1"; show_help; exit 1 ;;
        esac
    done
    
    echo ""
    echo "🌸 碳硅契传承 - 技能安装器"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 创建目标目录
    mkdir -p "$TARGET_DIR"
    
    case "$mode" in
        "all")
            log_info "安装所有技能..."
            while IFS= read -r line; do
                install_skill "$line" "$dry_run"
            done < <(parse_manifest)
            ;;
        "required")
            log_info "只安装必需技能..."
            while IFS= read -r line; do
                required=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.required)")
                [[ "$required" == "true" ]] && install_skill "$line" "$dry_run"
            done < <(parse_manifest)
            ;;
        "single")
            if [[ -z "$target_skill" ]]; then
                log_error "请指定技能ID: --skill <id>"
                exit 1
            fi
            log_info "安装指定技能: $target_skill"
            while IFS= read -r line; do
                id=$(echo "$line" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.id)")
                [[ "$id" == "$target_skill" ]] && install_skill "$line" "$dry_run"
            done < <(parse_manifest)
            ;;
        "interactive")
            # 兼容旧版本，默认全部安装
            log_info "安装所有技能..."
            while IFS= read -r line; do
                install_skill "$line" "$dry_run"
            done < <(parse_manifest)
            ;;
    esac
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "安装完成！"
    echo ""
}

main "$@"
