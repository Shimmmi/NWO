import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { generateId } from "@/lib/auth";
import { db, TABLE } from "@/lib/db";
import {
  normalizeUser,
  type CollectionItem,
  type EconomyLedgerEntry,
  type EconomyLedgerKind,
  type PackInventoryItem,
  type UserRecord,
} from "@/lib/schema";
import { findUserById, findUserByIdSafe, updateMemoryUser, updateUserStats } from "@/lib/models";
import { ECONOMY } from "@/lib/shop/economy";
import type { PackOpenResult } from "@/lib/shop/packRoll";
import { buildStarterGrants, STARTER_FREE_PACK_SKU } from "@/lib/shop/starterKit";

/* ── In-memory fallbacks (local/dev without Dynamo) ─────────────── */

const memoryCollection = new Map<string, CollectionItem>();
const memoryPacks = new Map<string, PackInventoryItem>();
const memoryLedger = new Map<string, EconomyLedgerEntry>();
const memoryIdempotency = new Map<string, unknown>();

const collKey = (userId: string, cardId: string) => `${userId}#${cardId}`;
const packKey = (userId: string, packInstanceId: string) =>
  `${userId}#${packInstanceId}`;

/* ── Collection ─────────────────────────────────────────────────── */

export async function listCollection(userId: string): Promise<CollectionItem[]> {
  const result = await db.send(
    new QueryCommand({
      TableName: TABLE.COLLECTION,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    }),
  );
  return (result.Items as CollectionItem[] | undefined) ?? [];
}

export async function listCollectionSafe(userId: string): Promise<CollectionItem[]> {
  try {
    return await listCollection(userId);
  } catch {
    return [...memoryCollection.values()].filter((i) => i.userId === userId);
  }
}

export async function getCollectionItem(
  userId: string,
  cardId: string,
): Promise<CollectionItem | null> {
  const result = await db.send(
    new GetCommand({
      TableName: TABLE.COLLECTION,
      Key: { userId, cardId },
    }),
  );
  return (result.Item as CollectionItem | undefined) ?? null;
}

export async function incrementCard(
  userId: string,
  cardId: string,
  delta: number,
): Promise<CollectionItem> {
  const now = new Date().toISOString();
  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: TABLE.COLLECTION,
        Key: { userId, cardId },
        UpdateExpression:
          "SET #count = if_not_exists(#count, :zero) + :delta, updatedAt = :now, firstObtainedAt = if_not_exists(firstObtainedAt, :now)",
        ExpressionAttributeNames: { "#count": "count" },
        ExpressionAttributeValues: {
          ":delta": delta,
          ":zero": 0,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return result.Attributes as CollectionItem;
  } catch {
    const key = collKey(userId, cardId);
    const prev = memoryCollection.get(key);
    const next: CollectionItem = {
      userId,
      cardId,
      count: (prev?.count ?? 0) + delta,
      firstObtainedAt: prev?.firstObtainedAt ?? now,
      updatedAt: now,
    };
    if (next.count <= 0) memoryCollection.delete(key);
    else memoryCollection.set(key, next);
    return next;
  }
}

export async function decrementCardOrThrow(
  userId: string,
  cardId: string,
  delta: number,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE.COLLECTION,
        Key: { userId, cardId },
        UpdateExpression: "SET #count = #count - :delta, updatedAt = :now",
        ConditionExpression: "#count >= :delta",
        ExpressionAttributeNames: { "#count": "count" },
        ExpressionAttributeValues: { ":delta": delta, ":now": now },
      }),
    );
  } catch (err) {
    const key = collKey(userId, cardId);
    const prev = memoryCollection.get(key);
    if (!prev || prev.count < delta) throw err;
    const nextCount = prev.count - delta;
    if (nextCount <= 0) memoryCollection.delete(key);
    else
      memoryCollection.set(key, {
        ...prev,
        count: nextCount,
        updatedAt: now,
      });
  }
}

/* ── Packs ──────────────────────────────────────────────────────── */

export async function grantPack(
  userId: string,
  skuId: string,
  source: PackInventoryItem["source"],
): Promise<PackInventoryItem> {
  const item: PackInventoryItem = {
    userId,
    packInstanceId: generateId("pack"),
    skuId,
    source,
    createdAt: new Date().toISOString(),
  };
  try {
    await db.send(new PutCommand({ TableName: TABLE.PACKS, Item: item }));
  } catch {
    memoryPacks.set(packKey(userId, item.packInstanceId), item);
  }
  return item;
}

export async function listPacks(userId: string): Promise<PackInventoryItem[]> {
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: TABLE.PACKS,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      }),
    );
    return (result.Items as PackInventoryItem[] | undefined) ?? [];
  } catch {
    return [...memoryPacks.values()].filter((p) => p.userId === userId);
  }
}

export async function getPack(
  userId: string,
  packInstanceId: string,
): Promise<PackInventoryItem | null> {
  try {
    const result = await db.send(
      new GetCommand({
        TableName: TABLE.PACKS,
        Key: { userId, packInstanceId },
      }),
    );
    return (result.Item as PackInventoryItem | undefined) ?? null;
  } catch {
    return memoryPacks.get(packKey(userId, packInstanceId)) ?? null;
  }
}

