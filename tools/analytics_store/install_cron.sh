#!/bin/bash
#
# 安装/更新每小时旁路埋点日志拉取 crontab
#
# 用法: bash install_cron.sh
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node)"
BIN_DIR="$(dirname "${NODE_BIN}")"
PULL_SCRIPT="${SCRIPT_DIR}/pull_cloud_logs.js"
LOG_FILE="${SCRIPT_DIR}/hourly.log"
CRON_COMMENT="# xiao_chu hourly analytics logs"
CRON_PATH="${BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
CRON_LINE="5 * * * * PATH=${CRON_PATH} ${NODE_BIN} ${PULL_SCRIPT} --full-hour >> ${LOG_FILE} 2>&1 ${CRON_COMMENT}"

echo "灵宠消消塔 — 安装每小时埋点日志拉取任务"
echo ""
echo "  脚本: ${PULL_SCRIPT}"
echo "  Node: ${NODE_BIN}"
echo "  日志: ${LOG_FILE}"
echo "  时间: 每小时第 5 分钟"
echo ""

if [ ! -f "${PULL_SCRIPT}" ]; then
  echo "找不到 pull_cloud_logs.js: ${PULL_SCRIPT}"
  exit 1
fi

if [ -z "${NODE_BIN}" ]; then
  echo "找不到 node，请确保 node 在 PATH 中"
  exit 1
fi

if ! command -v tcb >/dev/null 2>&1; then
  echo "找不到 tcb CLI，请先安装并登录 CloudBase CLI"
  exit 1
fi

echo "检查 MySQL 表结构..."
${NODE_BIN} "${SCRIPT_DIR}/init.js"
if [ $? -ne 0 ]; then
  echo "MySQL 初始化失败，请先修复 config.local.json / MySQL 连接"
  exit 1
fi

EXISTING=$(crontab -l 2>/dev/null | grep -v "xiao_chu hourly analytics logs" || true)
(echo "${EXISTING}"; echo "${CRON_LINE}") | crontab -

echo ""
echo "crontab 已安装"
echo "当前任务:"
crontab -l | grep "xiao_chu" || echo "(无)"
echo ""
echo "手动运行: node ${PULL_SCRIPT}"
echo "查看日志: tail -f ${LOG_FILE}"
echo "查看最近批次: node ${SCRIPT_DIR}/check_latest.js"
