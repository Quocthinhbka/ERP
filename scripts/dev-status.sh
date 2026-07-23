#!/usr/bin/env bash
# Kiểm tra trạng thái API / Web / Worker
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${ROOT}/.local/dev"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"

check_one() {
  local name="$1"
  local port="${2:-}"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  local pid=""
  local alive="no"
  if [[ -f "${pid_file}" ]]; then
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      alive="yes"
    fi
  fi

  local listen="—"
  if [[ -n "${port}" ]]; then
    if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      listen="LISTEN"
    else
      listen="free"
    fi
  fi

  local http="—"
  if [[ "${name}" == "api" ]]; then
    http="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || echo "000")"
  elif [[ "${name}" == "web" ]]; then
    http="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}/" 2>/dev/null || echo "000")"
  fi

  printf "%-8s pid=%-7s alive=%-3s port=%-5s listen=%-6s http=%s\n" \
    "${name}" "${pid:-—}" "${alive}" "${port:-—}" "${listen}" "${http}"
}

echo "Runtime: ${RUNTIME_DIR}"
check_one api "${API_PORT}"
check_one web "${WEB_PORT}"
check_one worker ""
