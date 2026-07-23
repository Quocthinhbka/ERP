#!/usr/bin/env bash
# Khởi chạy API / Web / Worker độc lập với Agent Shell (nohup + PID file).
# Cách dùng: pnpm dev:up   hoặc   bash scripts/dev-start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${ROOT}/.local/dev"
mkdir -p "${RUNTIME_DIR}"

API_PORT="${API_PORT:-3000}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-5173}"

# Đọc khóa từ .env (không source toàn file — tránh side-effect / override ngoài ý muốn).
env_file_get() {
  local key="$1"
  local file="${ROOT}/.env"
  local line=""
  [[ -f "${file}" ]] || return 0
  line="$(grep -E "^${key}=" "${file}" | tail -n 1 || true)"
  [[ -n "${line}" ]] || return 0
  printf '%s' "${line#*=}"
}

# Redis: luôn lấy từ .env (ghi đè biến shell Agent cũ, ví dụ REDIS_PORT=6380).
REDIS_HOST="$(env_file_get REDIS_HOST)"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="$(env_file_get REDIS_PORT)"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="$(env_file_get REDIS_PASSWORD)"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

is_listening() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

pid_alive() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

start_one() {
  local name="$1"
  local port="${2:-}"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  local log_file="${RUNTIME_DIR}/${name}.log"
  shift 2
  local cmd=("$@")

  if [[ -f "${pid_file}" ]]; then
    local old_pid
    old_pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if pid_alive "${old_pid}"; then
      echo "[${name}] đang chạy (pid ${old_pid}) — bỏ qua"
      return 0
    fi
    rm -f "${pid_file}"
  fi

  if [[ -n "${port}" ]] && is_listening "${port}"; then
    echo "[${name}] cổng ${port} đã có process khác — dừng trước (pnpm dev:down) hoặc đổi cổng"
    return 1
  fi

  echo "[${name}] starting → log ${log_file}"
  (
    cd "${ROOT}"
    # shellcheck disable=SC2086
    nohup env "${cmd[@]}" >>"${log_file}" 2>&1 &
    echo $! >"${pid_file}"
  )

  sleep 0.4
  local pid
  pid="$(cat "${pid_file}")"
  if ! pid_alive "${pid}"; then
    echo "[${name}] thất bại khi start — xem ${log_file}"
    return 1
  fi
  echo "[${name}] ok (pid ${pid})"
}

# Đảm bảo dist API có sẵn và cập nhật (start = node dist, không watch)
api_dist="${ROOT}/apps/api/dist/main.js"
if [[ ! -f "${api_dist}" ]] || find "${ROOT}/apps/api/src" -name '*.ts' -newer "${api_dist}" -print -quit | grep -q .; then
  echo "[api] đang build (dist thiếu hoặc source mới hơn)…"
  (cd "${ROOT}" && pnpm --filter @erp/api build)
fi
if [[ ! -f "${ROOT}/apps/worker/dist/main.js" ]]; then
  echo "[worker] chưa có dist — đang build…"
  (cd "${ROOT}" && pnpm --filter @erp/worker build)
fi

echo "[redis] ${REDIS_HOST}:${REDIS_PORT} (từ .env)"

start_one api "${API_PORT}" \
  API_PORT="${API_PORT}" \
  REDIS_HOST="${REDIS_HOST}" \
  REDIS_PORT="${REDIS_PORT}" \
  REDIS_PASSWORD="${REDIS_PASSWORD}" \
  pnpm --filter @erp/api start

start_one web "${WEB_PORT}" \
  API_PORT="${API_PORT}" \
  pnpm --filter @erp/web exec vite --host "${WEB_HOST}" --port "${WEB_PORT}"

start_one worker "" \
  REDIS_HOST="${REDIS_HOST}" \
  REDIS_PORT="${REDIS_PORT}" \
  REDIS_PASSWORD="${REDIS_PASSWORD}" \
  pnpm --filter @erp/worker start

echo
echo "Dev servers đã tách khỏi Cursor Agent Shell."
echo "  Web: http://${WEB_HOST}:${WEB_PORT}/"
echo "  API: http://127.0.0.1:${API_PORT}/api/health"
echo "  Redis: ${REDIS_HOST}:${REDIS_PORT}"
echo "  Status: pnpm dev:status"
echo "  Stop:   pnpm dev:down"
echo "  Logs:   ${RUNTIME_DIR}/*.log"