export async function consumePack(
  userId: string,
  packInstanceId: string,
): Promise<boolean> {
  try {
    await db.send(
      new DeleteCommand({
        TableName: TABLE.PACKS,
        Key: { userId, packInstanceId },
        ConditionExpression: "attribute_exists(packInstanceId)",
      }),
    );
    return true;
  } catch {
    const key = packKey(userId, packInstanceId);
    if (!memoryPacks.has(key)) return false;
    memoryPacks.delete(key);
    return true;
  }
}

/* ── Credits / pity ─────────────────────────────────────────────── */

export async function adjustCredits(
  userId: string,
  delta: number,
  opts?: { requireNonNegative?: boolean },
): Promise<number> {
  const requireNonNegative = opts?.requireNonNegative ?? delta < 0;
  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: TABLE.USERS,
        Key: { userId },
        UpdateExpression:
          "SET credits = if_not_exists(credits, :zero) + :delta, updatedAt = :now",
        ConditionExpression: requireNonNegative
          ? "if_not_exists(credits, :zero) >= :need"
          : undefined,
        ExpressionAttributeValues: {
          ":delta": delta,
          ":zero": 0,
          ":now": new Date().toISOString(),
          ...(requireNonNegative ? { ":need": Math.abs(delta) } : {}),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return (result.Attributes as UserRecord).credits ?? 0;
  } catch (err) {
    // Fallback: mutate via find + updateUserStats path used in memory mode
    const user = await findUserByIdSafe(userId);
    if (!user) throw err;
    const credits = (user.credits ?? 0) + delta;
    if (requireNonNegative && credits < 0) throw err;
    await updateUserEconomySafe(userId, { credits });
    return credits;
  }
}

export async function updateUserEconomySafe(
  userId: string,
  updates: Partial<
    Pick<
      UserRecord,
      | "credits"
      | "legendaryPity"
      | "starterGranted"
      | "lastDailyGrantAt"
      | "xp"
      | "level"
      | "rating"
      | "wins"
      | "losses"
    >
  >,
): Promise<void> {
  try {
    await updateUserStats(userId, updates);
  } catch {
    updateMemoryUser(userId, updates);
  }
  // Always mirror into memory if present (hybrid local)
  updateMemoryUser(userId, updates);
}

export async function setLegendaryPity(
  userId: string,
  pity: number,
): Promise<void> {
  await updateUserEconomySafe(userId, { legendaryPity: pity });
}

/* ── Ledger / idempotency ───────────────────────────────────────── */

export async function writeLedger(
  userId: string,
  kind: EconomyLedgerKind,
  deltaCredits?: number,
  meta?: Record<string, unknown>,
): Promise<void> {
  const entry: EconomyLedgerEntry = {
    userId,
    entryId: generateId("led"),
    kind,
    deltaCredits,
    meta,
    createdAt: new Date().toISOString(),
  };
  try {
    await db.send(new PutCommand({ TableName: TABLE.LEDGER, Item: entry }));
  } catch {
    memoryLedger.set(`${userId}#${entry.entryId}`, entry);
  }
}

export function getIdempotentResult<T>(key: string): T | undefined {
  return memoryIdempotency.get(key) as T | undefined;
}

export function setIdempotentResult(key: string, value: unknown): void {
  memoryIdempotency.set(key, value);
  // Soft TTL: drop after 24h wall clock via timestamp wrapper would be nicer;
  // process restart clears it which is fine for local.
}

/* ── Grant open results into collection ─────────────────────────── */

export async function applyPackOpenToCollection(
  userId: string,
  result: PackOpenResult,
): Promise<void> {
  for (const card of result.cards) {
    await incrementCard(userId, card.cardId, 1);
  }
  await setLegendaryPity(userId, result.pityAfter);
  await writeLedger(userId, "pack_open", 0, {
    packInstanceId: result.packInstanceId,
    skuId: result.skuId,
    cards: result.cards.map((c) => c.cardId),
  });
}

/* ── Starter kit ────────────────────────────────────────────────── */

export async function grantStarterKit(userId: string): Promise<void> {
  const user = await findUserByIdSafe(userId);
  if (!user) return;
  const n = normalizeUser(user);
  if (n.starterGranted) return;

  for (const g of buildStarterGrants()) {
    await incrementCard(userId, g.cardId, g.count);
  }
  await grantPack(userId, STARTER_FREE_PACK_SKU, "starter");
  await updateUserEconomySafe(userId, {
    credits: ECONOMY.STARTING_CREDITS,
    starterGranted: true,
    legendaryPity: n.legendaryPity ?? 0,
  });
  await writeLedger(userId, "starter", ECONOMY.STARTING_CREDITS, {
    cards: buildStarterGrants().length,
  });
}

export async function ownedCountsMap(
  userId: string,
): Promise<Map<string, number>> {
  const items = await listCollectionSafe(userId);
  return new Map(items.map((i) => [i.cardId, i.count]));
}

/** Ensure user row has economy defaults when read. */
export async function ensureEconomyFields(
  user: UserRecord,
): Promise<UserRecord> {
  const n = normalizeUser(user);
  if (
    user.credits === undefined ||
    user.legendaryPity === undefined
  ) {
    await updateUserEconomySafe(user.userId, {
      credits: n.credits,
      legendaryPity: n.legendaryPity,
    });
  }
  return n;
}

// re-export find for shop routes
export { findUserById, findUserByIdSafe };
