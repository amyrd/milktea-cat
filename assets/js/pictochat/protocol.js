/**
 * The messages tabs send each other, and the checks applied to every one that
 * arrives. Everything on the wire is described here, so if you want to add a
 * new kind of event this is the first file to open.
 *
 * There are four kinds of event:
 *   who       "Is anyone out there? Tell me where you are."
 *   presence  "Here is who I am and which room I'm in."
 *   bye       "I'm leaving."
 *   message   "I said something in this room" (text and/or a drawing).
 *
 * Incoming data is never trusted: parseEvent() rebuilds each event from only
 * the fields it expects, or returns null if anything looks wrong.
 */

import {
  COLORS,
  DRAW_WIDTH,
  DRAW_HEIGHT,
  MAX_PIECES,
  MAX_PIECE_TEXT,
  MAX_STROKES,
  MAX_POINTS,
  MAX_STROKE_SIZE,
  MAX_TEXT_LENGTH,
} from "./constants.js";
import { cleanName, isValidRoomId } from "./state.js";

export const EventType = {
  WHO: "who",
  PRESENCE: "presence",
  BYE: "bye",
  MESSAGE: "message",
};

// -- Building events to send ---------------------------------------------

export const whoEvent = () => ({ type: EventType.WHO });
export const byeEvent = (playerId) => ({ type: EventType.BYE, id: playerId });
export const presenceEvent = (player) => ({ type: EventType.PRESENCE, player });
export const messageEvent = (roomId, message) => ({ type: EventType.MESSAGE, roomId, message });

// -- Checking events that arrive -----------------------------------------

/** Returns a clean copy of the event, or null if it isn't a valid one. */
export function parseEvent(raw) {
  if (!isObject(raw)) return null;

  switch (raw.type) {
    case EventType.WHO:
      return whoEvent();
    case EventType.BYE:
      return isId(raw.id) ? byeEvent(raw.id) : null;
    case EventType.PRESENCE:
      return parsePresence(raw);
    case EventType.MESSAGE:
      return parseMessage(raw);
    default:
      return null;
  }
}

function parsePresence(raw) {
  const player = parsePlayer(raw.player);
  if (!player) return null;

  const roomId = raw.player.roomId;
  if (roomId !== null && !isValidRoomId(roomId)) return null;

  return presenceEvent({ ...player, roomId });
}

function parseMessage(raw) {
  if (!isValidRoomId(raw.roomId) || !isObject(raw.message)) return null;

  const { id, from, text, strokes: rawStrokes, pieces: rawPieces } = raw.message;
  const player = parsePlayer({ id: from, name: raw.message.name, colorId: raw.message.colorId });
  const strokes = parseStrokes(rawStrokes);
  const pieces = parsePieces(rawPieces ?? []);
  if (!isId(id) || !player || strokes === null || pieces === null || typeof text !== "string") return null;

  const cleanText = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (cleanText === "" && strokes.length === 0 && pieces.length === 0) return null; // nothing to show

  const message = { id, from: player.id, name: player.name, colorId: player.colorId, text: cleanText, strokes, pieces };
  return messageEvent(raw.roomId, message);
}

/** Checks the parts of a player every event shares: id, name, color. */
function parsePlayer(raw) {
  if (!isObject(raw) || !isId(raw.id)) return null;

  const name = cleanName(raw.name);
  if (name === "") return null;
  if (!COLORS.some((color) => color.id === raw.colorId)) return null;

  return { id: raw.id, name, colorId: raw.colorId };
}

/**
 * Returns a clean list of "pieces" (bits of text placed at a spot in the box by
 * dragging a key onto it), or null if the list is malformed or too big.
 */
function parsePieces(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_PIECES) return null;

  const pieces = [];
  for (const piece of raw) {
    if (!isObject(piece) || typeof piece.text !== "string") return null;
    if (!isNumberBetween(piece.x, 0, DRAW_WIDTH) || !isNumberBetween(piece.y, 0, DRAW_HEIGHT)) return null;

    const text = piece.text.replace(/[\r\n]/g, "").slice(0, MAX_PIECE_TEXT);
    if (text.trim() !== "") pieces.push({ text, x: piece.x, y: piece.y });
  }
  return pieces;
}

/** Returns a clean list of strokes, or null if the list is malformed or too big. */
function parseStrokes(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_STROKES) return null;

  const strokes = [];
  let totalPoints = 0;

  for (const stroke of raw) {
    if (!isObject(stroke)) return null;
    if (stroke.tool !== "pen" && stroke.tool !== "eraser") return null;
    if (!isNumberBetween(stroke.size, 1, MAX_STROKE_SIZE)) return null;
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) return null;

    totalPoints += stroke.points.length;
    if (totalPoints > MAX_POINTS) return null;

    const points = [];
    for (const point of stroke.points) {
      const isGoodPoint =
        Array.isArray(point) &&
        point.length === 2 &&
        isNumberBetween(point[0], 0, DRAW_WIDTH) &&
        isNumberBetween(point[1], 0, DRAW_HEIGHT);
      if (!isGoodPoint) return null;
      points.push([point[0], point[1]]);
    }

    strokes.push({ tool: stroke.tool, size: stroke.size, points });
  }

  return strokes;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function isId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function isNumberBetween(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
