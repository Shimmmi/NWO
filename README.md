# WORLD ORDER — Card Fighter

Deployed at `https://shimmirpgbot.ru/nwo` (requires nginx + Docker setup).

HTTP и WebSocket обслуживает один процесс — `server/app-server.ts` на порту 3000,
апгрейд идёт на путь `/nwo/ws`. Отдельного WS-сервера на 3001 больше нет.

## Requirements

- Node.js >= 20
- Docker for DynamoDB local and production
- Redis (опционально в dev: без `REDIS_URL` стор работает в памяти процесса)

## Development

```bash
npm install
cp .env.example .env.local
docker compose up dynamodb-local redis -d
npm run db:migrate
npm run dev
```

## Production

```bash
docker compose -p nwo -f docker-compose.prod.yml up -d --build
docker compose -p nwo -f docker-compose.prod.yml exec app npx tsx scripts/migrate.ts
```

Add `infra/nginx/nwo-snippet.conf` to nginx (включая `map $http_upgrade
$connection_upgrade` на уровне `http {}` — см. шапку файла), then
`./scripts/deploy.sh`.
