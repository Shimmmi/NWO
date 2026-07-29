"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, Swords, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FriendInviteToast,
  type FriendInvite,
} from "@/components/lobby/friend-invite-toast";
import { COLORS } from "@/lib/design/tokens";
import type { PresenceStatus } from "@/lib/net/protocol";
import type { FriendStatus } from "@/lib/schema";
import type {
  FriendEntry,
  FriendsApi,
  SearchResult,
} from "@/hooks/usePresence";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: COLORS.text_heal,
  in_lobby: COLORS.gold,
  in_match: COLORS.red_hot,
  offline: COLORS.text_secondary,
};

const STATUS_TEXT: Record<PresenceStatus, string> = {
  online: "В сети",
  in_lobby: "В лобби",
  in_match: "В бою",
  offline: "Не в сети",
};

const RELATION_TEXT: Record<FriendStatus, string> = {
  pending_out: "Заявка отправлена",
  pending_in: "Ждёт вашего ответа",
  accepted: "Уже в друзьях",
  blocked: "Заблокирован",
};

const STATUS_ORDER: Record<PresenceStatus, number> = {
  in_lobby: 0,
  online: 1,
  in_match: 2,
  offline: 3,
};

const HEX_CLIP =
  "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

function StatusDot({ status }: { status: PresenceStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <motion.span
      key={status}
      initial={{ scale: 1.9 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      aria-label={STATUS_TEXT[status]}
    />
  );
}

/** Инициал в шестиугольнике: круглый аватар читается как мессенджер. */
function HexAvatar({ nickname }: { nickname: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center font-display text-sm"
      style={{
        clipPath: HEX_CLIP,
        background: `linear-gradient(145deg, ${COLORS.gold}33, ${COLORS.bg_card})`,
        color: COLORS.gold,
      }}
      aria-hidden
    >
      {nickname.slice(0, 1).toUpperCase()}
    </span>
  );
}

function inviteHint(
  friend: FriendEntry,
  inLobby: boolean,
  invited: boolean,
): string | null {
  if (invited) return "Приглашение отправлено";
  if (friend.status === "offline") return "Не в сети";
  if (friend.status === "in_match") return "В бою";
  if (!inLobby) return "Сначала создайте лобби";
  return null;
}

function FriendRow({
  friend,
  inLobby,
  invited,
  onInvite,
}: {
  friend: FriendEntry;
  inLobby: boolean;
  invited: boolean;
  onInvite: (friendId: string) => void;
}) {
  const hint = inviteHint(friend, inLobby, invited);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
    >
      <HexAvatar nickname={friend.nickname} />

      <div className="min-w-0 flex-1">
        <p
          className="truncate font-ui text-sm font-semibold"
          style={{ color: COLORS.text_primary }}
        >
          {friend.nickname}
        </p>
        <p className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: COLORS.text_secondary }}>
          <StatusDot status={friend.status} />
          {STATUS_TEXT[friend.status]} · {friend.rating}
        </p>
      </div>

      {hint ? (
        <span
          className="font-ui text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: COLORS.text_secondary }}
        >
          {hint}
        </span>
      ) : (
        <Button
          size="sm"
          className="h-7 gap-1.5 px-2.5 font-ui text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => onInvite(friend.userId)}
          style={{
            background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
            color: "#1A0000",
          }}
        >
          <Swords className="h-3 w-3" />
          Позвать в бой
        </Button>
      )}
    </motion.li>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="px-2 pb-1 pt-3 font-ui text-[10px] uppercase tracking-[0.25em]"
      style={{ color: COLORS.text_secondary }}
    >
      {children}
    </h3>
  );
}

export interface FriendPanelProps {
  open: boolean;
  onClose: () => void;
  friends: FriendsApi;
  /** Приглашать можно только из открытого лобби — сервер иначе откажет. */
  inLobby: boolean;
  onInvite: (friendId: string) => void;
  /** Кому уже отправлено приглашение: кнопка не должна звать дважды. */
  invitedIds: string[];
}

