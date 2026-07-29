#!/bin/bash
# Deploy WORLD ORDER to shimmirpgbot.ru (parallel stack — does NOT restart waifu-bot).
set -euo pipefail

HOST="${DEPLOY_HOST:-shimmirpgbot.ru}"
USER="${DEPLOY_USER:-ubuntu}"
REPO_DIR="${DEPLOY_REPO_DIR:-/opt/NWO}"
BRANCH="${DEPLOY_BRANCH:-main}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
COMPOSE="docker compose -p nwo -f docker-compose.prod.yml"
HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-120}"

deploy_on_host() {
  set -euo pipefail
  cd "${REPO_DIR}"

  if [ ! -f .env.docker.prod ]; then
    echo "ERROR: ${REPO_DIR}/.env.docker.prod missing. Copy from .env.docker.prod.example and set Yandex keys." >&2
    exit 1
  fi

  if [ -d .git ]; then
    git fetch origin "${BRANCH}" 2>/dev/null || true
    git checkout "${BRANCH}" 2>/dev/null || true
    git pull --ff-only origin "${BRANCH}" 2>/dev/null || true
  fi

  echo "==> Build and start NWO containers (project: nwo)"
  set -a
  # shellcheck disable=SC1091
  source .env.docker.prod
  set +a

  # Валидация компоуза до сборки: опечатка в yaml не должна ронять живой стек.
  ${COMPOSE} config >/dev/null

  ${COMPOSE} up -d --build

  echo "==> Wait for app container to become healthy (up to ${HEALTH_TIMEOUT}s)"
  APP_CID="$(${COMPOSE} ps -q app)"
  if [ -z "${APP_CID}" ]; then
    echo "ERROR: app container not found after 'up -d'." >&2
    exit 1
  fi

  DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT ))
  while :; do
    STATE="$(docker inspect -f '{{.State.Health.Status}}' "${APP_CID}" 2>/dev/null || echo unknown)"
    case "${STATE}" in
      healthy)
        echo "==> app is healthy"
        break
        ;;
      unhealthy)
        echo "ERROR: app container is unhealthy. Last logs:" >&2
        ${COMPOSE} logs --tail 80 app >&2
        exit 1
        ;;
    esac
    if [ "$(date +%s)" -ge "${DEADLINE}" ]; then
      echo "ERROR: app did not become healthy in ${HEALTH_TIMEOUT}s (state: ${STATE}). Last logs:" >&2
      ${COMPOSE} logs --tail 80 app >&2
      exit 1
    fi
    sleep 3
  done

  echo "==> Run DB migration (Yandex DynamoDB)"
  ${COMPOSE} exec -T app npx tsx scripts/migrate.ts

  echo "==> NWO health check"
  curl -sf http://127.0.0.1:3000/nwo/api/health
  echo ""

  echo "==> waifu-bot health check (read-only, no restart)"
  curl -sf http://127.0.0.1:8001/health
  echo ""

  # nginx перезагружается только сейчас, когда контейнер уже здоров: иначе есть
  # окно, в котором /nwo/ws проксируется в никуда.
  echo "==> Done. Load nginx snippet from infra/nginx/nwo-snippet.conf, then:"
  echo "    sudo nginx -t && sudo systemctl reload nginx   (never restart — file is shared with waifu-bot and aerocalc)"
}

# If already on the target host, deploy locally (no SSH loop).
LOCAL_HOST="${DEPLOY_LOCAL_HOST:-waifu-bot.novalocal}"
if [ "${DEPLOY_LOCAL:-}" = "1" ] || [ "$(hostname -f 2>/dev/null || hostname)" = "$LOCAL_HOST" ] || [ -f /opt/NWO/.env.docker.prod ]; then
  echo "==> Local deploy on ${REPO_DIR}"
  deploy_on_host
  echo "==> Deploy complete"
  exit 0
fi

echo "==> Deploying WORLD ORDER ${BRANCH} to ${USER}@${HOST}:${REPO_DIR}"

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -s <<EOF
set -euo pipefail
REPO_DIR="${REPO_DIR}"
BRANCH="${BRANCH}"
COMPOSE="${COMPOSE}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT}"
$(declare -f deploy_on_host)
deploy_on_host
EOF

echo "==> Deploy complete"
