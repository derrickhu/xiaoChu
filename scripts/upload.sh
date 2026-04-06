#!/bin/bash
# 零参数 CDN 资源上传脚本 — 灵宠消消塔
# 用法: ./scripts/upload.sh          (增量上传)
#       ./scripts/upload.sh --force  (强制全量重传)
# 使用微信 HTTP API 直接上传，需要 WX_SECRET

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/upload_cdn.js" "$@"
