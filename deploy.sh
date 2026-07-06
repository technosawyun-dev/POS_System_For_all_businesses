#!/usr/bin/env bash
set -euo pipefail

cd /home/POS_System_For_all_businesses

echo "==> Syncing to latest main"
# Force-sync tracked files to origin/main instead of a plain `git pull`.
# This deploy runs non-interactively over SSH from CI, so anything short of
# a hard reset can leave it stuck requiring manual intervention: a plain pull
# aborts if this checkout has picked up local drift on any tracked file, e.g.
# an untracked file that collides with one just added upstream, or a file
# edited directly on the VPS (both have happened here already: an untracked
# deploy.sh blocking its own first commit, then a manual chmod +x on it
# blocking the very next push). `reset --hard` always makes the tracked
# working tree match origin exactly, no matter what state it drifted into.
# It never touches untracked files, so .env/uploads/logs are always safe.
git fetch origin main
git reset --hard origin/main

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
