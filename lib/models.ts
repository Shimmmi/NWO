import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "@/lib/db";
import type {
  DeckRecord,
  FriendRecord,
  MatchRecord,
  UserPublic,
  UserRecord,
} from "@/lib/schema";
import { toUserPublic } from "@/lib/schema";

export async function createUser(user: UserRecord): Promise<UserRecord> {
  await db.send(
    new PutCommand({
      TableName: TABLE.USERS,
      Item: user,
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await db.send(
    new QueryCommand({
      TableName: TABLE.USERS,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
      Limit: 1,
    })
  );
  return (result.Items?.[0] as UserRecord | undefined) ?? null;
}

export async function findUserById(userId: string): Promise<UserRecord | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLE.USERS, Key: { userId } })
  );
  return (result.Item as UserRecord | undefined) ?? null;
}

/** Один BatchGet вместо N Get — френд-панель читает сразу всех участников списка. */
export async function findUsersByIds(userIds: string[]): Promise<UserRecord[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];

  const found: UserRecord[] = [];
  // BatchGet принимает не больше 100 ключей за раз.
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const result = await db.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLE.USERS]: { Keys: chunk.map((userId) => ({ userId })) },
        },
      })
    );
    found.push(...((result.Responses?.[TABLE.USERS] as UserRecord[]) ?? []));
  }
  return found;
}

export async function updateUserStats(
  userId: string,
  updates: Partial<
    Pick<
      UserRecord,
      | "rating"
      | "wins"
      | "losses"
      | "xp"
      | "level"
      | "credits"
      | "legendaryPity"
      | "starterGranted"
      | "lastDailyGrantAt"
    >
  >,
): Promise<void> {
  const parts: string[] = ["updatedAt = :updatedAt"];
  const values: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      parts.push(`${key} = :${key}`);
      values[`:${key}`] = value;
    }
  }
  await db.send(
    new UpdateCommand({
      TableName: TABLE.USERS,
      Key: { userId },
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );
}

export async function createMatchRecord(record: MatchRecord): Promise<MatchRecord> {
  await db.send(new PutCommand({ TableName: TABLE.MATCHES, Item: record }));
  return record;
}

export async function updateMatchRecord(
  matchId: string,
  updates: Partial<MatchRecord>
): Promise<void> {
  const parts: string[] = [];
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && key !== "matchId") {
      parts.push(`${key} = :${key}`);
      values[`:${key}`] = value;
    }
  }
  if (parts.length === 0) return;
  await db.send(
    new UpdateCommand({
      TableName: TABLE.MATCHES,
      Key: { matchId },
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );
}

export async function listDecksByUser(userId: string): Promise<DeckRecord[]> {
  const result = await db.send(
    new QueryCommand({
      TableName: TABLE.DECKS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  return (result.Items as DeckRecord[] | undefined) ?? [];
}

export async function getDeckById(deckId: string): Promise<DeckRecord | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLE.DECKS, Key: { deckId } })
  );
  return (result.Item as DeckRecord | undefined) ?? null;
}

export async function createDeck(deck: DeckRecord): Promise<DeckRecord> {
  await db.send(new PutCommand({ TableName: TABLE.DECKS, Item: deck }));
  return deck;
}

export async function updateDeck(
  deckId: string,
  updates: Partial<Pick<DeckRecord, "name" | "cardIds" | "isValid">>
): Promise<DeckRecord | null> {
  const existing = await getDeckById(deckId);
  if (!existing) return null;
  const updated: DeckRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await db.send(new PutCommand({ TableName: TABLE.DECKS, Item: updated }));
  return updated;
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: TABLE.DECKS, Key: { deckId } }));
}

/* ------------------------------------------------------------------ *
 * Дружба
 * ------------------------------------------------------------------ */

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_RESULTS = 20;

/** Верхняя граница одного Scan-прохода при поиске по подстроке ника. */
const SEARCH_SCAN_LIMIT = 200;

export async function listFriends(userId: string): Promise<FriendRecord[]> {
  const result = await db.send(
    new QueryCommand({
      TableName: TABLE.FRIENDS,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  return (result.Items as FriendRecord[] | undefined) ?? [];
}

export async function getFriendEdge(
  userId: string,
  friendId: string
): Promise<FriendRecord | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLE.FRIENDS, Key: { userId, friendId } })
  );
  return (result.Item as FriendRecord | undefined) ?? null;
}

/**
 * Обе записи пары пишутся одной транзакцией: половинчатая дружба
 * (заявка есть у отправителя, но не у получателя) неисправима без ручной уборки.
 */
