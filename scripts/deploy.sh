#!/usr/bin/env bash
#
# Script deploy chạy trên máy chủ (qua self-hosted GitHub Actions runner hoặc chạy tay).
# Nhiệm vụ: nạp env production -> cài deps -> build -> migrate DB -> reload PM2 -> publish web cho nginx.
#
# Biến môi trường tuỳ chọn:
#   ENV_FILE       Đường dẫn file .env production (mặc định: $HOME/erp/.env)
#   WEB_ROOT       Thư mục nginx phục vụ static web (mặc định: /var/www/erp)
#   RELOAD_NGINX   "true" để chạy `sudo nginx -s reload` sau khi publish (mặc định: false)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$HOME/erp/.env}"
WEB_ROOT="${WEB_ROOT:-/var/www/erp}"
RELOAD_NGINX="${RELOAD_NGINX:-false}"

echo "==> Repo:      $ROOT"
echo "==> ENV_FILE:  $ENV_FILE"
echo "==> WEB_ROOT:  $WEB_ROOT"

# --- 1. Nạp env production ---------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "!! Không tìm thấy file env production: $ENV_FILE" >&2
  echo "   Tạo file này trên máy chủ (tham khảo .env.production.example)." >&2
  exit 1
fi
# Liên kết .env ở gốc repo tới file production để api/worker đọc được.
ln -sf "$ENV_FILE" "$ROOT/.env"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# --- 2. Cài dependencies ----------------------------------------------------
corepack enable >/dev/null 2>&1 || true
echo "==> pnpm install"
pnpm install --frozen-lockfile

# --- 3. Build packages + prisma client --------------------------------------
echo "==> Prisma generate"
pnpm exec prisma generate

echo "==> Build shared packages"
pnpm --filter @erp/shared build
pnpm --filter @erp/organization-io build
pnpm --filter @erp/employee-io build

# --- 4. Migrate database ----------------------------------------------------
echo "==> Prisma migrate deploy"
pnpm exec prisma migrate deploy

# --- 5. Build apps ----------------------------------------------------------
echo "==> Build api / worker / web"
pnpm --filter @erp/api build
pnpm --filter @erp/worker build
pnpm --filter @erp/web build

# --- 6. Publish web tĩnh cho nginx ------------------------------------------
echo "==> Publish web -> $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete "$ROOT/apps/web/dist/" "$WEB_ROOT/"

# Ảnh đại diện: giữ uploads trong repo, symlink để nginx phục vụ /uploads/
UPLOADS_DIR="${UPLOADS_DIR:-$ROOT/uploads}"
UPLOADS_WEB_ROOT="${UPLOADS_WEB_ROOT:-/var/www/erp-uploads}"
mkdir -p "$UPLOADS_DIR"
if [ ! -e "$UPLOADS_WEB_ROOT" ] && [ ! -L "$UPLOADS_WEB_ROOT" ]; then
  ln -sfn "$UPLOADS_DIR" "$UPLOADS_WEB_ROOT" || true
fi
echo "==> Uploads:  $UPLOADS_DIR (nginx alias: $UPLOADS_WEB_ROOT)"

if [ "$RELOAD_NGINX" = "true" ]; then
  echo "==> Reload nginx"
  sudo nginx -t && sudo nginx -s reload
fi

# --- 7. Reload tiến trình bằng PM2 ------------------------------------------
echo "==> PM2 startOrReload"
pm2 startOrReload "$ROOT/ecosystem.config.cjs" --update-env
pm2 save

echo "==> Deploy hoàn tất."
