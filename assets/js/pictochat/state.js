/**
 * Who is online and which room they're in. Pure logic, no DOM and no
 * networking, so it's easy to read and to test on its own.
 *
 * This is the port of state.py. There, one server process held the only copy
 * of this state. In the browser every tab keeps its own copy and the copies are
 * kept in sync by presence events (see session.js).
 */

import { FIXED_ROOMS, ROOM_CODE_LENGTH, MAX_NAME_LENGTH } from "./constants.js";

// Room codes skip the letters I and O so they can't be mistaken for 1 and 0.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_PATTERN = new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`);

/** Make a random private-room code like "KQTM". `random` can be swapped in for tests. */
export function generateRoomCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  }
  return code;
}

/** Turn whatever the user typed into a room code, or null if it isn't one. */
export function normalizeRoomCode(input) {
  const letters = String(input ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return letters.length === ROOM_CODE_LENGTH ? letters : null;
}

/** A room id is either a fixed room letter ("A") or a private room code ("KQTM"). */
export function isValidRoomId(id) {
  return typeof id === "string" && (FIXED_ROOMS.includes(id) || ROOM_CODE_PATTERN.test(id));
}

/** Human-readable name for a room id. */
export function describeRoom(roomId) {
  return FIXED_ROOMS.includes(roomId) ? `Room ${roomId}` : `Private room ${roomId}`;
}

/** Tidy a display name: collapse spaces, trim, and cap the length. */
export function cleanName(input) {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

/**
 * Every player we know about, keyed by id. A player looks like:
 *   { id, name, colorId, roomId }      (roomId is null while they're in the room list)
 * We also note when we last heard from each one, so players whose tab crashed
 * (and never said goodbye) can be dropped eventually. See removeStale().
 */
export class ChatState {
  constructor() {
    this._players = new Map();
  }

  /**
   * Record where a player is now. Returns the room changes this caused, e.g.
   * [{ type: "left", roomId: "A", player }, { type: "joined", roomId: "B", player }],
   * so the caller can show "Amy joined." style notices.
   * (`now` is a parameter only so tests can control the clock.)
   */
  applyPresence(player, now = Date.now()) {
    const previous = this._players.get(player.id);
    this._players.set(player.id, { ...player, lastSeen: now });
    return roomChanges(previous ? previous.roomId : null, player.roomId, player);
  }

  /** Forget a player entirely (their tab closed). Returns the room changes, like applyPresence. */
  removePlayer(playerId) {
    const previous = this._players.get(playerId);
    if (!previous) return [];
    this._players.delete(playerId);
    return roomChanges(previous.roomId, null, previous);
  }

  /**
   * Forget everyone we haven't heard from for `maxAgeMs`. A tab that is closed
   * normally says goodbye, but a crashed tab, or a phone browser that quietly
   * kills a background tab, can't. Returns the room changes, like removePlayer.
   */
  removeStale(maxAgeMs, now = Date.now()) {
    const changes = [];
    for (const player of [...this._players.values()]) {
      if (now - player.lastSeen > maxAgeMs) changes.push(...this.removePlayer(player.id));
    }
    return changes;
  }

  playersIn(roomId) {
    return [...this._players.values()].filter((player) => player.roomId === roomId);
  }

  /** How many people are in each fixed room, e.g. { A: 2, B: 0, C: 0, D: 1 }. */
  countsByRoom() {
    return Object.fromEntries(FIXED_ROOMS.map((roomId) => [roomId, this.playersIn(roomId).length]));
  }
}

function roomChanges(fromRoomId, toRoomId, player) {
  if (fromRoomId === toRoomId) return [];

  const changes = [];
  if (fromRoomId !== null) changes.push({ type: "left", roomId: fromRoomId, player });
  if (toRoomId !== null) changes.push({ type: "joined", roomId: toRoomId, player });
  return changes;
}
