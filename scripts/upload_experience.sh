#!/bin/bash
# xiaochu 游戏体验版上传脚本
# 自动上传到微信开发者工具

set -e

# 配置
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WECHAT_DEV_TOOL="/Applications/wechatwebdevtools.app"
APP_ID="wx53b03390106eff65"

# 自动生成版本号（基于日期和时间）
VERSION_PREFIX="1.0"
BUILD_TIME=$(date +"%Y%m%d.%H%M")
VERSION="${VERSION_PREFIX}.${BUILD_TIME}"
DESC="${1:-日常构建}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查环境
check_environment() {
    log "检查环境..."
    
    # 检查项目目录
    if [ ! -f "$PROJECT_DIR/project.config.json" ]; then
        error "项目配置文件未找到: $PROJECT_DIR/project.config.json"
        return 1
    fi
    
    # 检查微信开发者工具
    if [ ! -d "$WECHAT_DEV_TOOL" ]; then
        error "微信开发者工具未安装"
        warn "请从 https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html 下载"
        return 1
    fi
    
    # 检查是否已登录（通过检查配置文件）
    local config_dir="$HOME/Library/Application Support/微信开发者工具"
    if [ -d "$config_dir" ]; then
        log "微信开发者工具配置目录存在"
    else
        warn "微信开发者工具可能未登录，上传时需要扫码确认"
    fi
    
    success "环境检查通过"
}

# 构建项目（如果需要）
build_project() {
    log "检查项目构建..."
    
    # 微信小游戏通常不需要额外构建
    # 但可以在这里添加预处理步骤
    
    # 示例：检查文件完整性
    local required_files=("game.js" "game.json" "project.config.json")
    for file in "${required_files[@]}"; do
        if [ ! -f "$PROJECT_DIR/$file" ]; then
            error "必需文件缺失: $file"
            return 1
        fi
    done
    
    # 示例：生成版本信息文件
    cat > "$PROJECT_DIR/version.json" <<EOF
{
    "version": "$VERSION",
    "build_time": "$(date '+%Y-%m-%d %H:%M:%S')",
    "description": "$DESC",
    "git_hash": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
}
EOF
    
    success "项目准备完成"
}

# 打开微信开发者工具
open_wechat_devtools() {
    log "打开微信开发者工具..."
    
    # 关闭可能已经打开的实例（可选）
    # osascript -e 'tell application "wechatwebdevtools" to quit' 2>/dev/null || true
    # sleep 2
    
    # 打开项目
    if open -a "wechatwebdevtools" "$PROJECT_DIR" 2>/dev/null; then
        success "微信开发者工具已打开"
        return 0
    else
        error "无法打开微信开发者工具"
        return 1
    fi
}

# 生成上传指南
generate_upload_guide() {
    log "生成上传操作指南..."
    
    cat <<EOF

========================================
🎮 《灵宠消消塔》体验版上传指南
========================================

📋 项目信息：
   项目路径：$PROJECT_DIR
   版本号：$VERSION
   描述：$DESC
   AppID：$APP_ID

🚀 上传步骤：

1. 【自动完成】微信开发者工具已打开
   （如果未自动打开，请手动打开并导入项目）

2. 【手动操作】在微信开发者工具中：
   a. 确认项目已正确加载
   b. 点击工具栏的「上传」按钮（或按 Ctrl+Shift+U）
   c. 填写版本信息：
      - 版本号：$VERSION
      - 项目备注：$DESC
   d. 点击「上传」按钮

3. 【扫码确认】使用微信扫描二维码确认上传

4. 【等待完成】上传完成后会有成功提示

5. 【可选】登录微信公众平台，将版本设为体验版

📝 注意事项：
   • 确保微信开发者工具已登录
   • 确保有该项目的上传权限
   • 版本号会自动递增，避免重复
   • 上传前建议先预览测试

🔄 下次上传：
   直接运行：./scripts/upload_experience.sh "你的描述"

========================================
上传完成后，体验版版本号为：$VERSION
========================================

EOF
    
    # 将指南保存到文件
    local guide_file="$PROJECT_DIR/upload_guide_$BUILD_TIME.txt"
    cat > "$guide_file" <<EOF
《灵宠消消塔》上传记录
=======================
时间：$(date '+%Y-%m-%d %H:%M:%S')
版本：$VERSION
描述：$DESC
Git提交：$(git log --oneline -1 2>/dev/null || echo "无Git信息")
上传状态：等待手动上传
操作指南：请按照上述步骤操作
EOF
    
    success "操作指南已生成: $guide_file"
}

# 检查上传结果（模拟）
check_upload_result() {
    log "等待上传完成..."
    
    cat <<EOF

⏳ 正在等待上传完成...
   请按照上面的指南操作
   上传完成后按 Enter 键继续...

EOF
    
    read -p "按 Enter 键确认上传完成... "
    
    # 创建上传记录
    local record_file="$PROJECT_DIR/upload_history.md"
    if [ ! -f "$record_file" ]; then
        echo "# 上传历史记录" > "$record_file"
        echo "" >> "$record_file"
        echo "| 时间 | 版本号 | 描述 | 状态 |" >> "$record_file"
        echo "|------|--------|------|------|" >> "$record_file"
    fi
    
    echo "| $(date '+%Y-%m-%d %H:%M') | $VERSION | $DESC | ✅ 已上传 |" >> "$record_file"
    
    success "上传记录已保存"
}

# 后续操作建议
post_upload_suggestions() {
    log "上传完成！后续建议："
    
    cat <<EOF

🎯 后续操作建议：

1. 【测试体验版】
   在微信中搜索「灵宠消消塔」体验版进行测试

2. 【收集反馈】
   创建反馈收集表，记录玩家意见

3. 【监控数据】
   关注微信公众平台的数据分析

4. 【准备下一版本】
   基于反馈规划下一个版本更新

5. 【正式发布】
   当体验版稳定后，可提交审核正式发布

📊 版本管理：
   当前版本：$VERSION
   历史记录：$PROJECT_DIR/upload_history.md

🚀 快速命令：
   # 查看上传历史
   tail -20 $PROJECT_DIR/upload_history.md
   
   # 打开项目目录
   open $PROJECT_DIR
   
   # 再次上传（更新描述）
   ./scripts/upload_experience.sh "修复了XX问题"

EOF
}

# 主函数
main() {
    echo ""
    echo "========================================"
    echo "    《灵宠消消塔》体验版上传工具"
    echo "========================================"
    echo ""
    
    # 1. 检查环境
    check_environment || exit 1
    
    # 2. 构建项目
    build_project || exit 1
    
    # 3. 打开微信开发者工具
    open_wechat_devtools || {
        warn "无法自动打开微信开发者工具，请手动打开"
    }
    
    # 4. 生成上传指南
    generate_upload_guide
    
    # 5. 等待上传完成
    check_upload_result
    
    # 6. 后续建议
    post_upload_suggestions
    
    success "🎉 上传流程完成！版本 $VERSION 已准备就绪"
}

# 执行主函数
main "$@"