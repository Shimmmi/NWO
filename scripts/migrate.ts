import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-dynamodb";
import { dynamoClient, TABLE } from "../lib/db";

for (const envFile of [".env.docker.prod", ".env.local", ".env.docker", ".env"]) {
  const path = resolve(process.cwd(), envFile);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
  break;
}

const tables = [
  {
    TableName: TABLE.USERS,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "email", AttributeType: "S" as const },
      { AttributeName: "nickname", AttributeType: "S" as const },
    ],
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" as const }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "email-index",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" as const }],
        Projection: { ProjectionType: "ALL" as const },
      },
      {
        IndexName: "nickname-index",
        KeySchema: [{ AttributeName: "nickname", KeyType: "HASH" as const }],
        Projection: { ProjectionType: "ALL" as const },
      },
    ],
  },
  {
    TableName: TABLE.MATCHES,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "matchId", AttributeType: "S" as const },
      { AttributeName: "status", AttributeType: "S" as const },
      { AttributeName: "createdAt", AttributeType: "S" as const },
    ],
    KeySchema: [{ AttributeName: "matchId", KeyType: "HASH" as const }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "status-createdAt-index",
        KeySchema: [
          { AttributeName: "status", KeyType: "HASH" as const },
          { AttributeName: "createdAt", KeyType: "RANGE" as const },
        ],
        Projection: { ProjectionType: "ALL" as const },
      },
    ],
  },
  {
    TableName: TABLE.DECKS,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "deckId", AttributeType: "S" as const },
      { AttributeName: "userId", AttributeType: "S" as const },
    ],
    KeySchema: [{ AttributeName: "deckId", KeyType: "HASH" as const }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" as const }],
        Projection: { ProjectionType: "ALL" as const },
      },
    ],
  },
  {
    TableName: TABLE.FRIENDS,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "friendId", AttributeType: "S" as const },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "friendId", KeyType: "RANGE" as const },
    ],
  },
  {
    TableName: TABLE.COLLECTION,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "cardId", AttributeType: "S" as const },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "cardId", KeyType: "RANGE" as const },
    ],
  },
  {
    TableName: TABLE.PACKS,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "packInstanceId", AttributeType: "S" as const },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "packInstanceId", KeyType: "RANGE" as const },
    ],
  },
  {
    TableName: TABLE.LEDGER,
    BillingMode: "PAY_PER_REQUEST" as const,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "entryId", AttributeType: "S" as const },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "entryId", KeyType: "RANGE" as const },
    ],
  },
];

/**
 * Индексы, которых может не быть на уже созданных таблицах.
 * CreateTable выше добавит их сразу на чистой базе, здесь — догоняем существующие.
 */
const lateIndexes = [
  {
    TableName: TABLE.USERS,
    IndexName: "nickname-index",
    AttributeDefinitions: [
      { AttributeName: "nickname", AttributeType: "S" as const },
    ],
    KeySchema: [{ AttributeName: "nickname", KeyType: "HASH" as const }],
    Projection: { ProjectionType: "ALL" as const },
  },
];

async function ensureIndexes() {
  for (const index of lateIndexes) {
    const described = await dynamoClient.send(
      new DescribeTableCommand({ TableName: index.TableName })
    );
    const present = (described.Table?.GlobalSecondaryIndexes ?? []).some(
      (gsi) => gsi.IndexName === index.IndexName
    );
    if (present) {
      console.log(`Exists ${index.TableName}.${index.IndexName}`);
      continue;
    }

    try {
      await dynamoClient.send(
        new UpdateTableCommand({
          TableName: index.TableName,
          AttributeDefinitions: index.AttributeDefinitions,
          GlobalSecondaryIndexUpdates: [
            {
              Create: {
                IndexName: index.IndexName,
                KeySchema: index.KeySchema,
                Projection: index.Projection,
              },
            },
          ],
        })
      );
      console.log(`Created ${index.TableName}.${index.IndexName}`);
    } catch (e: unknown) {
      const err = e as { name?: string };
      // Индекс уже создаётся — параллельный запуск миграции, не ошибка.
      if (err.name === "ResourceInUseException") {
        console.log(`Pending ${index.TableName}.${index.IndexName}`);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  for (const table of tables) {
    try {
      await dynamoClient.send(new CreateTableCommand(table));
      console.log(`Created ${table.TableName}`);
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === "ResourceInUseException") {
        console.log(`Exists ${table.TableName}`);
      } else {
        throw e;
      }
    }
  }

  await ensureIndexes();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