export async function sendFriendRequest(
  from: UserRecord,
  to: UserRecord
): Promise<void> {
  const now = new Date().toISOString();
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE.FRIENDS,
            Item: {
              userId: from.userId,
              friendId: to.userId,
              status: "pending_out",
              friendNickname: to.nickname,
              createdAt: now,
              updatedAt: now,
            } satisfies FriendRecord,
          },
        },
        {
          Put: {
            TableName: TABLE.FRIENDS,
            Item: {
              userId: to.userId,
              friendId: from.userId,
              status: "pending_in",
              friendNickname: from.nickname,
              createdAt: now,
              updatedAt: now,
            } satisfies FriendRecord,
          },
        },
      ],
    })
  );
}

export async function acceptFriendRequest(
  userId: string,
  friendId: string
): Promise<void> {
  const now = new Date().toISOString();
  const update = (owner: string, other: string) => ({
    Update: {
      TableName: TABLE.FRIENDS,
      Key: { userId: owner, friendId: other },
      UpdateExpression: "SET #status = :accepted, updatedAt = :now",
      ConditionExpression: "attribute_exists(friendId)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":accepted": "accepted", ":now": now },
    },
  });

  await db.send(
    new TransactWriteCommand({
      TransactItems: [update(userId, friendId), update(friendId, userId)],
    })
  );
}

export async function removeFriend(
  userId: string,
  friendId: string
): Promise<void> {
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE.FRIENDS,
            Key: { userId, friendId },
          },
        },
        {
          Delete: {
            TableName: TABLE.FRIENDS,
            Key: { userId: friendId, friendId: userId },
          },
        },
      ],
    })
  );
}

/** Блокировка односторонняя: у заблокированного запись просто исчезает. */
export async function blockUser(
  userId: string,
  friendId: string
): Promise<void> {
  const existing = await getFriendEdge(userId, friendId);
  const nickname =
    existing?.friendNickname ?? (await findUserById(friendId))?.nickname ?? "";
  const now = new Date().toISOString();

  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE.FRIENDS,
            Item: {
              userId,
              friendId,
              status: "blocked",
              friendNickname: nickname,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            } satisfies FriendRecord,
          },
        },
        {
          Delete: {
            TableName: TABLE.FRIENDS,
            Key: { userId: friendId, friendId: userId },
          },
        },
      ],
    })
  );
}

/**
 * GSI `nickname-index` — HASH по нику, то есть строгое совпадение.
 * Подстрочный поиск добирается одним ограниченным Scan: ник ищут редко и вручную,
 * а держать ради этого отдельную поисковую подсистему дороже, чем один проход.
 */
export async function searchUsersByNickname(
  query: string,
  limit: number
): Promise<UserPublic[]> {
  const needle = query.trim();
  if (needle.length < SEARCH_MIN_CHARS) return [];
  const cap = Math.min(Math.max(limit, 1), SEARCH_MAX_RESULTS);

  const exact = await db.send(
    new QueryCommand({
      TableName: TABLE.USERS,
      IndexName: "nickname-index",
      KeyConditionExpression: "nickname = :nickname",
      ExpressionAttributeValues: { ":nickname": needle },
      Limit: cap,
    })
  );

  const collected = new Map<string, UserRecord>();
  for (const item of (exact.Items as UserRecord[] | undefined) ?? []) {
    collected.set(item.userId, item);
  }

  if (collected.size < cap) {
    const scanned = await db.send(
      new ScanCommand({
        TableName: TABLE.USERS,
        FilterExpression: "contains(#nickname, :needle)",
        ExpressionAttributeNames: { "#nickname": "nickname" },
        ExpressionAttributeValues: { ":needle": needle },
        Limit: SEARCH_SCAN_LIMIT,
      })
    );
    for (const item of (scanned.Items as UserRecord[] | undefined) ?? []) {
      if (collected.size >= cap) break;
      collected.set(item.userId, item);
    }
  }

  return [...collected.values()].slice(0, cap).map(toUserPublic);
}

const memoryUsers = new Map<string, UserRecord>();
const memoryDecks = new Map<string, DeckRecord>();
const memoryFriends = new Map<string, FriendRecord>();

export function updateMemoryUser(
  userId: string,
  updates: Partial<UserRecord>,
): UserRecord | null {
  const prev = memoryUsers.get(userId);
  if (!prev) return null;
  const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
  memoryUsers.set(userId, next);
  return next;
}

const edgeKey = (userId: string, friendId: string) => `${userId}#${friendId}`;

export async function createUserSafe(user: UserRecord): Promise<UserRecord> {
  try {
    return await createUser(user);
  } catch {
    memoryUsers.set(user.userId, user);
    return user;
  }
}

export async function findUserByEmailSafe(email: string): Promise<UserRecord | null> {
  try {
    return await findUserByEmail(email);
  } catch {
    for (const u of memoryUsers.values()) {
      if (u.email === email) return u;
    }
    return null;
  }
}

export async function findUserByIdSafe(userId: string): Promise<UserRecord | null> {
  try {
    return (await findUserById(userId)) ?? memoryUsers.get(userId) ?? null;
  } catch {
    return memoryUsers.get(userId) ?? null;
  }
}

