#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required at runtime."
  echo "Link your PostgreSQL service on Railway before starting the app."
  exit 1
fi

echo "Applying database schema..."
npx prisma db push --skip-generate

echo "Starting Next.js..."
exec npx next start
