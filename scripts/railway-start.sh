#!/usr/bin/env bash
set -e

echo "[railway-start] Node: $(node -v)"

# Пытаемся создать таблицы, но не роняем все приложение, если база еще не готова
if [ -n "$DATABASE_URL" ]; then
  echo "[railway-start] Initializing database schema..."
  npx drizzle-kit push --force || echo "[railway-start] DB Push failed, but continuing..."
else
  echo "[railway-start] WARNING: DATABASE_URL is not set"
fi

echo "[railway-start] Starting Next.js..."
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
