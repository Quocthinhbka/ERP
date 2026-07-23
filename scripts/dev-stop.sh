#!/usr/bin/env bash
# Dừng API / Web / Worker đã start bằng scripts/dev-start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${ROOT}/.local/dev"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"

stop_pid_file() {
  local name="$1"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  if [[ ! -f "${pid_file}" ]]; then
    echo "[${name}] không có pid file"
    return 0
  fi
  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    echo "[${name}] dừng pid ${pid} (+ process con)"
    # Kill process group nếu có; fallback kill pid + children
    kill -TERM "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
    sleep 0.5
    if kill -0 "${pid}" 2>/dev/null; then
      pkill -P "${pid}" 2>/dev/null || true
      kill -KILL "${pid}" 2>/dev/null || true
    fi
  else
    echo "[${name}] pid không còn sống"
  fi
  rm -f "${pid_file}"
}

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "[port ${port}] giải phóng: ${pids}"
    # shellcheck disable=SC2086
    kill -TERM ${pids} 2>/dev/null || true
    sleep 0.4
    pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -KILL ${pids} 2>/dev/null || true
    fi
  fi
}

stop_pid_file api
stop_pid_file web
stop_pid_file worker
free_port "${API_PORT}"
free_port "${WEB_PORT}"
# Worker không có cổng cố định — dọn node dist/main của worker nếu còn
pkill -f "${ROOT}/apps/worker" 2>/dev/null || true

echo "Đã dừng dev servers."
