/**
 * Lua-скрипты для операций, которые обязаны быть атомарными.
 * Каждый имеет JS-эквивалент в MemoryKV — в одном потоке Node он атомарен
 * по построению, поэтому поведение совпадает.
 */

export const SCRIPTS = {
  /**
   * Compare-and-set матча по версии.
   * KEYS[1]=match  KEYS[2]=ver
   * ARGV[1]=expectedVer  ARGV[2]=json  ARGV[3]=ttlSec
   * → 1 если записали, 0 если версия устарела
   */
  casMatch: {
    numberOfKeys: 2,
    lua: `
local cur = tonumber(redis.call('GET', KEYS[2]) or '0')
if cur ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2], cur + 1, 'EX', ARGV[3])
return 1
`,
  },

  /**
   * Атомарный вход гостя в лобби.
   * KEYS[1]=lobby hash
   * ARGV: userId, nickname, rating, characterId, connId
   * → {-1} нет лобби | {-2} занято | {-3} это хост | {1, hostId}
   */
  joinLobby: {
    numberOfKeys: 1,
    lua: `
if redis.call('EXISTS', KEYS[1]) == 0 then return {-1} end
local host = redis.call('HGET', KEYS[1], 'hostId')
if host == ARGV[1] then return {-3, host} end
local guest = redis.call('HGET', KEYS[1], 'guestId')
if guest and guest ~= '' then return {-2} end
redis.call('HSET', KEYS[1],
  'guestId', ARGV[1],
  'guestNick', ARGV[2],
  'guestRating', ARGV[3],
  'guestChar', ARGV[4],
  'guestConn', ARGV[5],
  'guestReady', '0')
return {1, host}
`,
  },

} as const;

export type ScriptName = keyof typeof SCRIPTS;
