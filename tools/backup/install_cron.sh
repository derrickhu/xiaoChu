#!/bin/bash
#
# 安装/更新每日数据库备份 crontab
# 每天凌晨 3:00 执行备份
#
# 用法: bash install_cron.sh
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node)"
DAILY_SCRIPT="${SCRIPT_DIR}/daily.js"
LOG_FILE="${SCRIPT_DIR}/backup.log"
CRON_COMMENT="# xiao_chu daily db backup"
CRON_LINE="0 3 * * * ${NODE_BIN} ${DAILY_SCRIPT} >> ${LOG_FILE} 2>&1 ${CRON_COMMENT}"

echo "📦 灵宠消消塔 — 安装每日备份定时任务"
echo ""
echo "  脚本: ${DAILY_SCRIPT}"
echo "  Node: ${NODE_BIN}"
echo "  日志: ${LOG_FILE}"
echo "  时间: 每天 03:00"
echo ""

# 检查 node 和脚本
if [ ! -f "${DAILY_SCRIPT}" ]; then
  echo "❌ 找不到 daily.js: ${DAILY_SCRIPT}"
  exit 1
fi

if [ -z "${NODE_BIN}" ]; then
  echo "❌ 找不到 node，请确保 node 在 PATH 中"
  exit 1
fi

# 先测试运行一下
echo "🔍 测试运行备份脚本..."
${NODE_BIN} ${DAILY_SCRIPT}
if [ $? -ne 0 ]; then
  echo ""
  echo "⚠ 测试运行失败，请先修复问题再安装 crontab"
  exit 1
fi

echo ""

# 移除旧的同名 cron（如果有）
EXISTING=$(crontab -l 2>/dev/null | grep -v "xiao_chu daily db backup" || true)

# 添加新 cron
(echo "${EXISTING}"; echo "${CRON_LINE}") | crontab -

echo "✅ crontab 已安装！"
echo ""
echo "当前 crontab:"
crontab -l | grep "xiao_chu" || echo "(无)"
echo ""
echo "手动运行: node ${DAILY_SCRIPT}"
echo "查看日志: tail -f ${LOG_FILE}"
echo "卸载任务: crontab -e （删除含 xiao_chu 的行）"
