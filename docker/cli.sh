#!/bin/sh
set -eu
cd /app
exec gosu app node /app/dist/cli.js "$@"
