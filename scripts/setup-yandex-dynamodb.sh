#!/bin/bash
# Create Yandex Cloud static access keys for NWO Document API (DynamoDB-compatible).
# Requires: yc CLI configured (yc init) OR YC_TOKEN / YC_OAUTH_TOKEN env var.
#
# Usage:
#   export YC_FOLDER_ID=b1g...
#   ./scripts/setup-yandex-dynamodb.sh
#
# Writes AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY into .env.docker.prod (or updates in place).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${REPO_DIR}/.env.docker.prod"
SA_NAME="${NWO_SA_NAME:-nwo-dynamodb-sa}"
FOLDER_ID="${YC_FOLDER_ID:-}"

if ! command -v yc >/dev/null 2>&1; then
  echo "==> Installing yc CLI..."
  curl -sS https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash -s -- -i /usr/local/yandex-cloud -n
  export PATH="/usr/local/yandex-cloud/bin:$PATH"
fi

if [ -z "$FOLDER_ID" ]; then
  FOLDER_ID=$(yc config get folder-id 2>/dev/null || true)
fi

if [ -z "$FOLDER_ID" ]; then
  echo "ERROR: Set YC_FOLDER_ID or run 'yc init' first." >&2
  exit 1
fi

echo "==> Using folder: $FOLDER_ID"

SA_ID=$(yc iam service-account list --folder-id "$FOLDER_ID" --format json \
  | python3 -c "import sys,json; sa=[x for x in json.load(sys.stdin) if x.get('name')=='${SA_NAME}']; print(sa[0]['id'] if sa else '')")

if [ -z "$SA_ID" ]; then
  echo "==> Creating service account: $SA_NAME"
  SA_ID=$(yc iam service-account create --name "$SA_NAME" --folder-id "$FOLDER_ID" --format json \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
fi

echo "==> Service account: $SA_ID"

for ROLE in ydb.editor storage.editor; do
  yc resource-manager folder add-access-binding "$FOLDER_ID" \
    --role "$ROLE" \
    --subject "serviceAccount:$SA_ID" 2>/dev/null || true
done

# Document API uses DynamoDB-compatible API — editor on YDB/document store
yc resource-manager folder add-access-binding "$FOLDER_ID" \
  --role "editor" \
  --subject "serviceAccount:$SA_ID" 2>/dev/null || true

echo "==> Creating static access key..."
KEY_JSON=$(yc iam access-key create --service-account-id "$SA_ID" --format json)
ACCESS_KEY=$(echo "$KEY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_key']['key_id'])")
SECRET_KEY=$(echo "$KEY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret'])")

DB_NAME="${NWO_DB_NAME:-nwo-world-order}"
DB_ID=$(yc ydb database list --folder-id "$FOLDER_ID" --format json \
  | python3 -c "import sys,json; dbs=[x for x in json.load(sys.stdin) if x.get('name')=='${DB_NAME}']; print(dbs[0]['id'] if dbs else '')")

if [ -z "$DB_ID" ]; then
  echo "==> Creating serverless YDB database: $DB_NAME"
  DB_ID=$(yc ydb database create --serverless --name "$DB_NAME" --folder-id "$FOLDER_ID" --format json \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "==> Waiting for database to become RUNNING..."
  sleep 15
fi

DOC_ENDPOINT=$(yc ydb database get "$DB_ID" --format json \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('document_api_endpoint',''))")

if [ -z "$DOC_ENDPOINT" ]; then
  echo "ERROR: Could not read Document API endpoint for database $DB_ID" >&2
  exit 1
fi

echo "==> Document API endpoint: $DOC_ENDPOINT"

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -hex 32)}"

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
fi

cat > "$ENV_FILE" <<EOF
NODE_ENV=production
AUTH_SECRET=${AUTH_SECRET}
PORT=3000
REDIS_URL=redis://redis:6379
AWS_ACCESS_KEY_ID=${ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${SECRET_KEY}
AWS_REGION=ru-central1
DYNAMODB_ENDPOINT=${DOC_ENDPOINT}
COOKIE_SECURE=true
EOF

chmod 600 "$ENV_FILE"
echo "==> Wrote ${ENV_FILE}"
echo "==> Run migrate: docker compose -p nwo -f docker-compose.prod.yml run --rm app npx tsx scripts/migrate.ts"