export function FriendPanel({
  open,
  onClose,
  friends,
  inLobby,
  onInvite,
  invitedIds,
}: FriendPanelProps) {
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { search, sendRequest, accept, remove } = friends;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      search(trimmed)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setSearchError(null);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setResults([]);
          setSearchError(
            error instanceof Error ? error.message : "Поиск сейчас недоступен",
          );
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, search]);

  const { onlineFriends, offlineFriends } = useMemo(() => {
    const sorted = [...friends.friends].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.nickname.localeCompare(b.nickname, "ru"),
    );
    return {
      onlineFriends: sorted.filter((f) => f.status !== "offline"),
      offlineFriends: sorted.filter((f) => f.status === "offline"),
    };
  }, [friends.friends]);

  const hasAnything =
    friends.friends.length > 0 ||
    friends.incoming.length > 0 ||
    friends.outgoing.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={reducedMotion ? { opacity: 0 } : { x: -340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { x: -340, opacity: 0 }}
          transition={
            reducedMotion
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 260, damping: 30 }
          }
          className="pointer-events-auto fixed left-0 top-0 z-40 flex h-full w-[320px] flex-col border-r"
          style={{
            background: "rgba(10,10,16,0.82)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
          aria-label="Друзья"
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <h2
              className="font-display text-sm tracking-[0.25em]"
              style={{ color: COLORS.gold }}
            >
              ДРУЗЬЯ
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Закрыть панель друзей"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="px-3 pt-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4"
                style={{ color: COLORS.text_secondary }}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти игрока по нику"
                className="pl-8 font-ui"
                aria-label="Поиск игрока по нику"
              />
              {searching && (
                <div
                  className="absolute right-2.5 top-2.5 h-4 w-4 rounded-full border-2"
                  style={{
                    borderColor: COLORS.gold,
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
            {searchError && (
              <p className="px-3 pt-3 font-ui text-xs" style={{ color: COLORS.red_hot }}>
                {searchError}
              </p>
            )}

            {query.trim().length >= MIN_QUERY && !searching && (
              <>
                <SectionTitle>Результаты поиска</SectionTitle>
                {results.length === 0 ? (
                  <p
                    className="px-3 font-ui text-xs"
                    style={{ color: COLORS.text_secondary }}
                  >
                    Никого с таким ником не нашли.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {results.map((result) => (
                      <li
                        key={result.userId}
                        className="flex items-center gap-3 rounded-lg px-2 py-2"
                      >
                        <HexAvatar nickname={result.nickname} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate font-ui text-sm font-semibold"
                            style={{ color: COLORS.text_primary }}
                          >
                            {result.nickname}
                          </p>
                          <p
                            className="font-mono text-[11px]"
                            style={{ color: COLORS.text_secondary }}
                          >
                            рейтинг {result.rating} · ур. {result.level}
                          </p>
                        </div>
                        {result.relation === "none" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 px-2.5 font-ui text-xs"
                            onClick={() => void sendRequest(result.userId)}
                          >
                            <UserPlus className="h-3 w-3" />
                            Добавить
                          </Button>
                        ) : (
                          <span
                            className="font-ui text-[11px]"
                            style={{ color: COLORS.text_secondary }}
                          >
                            {RELATION_TEXT[result.relation]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {friends.loading && !hasAnything && (
              <p
                className="px-3 pt-4 font-ui text-xs"
                style={{ color: COLORS.text_secondary }}
              >
                Загружаем список друзей…
              </p>
            )}

            {friends.error && (
              <div className="px-3 pt-4">
                <p className="font-ui text-xs" style={{ color: COLORS.red_hot }}>
                  {friends.error}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 font-ui text-xs"
                  onClick={() => void friends.refresh()}
                >
                  Повторить
                </Button>
              </div>
            )}

            {friends.incoming.length > 0 && (
              <>
                <SectionTitle>Заявки в друзья · {friends.incoming.length}</SectionTitle>
                <ul className="space-y-1">
                  {friends.incoming.map((person) => (
                    <li
                      key={person.userId}
                      className="flex items-center gap-3 rounded-lg px-2 py-2"
                    >
                      <HexAvatar nickname={person.nickname} />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate font-ui text-sm font-semibold"
                          style={{ color: COLORS.text_primary }}
                        >
                          {person.nickname}
                        </p>
                        <p
                          className="font-mono text-[11px]"
                          style={{ color: COLORS.text_secondary }}
                        >
                          рейтинг {person.rating}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 px-2.5 font-ui text-xs"
                        onClick={() => void accept(person.userId)}
                        style={{
                          background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
                          color: "#1A0000",
                        }}
                      >
                        Принять
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 font-ui text-xs"
                        onClick={() => void remove(person.userId)}
                      >
                        Скрыть
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {onlineFriends.length > 0 && (
              <>
                <SectionTitle>В сети · {onlineFriends.length}</SectionTitle>
                <ul className="space-y-1">
                  <AnimatePresence initial={false}>
                    {onlineFriends.map((friend) => (
                      <FriendRow
                        key={friend.userId}
                        friend={friend}
                        inLobby={inLobby}
                        invited={invitedIds.includes(friend.userId)}
                        onInvite={onInvite}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            )}

            {offlineFriends.length > 0 && (
              <>
                <SectionTitle>Не в сети · {offlineFriends.length}</SectionTitle>
                <ul className="space-y-1">
                  <AnimatePresence initial={false}>
                    {offlineFriends.map((friend) => (
                      <FriendRow
                        key={friend.userId}
                        friend={friend}
                        inLobby={inLobby}
                        invited={invitedIds.includes(friend.userId)}
                        onInvite={onInvite}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            )}

            {friends.outgoing.length > 0 && (
              <>
                <SectionTitle>Отправленные заявки · {friends.outgoing.length}</SectionTitle>
                <ul className="space-y-1">
                  {friends.outgoing.map((person) => (
                    <li key={person.userId} className="flex items-center gap-3 px-2 py-2">
                      <HexAvatar nickname={person.nickname} />
                      <p
                        className="min-w-0 flex-1 truncate font-ui text-sm"
                        style={{ color: COLORS.text_secondary }}
                      >
                        {person.nickname} — ждём ответа
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!friends.loading && !friends.error && !hasAnything && (
              <div className="px-3 pt-6 text-center">
                <Users
                  className="mx-auto mb-2 h-8 w-8"
                  style={{ color: COLORS.text_secondary }}
                />
                <p className="font-ui text-sm" style={{ color: COLORS.text_primary }}>
                  Добавьте друзей, чтобы вызывать их на бой
                </p>
                <p
                  className="mt-1 font-ui text-xs"
                  style={{ color: COLORS.text_secondary }}
                >
                  Найдите игрока по нику в поле выше — заявка уйдёт сразу.
                </p>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function FriendPanelToggle({
  onClick,
  onlineCount,
  requestCount,
}: {
  onClick: () => void;
  onlineCount: number;
  requestCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto relative flex items-center gap-2 rounded-full border px-3 py-1.5 font-ui text-xs backdrop-blur-md transition-colors hover:bg-white/5"
      style={{
        background: "rgba(10,10,16,0.7)",
        borderColor: "rgba(255,255,255,0.1)",
        color: COLORS.text_primary,
      }}
    >
      <Users className="h-4 w-4" style={{ color: COLORS.gold }} />
      Друзья
      <span style={{ color: COLORS.text_secondary }}>· {onlineCount} в сети</span>
      {requestCount > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px]"
          style={{
            background: COLORS.gold,
            color: "#1A0000",
            boxShadow: `0 0 10px ${COLORS.gold_glow}`,
          }}
          aria-label={`Новых заявок: ${requestCount}`}
        >
          {requestCount}
        </span>
      )}
    </button>
  );
}

export function FriendInviteStack({
  invites,
  onAccept,
  onDecline,
  onExpire,
}: {
  invites: FriendInvite[];
  onAccept: (invite: FriendInvite) => void;
  onDecline: (invite: FriendInvite) => void;
  onExpire: (invite: FriendInvite) => void;
}) {
  const stable = useRef(onExpire);
  stable.current = onExpire;

  const handleExpire = useCallback(
    (invite: FriendInvite) => stable.current(invite),
    [],
  );

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {invites.map((invite) => (
          <FriendInviteToast
            key={invite.inviteId}
            invite={invite}
            onAccept={onAccept}
            onDecline={onDecline}
            onExpire={handleExpire}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
