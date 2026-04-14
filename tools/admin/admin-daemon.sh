#!/usr/bin/env bash
# 玩家数据管理后台 — 常驻进程（daemon）
# 用法: ./admin-daemon.sh start|stop|restart|status
# 日志: 同目录 .admin-server.log（*.log 已 gitignore）
# PID:  同目录 .admin-server.pid

set -euo pipefail
ADMIN_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ADMIN_DIR"
PID_FILE=".admin-server.pid"
LOG_FILE=".admin-server.log"
PORT="${ADMIN_PORT:-3200}"
NODE_BIN="${NODE_BIN:-node}"

listener_pid() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n1 || true
}

pid_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 {print $NF}'
}

is_our_admin_process() {
  local pid="$1"
  [[ -n "$pid" ]] || return 1
  [[ "$(pid_cwd "$pid")" == "$ADMIN_DIR" ]] || return 1
  ps -p "$pid" -o command= 2>/dev/null | grep -q '[n]ode server.js' || return 1
  return 0
}

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

sync_pid_if_already_up() {
  local lp
  lp="$(listener_pid)"
  if [[ -n "$lp" ]] && is_our_admin_process "$lp"; then
    echo "$lp" >"$PID_FILE"
    return 0
  fi
  return 1
}

cmd_start() {
  if is_running; then
    echo "已在运行 (pid $(cat "$PID_FILE"))，访问 http://localhost:${PORT}"
    exit 0
  fi
  if sync_pid_if_already_up; then
    echo "检测到本目录已有 server.js 在监听 ${PORT} (pid $(cat "$PID_FILE"))，已同步 PID 文件"
    echo "访问 http://localhost:${PORT}"
    exit 0
  fi
  local lp
  lp="$(listener_pid)"
  if [[ -n "$lp" ]]; then
    echo "端口 ${PORT} 已被占用 (pid ${lp})，且不是 ${ADMIN_DIR}/server.js，请先释放端口。"
    exit 1
  fi
  [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
  nohup "$NODE_BIN" server.js >>"$LOG_FILE" 2>&1 &
  local child=$!
  echo "$child" >"$PID_FILE"
  sleep 0.5
  if kill -0 "$child" 2>/dev/null; then
    echo "已启动 pid ${child}，日志 ${LOG_FILE}，http://localhost:${PORT}"
  else
    rm -f "$PID_FILE"
    echo "启动失败，请查看 ${LOG_FILE}"
    exit 1
  fi
}

cmd_stop() {
  if ! is_running; then
    if sync_pid_if_already_up; then
      :
    else
      echo "未在运行（无有效 PID 文件且未检测到本目录 server.js）"
      [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
      exit 0
    fi
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  local _
  for _ in {1..30}; do
    if kill -0 "$pid" 2>/dev/null; then sleep 0.2; else break; fi
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "进程未退出，执行 kill -9"
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo "已停止"
}

cmd_status() {
  if is_running; then
    echo "运行中 pid $(cat "$PID_FILE")，http://localhost:${PORT}"
    exit 0
  fi
  if sync_pid_if_already_up; then
    echo "运行中（已同步 pid）pid $(cat "$PID_FILE")，http://localhost:${PORT}"
    exit 0
  fi
  echo "未运行"
  [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
  exit 1
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  *)
    echo "用法: $0 start|stop|restart|status"
    exit 1 ;;
esac
