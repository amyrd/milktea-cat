/**
 * Where things go inside a message box, and how text is laid out in it.
 *
 * A message box is 234 pixels wide and 1 to 5 "lines" tall. The first line also
 * holds the sender's name (top left), and text can start to the right of it;
 * every extra line adds 16 pixels. The sprites for each height are
 * box_bg1 ... box_bg5.
 */

import { MAX_PIECE_TEXT, MAX_TEXT_LENGTH } from "../constants.js";

/** Height of a message box with 1, 2, 3, 4 or 5 lines. */
export const BOX_HEIGHTS = [22, 38, 54, 70, 85];
export const MAX_LINES = BOX_HEIGHTS.length;

export const NAME_POSITION = { x: 6, y: 4 };

/** Where the box you write in sits on the stage. */
export const COMPOSE_POSITION = { x: 21, y: 207 };

/**
 * A character being dragged is drawn this far up and to the left of the pointer,
 * so the pointer rests near its lower right and the character stays visible.
 */
export const DRAG_OFFSET = { x: -10, y: -10 };

const LINE_HEIGHT = 16;
const FIRST_LINE_TEXT_X = 92; // right of the name
const OTHER_LINES_TEXT_X = 6;
const TEXT_RIGHT_EDGE = 231;
const TEXT_TOP = 4;

let measureContext = null;

/** Width in stage pixels of `string` in the DS font. */
export function measureText(string) {
  if (!measureContext) {
    measureContext = document.createElement("canvas").getContext("2d");
    measureContext.font = "10px nds";
  }
  return measureContext.measureText(string).width;
}

/**
 * Split text into rows the way the DS does: it breaks at newlines, and wraps
 * (mid-word if it has to) when a row runs out of room.
 * Returns { rows: [{ text, x, y }], fits } where `fits` is false if the text
 * needed more than the 5 lines a box can hold (rows past the fifth are dropped).
 */
export function layoutText(text) {
  const rows = [];
  let current = "";
  let fits = true;

  const rowX = () => (rows.length === 0 ? FIRST_LINE_TEXT_X : OTHER_LINES_TEXT_X);
  const endRow = () => {
    rows.push({ text: current, x: rowX(), y: TEXT_TOP + LINE_HEIGHT * rows.length });
    current = "";
  };

  for (const character of text) {
    if (character === "\n") {
      endRow();
    } else if (rowX() + measureText(current + character) > TEXT_RIGHT_EDGE) {
      endRow();
      current = character;
    } else {
      current += character;
    }
    if (rows.length >= MAX_LINES) {
      fits = false;
      break;
    }
  }
  if (fits && (current !== "" || rows.length === 0)) endRow();

  // Drop empty rows at the end, but always keep the first.
  while (rows.length > 1 && rows[rows.length - 1].text === "") rows.pop();
  return { rows: rows.slice(0, MAX_LINES), fits };
}

/**
 * Can a dragged character be dropped with its top-left corner here? `x` and `y`
 * are in message-box pixels. It must land inside the box, and not on the name tag
 * in the top left corner.
 */
export function canDropAt(x, y) {
  const insideBox = x >= 2 && x <= 225 && y >= 1 && y <= 71;
  const onNameTag = x <= 89 && y <= 19;
  return insideBox && !onNameTag;
}

/** True if `next` can replace the text of a placed piece without running off the box or getting too long. */
export function pieceFits(piece, next) {
  return next.length <= MAX_PIECE_TEXT && !next.includes("\n") && piece.x + measureText(next) <= TEXT_RIGHT_EDGE;
}

/** True if this text (and its length) can be typed into a message box. */
export function textFits(text) {
  return text.length <= MAX_TEXT_LENGTH && layoutText(text).fits;
}

/** How many lines tall the box must be to hold this text, these strokes and these placed pieces. */
export function linesNeeded(text, strokes, pieces = []) {
  const textLines = layoutText(text).rows.length;

  let lowest = 0;
  for (const stroke of strokes) {
    for (const point of stroke.points) lowest = Math.max(lowest, point[1] + stroke.size);
  }
  for (const piece of pieces) lowest = Math.max(lowest, piece.y + 12); // a line of text is 12 pixels tall
  const lowestLines = BOX_HEIGHTS.findIndex((height) => lowest <= height - 2) + 1 || MAX_LINES;

  return Math.max(textLines, lowestLines);
}
