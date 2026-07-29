#!/bin/bash
# Smoke tests for WORLD ORDER (local or production via SMOKE_BASE / SMOKE_WS)
set -euo pipefail

BASE="${SMOKE_BASE:-http://localhost:3000/nwo}"
# WebSocket теперь same-origin: тот же порт, путь /nwo/ws.
WS_URL="${SMOKE_WS:-ws://127.0.0.1:3000/nwo/ws}"
WAIFU_HEALTH="${WAIFU_HEALTH_URL:-http://127.0.0.1:8001/health}"
WAIFU_WEBAPP="${WAIFU_WEBAPP_URL:-https://shimmirpgbot.ru/webapp/index.html}"
COOKIE=/tmp/nwo_smoke_c.txt

echo "==> 1. Health"
curl -sf "$BASE/api/health" | grep -q '"status":"ok"'

echo "==> 2. Demo auth + session"
curl -sf -c "$COOKIE" -X POST "$BASE/api/auth/demo" | grep -q '"nickname"'
curl -sf -b "$COOKIE" "$BASE/api/auth/me" | grep -q '"userId"'
grep -q "/nwo" "$COOKIE"

echo "==> 3. Home page"
curl -sf -o /dev/null -w '%{http_code}' "${BASE%/}" | grep -qE '^200$'

echo "==> 4. Characters page (authenticated)"
curl -sf -b "$COOKIE" -o /dev/null -w '%{http_code}' "${BASE%/}/characters" | grep -qE '^200$'

echo "==> 5. Deck save"
curl -sf -b "$COOKIE" -X POST "$BASE/api/decks" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Deck","characterId":"donald-rumpf","cardIds":["dr-tweet","dr-wall","dr-tariff","dr-rally","dr-deal","dr-fake-news","dr-ban","dr-sanctions","dr-media","dr-golf","dr-executive","dr-trade-war","dr-veto","dr-fire","dr-maga-hat","dr-twitter-ban","dr-wall-2","dr-nuclear","dr-maga-phoenix","dr-impeach"]}' \
  | grep -q '"deckId"'

echo "==> 6. AI game"
USER_JSON=$(curl -sf -b "$COOKIE" "$BASE/api/auth/me")
USER_ID=$(echo "$USER_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['userId'])")
NICK=$(echo "$USER_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['nickname'])")
MATCH=$(curl -sf -b "$COOKIE" -X POST "$BASE/api/game" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$USER_ID\",\"playerNickname\":\"$NICK\",\"characterId\":\"donald-rumpf\",\"vsAi\":true}")
echo "$MATCH" | grep -q '"status":"in_progress"'

echo "==> 7. WebSocket auth"
TOKEN=$(grep session "$COOKIE" | awk '{print $7}')
node -e "
const WebSocket=require('ws');
const ws=new WebSocket(process.argv[1]);
ws.on('open',()=>ws.send(JSON.stringify({type:'auth',payload:{token:process.argv[2]}})));
ws.on('message',d=>{const m=JSON.parse(d.toString()); if(m.type!=='auth_ok') process.exit(1); ws.close(); process.exit(0);});
setTimeout(()=>process.exit(1),10000);
" "$WS_URL" "$TOKEN"

echo "==> 8. waifu-bot regression (health + webapp headers)"
curl -sf "$WAIFU_HEALTH" | grep -q '"status":"ok"'
curl -sfI "$WAIFU_WEBAPP" | grep -qi 'content-security-policy.*frame-ancestors'

echo "==> All smoke tests passed"
