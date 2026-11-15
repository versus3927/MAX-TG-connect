#!/usr/bin/env bash
set -euo pipefail

echo "[railway-start] Node: $(node -v)"
echo "[railway-start] PORT=${PORT:-3000} DATABASE_URL=$([ -n "${DATABASE_URL:-}" ] && echo set || echo missing) TELEGRAM_BOT_TOKEN=$([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo set || echo missing)"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[railway-start] Running drizzle-kit push..."
  npx drizzle-kit push --force
else
  echo "[railway-start] DATABASE_URL missing, skipping drizzle push"
fi

echo "[railway-start] Starting Next.js on 0.0.0.0:${PORT:-3000}"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
