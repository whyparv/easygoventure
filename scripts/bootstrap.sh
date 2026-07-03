#!/usr/bin/env bash
# Bootstrap the DMC CRM monorepo for local development.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "▶ Installing workspace dependencies…"
npm install

echo "▶ Preparing environment files…"
[ -f backend/.env ] || cp backend/.env.development backend/.env
[ -f frontend/.env ] || cp frontend/.env.development frontend/.env

echo "▶ Starting infrastructure (redis)…"
docker compose -f docker/docker-compose.yml up -d redis

echo "▶ Seeding RBAC roles (MongoDB)…"
npm run seed -w backend || true

echo "✅ Bootstrap complete. Run 'npm run dev' to start backend + frontend."
echo "   MongoDB connection is read from backend/.env (MONGODB_URI)."
