#!/bin/sh
set -eu

mkdir -p /app/data /app/uploads
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
