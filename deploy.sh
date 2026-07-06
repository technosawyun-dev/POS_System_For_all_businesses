#!/usr/bin/env bash
set -euo pipefail

cd /home/POS_System_For_all_businesses

echo "==> Pulling latest main"
git pull origin main

echo "==> Rebuilding and restarting changed containers"
docker compose up -d --build

echo "==> Reloading nginx config (docker compose up only recreates a container"
echo "    when its own service definition changes, not when a bind-mounted"
echo "    config file underneath it changes — so config edits need an explicit"
echo "    reload or they silently keep running on stale config)"
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload

echo "==> Waiting for api to be healthy"
for i in $(seq 1 30); do
  status=$(docker inspect pos_api --format '{{.State.Health.Status}}' 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 2
done

echo "==> Running database migrations"
docker compose exec -T api alembic upgrade head

echo "==> Deploy complete"
docker compose ps
