#!/bin/sh
set -eu

# Prisma resolves SQLite paths relative to prisma/schema.prisma unless the
# file URI is absolute. Pin the volume path so admin edits survive restarts.
export DATABASE_URL="file:///app/data/portfolio.db"

mkdir -p /app/data /app/uploads

# Rescue a DB that was previously written next to the schema (not on the volume).
if [ ! -s /app/data/portfolio.db ]; then
  for stray in /app/prisma/data/portfolio.db /app/prisma/app/data/portfolio.db; do
    if [ -s "$stray" ]; then
      echo "[entrypoint] moving $stray -> /app/data/portfolio.db"
      cp "$stray" /app/data/portfolio.db
      [ -f "${stray}-wal" ] && cp "${stray}-wal" /app/data/portfolio.db-wal
      [ -f "${stray}-shm" ] && cp "${stray}-shm" /app/data/portfolio.db-shm
      break
    fi
  done
fi

chown -R app:app /app/data /app/uploads

# Apply schema without generating a new client (already baked into the image).
gosu app npx prisma db push --skip-generate

case "${1:-web}" in
  web)
    gosu app node dist/seed.js
    exec gosu app node dist/index.js
    ;;
  bot)
    exec gosu app node dist/bot.js
    ;;
  cli)
    shift
    exec gosu app node dist/cli.js "$@"
    ;;
  *)
    exec gosu app "$@"
    ;;
esac
