#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -d .git ]; then
  git pull origin master
fi

npm ci
npx prisma generate
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed

if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-enabled portfolio-web >/dev/null 2>&1; then
    systemctl restart portfolio-web
  fi
  if systemctl is-enabled portfolio-bot >/dev/null 2>&1; then
    systemctl restart portfolio-bot
  fi
fi

echo "[deploy] done. web + bot units restarted if they were enabled."
