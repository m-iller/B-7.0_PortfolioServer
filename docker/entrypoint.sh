#!/bin/sh
set -eu

mkdir -p /app/data /app/uploads /app/data/dnd

case "${1:-web}" in
  web)
    # Prisma resolves SQLite paths relative to prisma/schema.prisma unless the
    # file URI is absolute. Pin the volume path so admin edits survive restarts.
    export DATABASE_URL="file:///app/data/portfolio.db"

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
    gosu app npx prisma db push --skip-generate
    gosu app node dist/seed.js
    exec gosu app node dist/index.js
    ;;
  bot)
    chown -R app:app /app/data
    exec gosu app node dist/bot.js
    ;;
  cli)
    export DATABASE_URL="file:///app/data/portfolio.db"
    chown -R app:app /app/data /app/uploads
    gosu app npx prisma db push --skip-generate
    shift
    exec gosu app node dist/cli.js "$@"
    ;;
  *)
    exec gosu app "$@"
    ;;
esac
