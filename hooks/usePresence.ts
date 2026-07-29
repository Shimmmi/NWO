"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiPath } from "@/lib/constants";
import type { PresenceStatus } from "@/lib/net/protocol";
import type { FriendStatus } from "@/lib/schema";

export interface FriendEntry {
  userId: string;
  nickname: string;
  rating: number;
  status: PresenceStatus;
  canInvite: boolean;
}

export interface FriendBrief {
  userId: string;
  nickname: string;
  rating: number;
  createdAt: string;
}

export interface SearchResult {
  userId: string;
  nickname: string;
  rating: number;
  level: number;
  relation: "none" | FriendStatus;
}

export interface FriendsData {
  friends: FriendEntry[];
  incoming: FriendBrief[];
  outgoing: FriendBrief[];
  loading: boolean;
  error: string | null;
}

export interface FriendsApi extends FriendsData {
  refresh: () => Promise<void>;
  applyPresence: (
    updates: { userId: string; status: PresenceStatus }[]
  ) => void;
  sendRequest: (friendId: string) => Promise<void>;
  accept: (friendId: string) => Promise<void>;
  remove: (friendId: string) => Promise<void>;
  block: (friendId: string) => Promise<void>;
  search: (q: string) => Promise<SearchResult[]>;
}

const MIN_QUERY_CHARS = 2;

function canInvite(status: PresenceStatus): boolean {
  return status === "online" || status === "in_lobby";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(path), {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Не удалось выполнить запрос");
  }
  if (!body) {
    throw new Error("Пустой ответ сервера");
  }
  return body;
}

/**
 * Хук намеренно не знает про WebSocket: presence приходит извне через
 * `applyPresence`, поэтому владелец сокета может смениться, не задев панель.
 */
export function useFriends(): FriendsApi {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendBrief[]>([]);
  const [outgoing, setOutgoing] = useState<FriendBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<{
        friends: FriendEntry[];
        incoming: FriendBrief[];
        outgoing: FriendBrief[];
      }>("/api/friends");
      if (!mounted.current) return;
      setFriends(data.friends);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "Не удалось загрузить друзей");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyPresence = useCallback(
    (updates: { userId: string; status: PresenceStatus }[]) => {
      if (updates.length === 0) return;
      const next = new Map(updates.map((u) => [u.userId, u.status]));
      setFriends((prev) =>
        prev.map((friend) => {
          const status = next.get(friend.userId);
          if (status === undefined || status === friend.status) return friend;
          return { ...friend, status, canInvite: canInvite(status) };
        })
      );
    },
    []
  );

  const mutate = useCallback(
    async (path: string, method: "POST" | "DELETE", body?: unknown) => {
      try {
        await request(path, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (mounted.current) setError(null);
      } catch (e) {
        if (mounted.current) {
          setError(e instanceof Error ? e.message : "Не удалось выполнить действие");
        }
        throw e;
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const sendRequest = useCallback(
    async (friendId: string) => {
      await mutate("/api/friends", "POST", { friendId });
    },
    [mutate]
  );

  const accept = useCallback(
    async (friendId: string) => {
      await mutate(`/api/friends/${encodeURIComponent(friendId)}/accept`, "POST");
    },
    [mutate]
  );

  const remove = useCallback(
    async (friendId: string) => {
      await mutate(`/api/friends/${encodeURIComponent(friendId)}`, "DELETE");
    },
    [mutate]
  );

  const block = useCallback(
    async (friendId: string) => {
      await mutate(`/api/friends/${encodeURIComponent(friendId)}/block`, "POST");
    },
    [mutate]
  );

  const search = useCallback(async (q: string): Promise<SearchResult[]> => {
    const query = q.trim();
    if (query.length < MIN_QUERY_CHARS) return [];
    const data = await request<{ results: SearchResult[] }>(
      `/api/friends/search?q=${encodeURIComponent(query)}`
    );
    return data.results;
  }, []);

  return {
    friends,
    incoming,
    outgoing,
    loading,
    error,
    refresh,
    applyPresence,
    sendRequest,
    accept,
    remove,
    block,
    search,
  };
}