export async function listDecksByUserSafe(userId: string): Promise<DeckRecord[]> {
  try {
    return await listDecksByUser(userId);
  } catch {
    return [...memoryDecks.values()].filter((d) => d.userId === userId);
  }
}

export async function getDeckByIdSafe(deckId: string): Promise<DeckRecord | null> {
  try {
    return await getDeckById(deckId);
  } catch {
    return memoryDecks.get(deckId) ?? null;
  }
}

export async function createDeckSafe(deck: DeckRecord): Promise<DeckRecord> {
  try {
    return await createDeck(deck);
  } catch {
    memoryDecks.set(deck.deckId, deck);
    return deck;
  }
}

export async function updateDeckSafe(
  deckId: string,
  updates: Partial<Pick<DeckRecord, "name" | "cardIds" | "isValid">>
): Promise<DeckRecord | null> {
  try {
    return await updateDeck(deckId, updates);
  } catch {
    const existing = memoryDecks.get(deckId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    memoryDecks.set(deckId, updated);
    return updated;
  }
}

export async function deleteDeckSafe(deckId: string): Promise<void> {
  try {
    await deleteDeck(deckId);
  } catch {
    memoryDecks.delete(deckId);
  }
}

export async function createMatchRecordSafe(record: MatchRecord): Promise<void> {
  try {
    await createMatchRecord(record);
  } catch {
    /* dev fallback */
  }
}

export async function updateMatchRecordSafe(
  matchId: string,
  updates: Partial<MatchRecord>
): Promise<void> {
  try {
    await updateMatchRecord(matchId, updates);
  } catch {
    /* dev fallback */
  }
}

export async function findUsersByIdsSafe(
  userIds: string[]
): Promise<UserRecord[]> {
  try {
    return await findUsersByIds(userIds);
  } catch {
    const unique = new Set(userIds);
    return [...memoryUsers.values()].filter((u) => unique.has(u.userId));
  }
}

export async function listFriendsSafe(userId: string): Promise<FriendRecord[]> {
  try {
    return await listFriends(userId);
  } catch {
    return [...memoryFriends.values()].filter((f) => f.userId === userId);
  }
}

export async function getFriendEdgeSafe(
  userId: string,
  friendId: string
): Promise<FriendRecord | null> {
  try {
    return await getFriendEdge(userId, friendId);
  } catch {
    return memoryFriends.get(edgeKey(userId, friendId)) ?? null;
  }
}

export async function sendFriendRequestSafe(
  from: UserRecord,
  to: UserRecord
): Promise<void> {
  try {
    await sendFriendRequest(from, to);
  } catch {
    const now = new Date().toISOString();
    memoryFriends.set(edgeKey(from.userId, to.userId), {
      userId: from.userId,
      friendId: to.userId,
      status: "pending_out",
      friendNickname: to.nickname,
      createdAt: now,
      updatedAt: now,
    });
    memoryFriends.set(edgeKey(to.userId, from.userId), {
      userId: to.userId,
      friendId: from.userId,
      status: "pending_in",
      friendNickname: from.nickname,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function acceptFriendRequestSafe(
  userId: string,
  friendId: string
): Promise<void> {
  try {
    await acceptFriendRequest(userId, friendId);
  } catch {
    const now = new Date().toISOString();
    for (const key of [edgeKey(userId, friendId), edgeKey(friendId, userId)]) {
      const edge = memoryFriends.get(key);
      if (edge) {
        memoryFriends.set(key, { ...edge, status: "accepted", updatedAt: now });
      }
    }
  }
}

export async function removeFriendSafe(
  userId: string,
  friendId: string
): Promise<void> {
  try {
    await removeFriend(userId, friendId);
  } catch {
    memoryFriends.delete(edgeKey(userId, friendId));
    memoryFriends.delete(edgeKey(friendId, userId));
  }
}

export async function blockUserSafe(
  userId: string,
  friendId: string
): Promise<void> {
  try {
    await blockUser(userId, friendId);
  } catch {
    const key = edgeKey(userId, friendId);
    const existing = memoryFriends.get(key);
    const now = new Date().toISOString();
    memoryFriends.set(key, {
      userId,
      friendId,
      status: "blocked",
      friendNickname:
        existing?.friendNickname ?? memoryUsers.get(friendId)?.nickname ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    memoryFriends.delete(edgeKey(friendId, userId));
  }
}

export async function searchUsersByNicknameSafe(
  query: string,
  limit: number
): Promise<UserPublic[]> {
  try {
    return await searchUsersByNickname(query, limit);
  } catch {
    const needle = query.trim().toLowerCase();
    if (needle.length < SEARCH_MIN_CHARS) return [];
    const cap = Math.min(Math.max(limit, 1), SEARCH_MAX_RESULTS);
    return [...memoryUsers.values()]
      .filter((u) => u.nickname.toLowerCase().includes(needle))
      .slice(0, cap)
      .map(toUserPublic);
  }
}
