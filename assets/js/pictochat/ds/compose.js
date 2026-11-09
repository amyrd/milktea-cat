/**
 * The box you write and draw in (bottom screen, near the top). It holds the
 * message being composed: some flowing text, some strokes, and some "pieces".
 *
 * A piece is a bit of text placed at a particular spot, which happens when you
 * drag a character off the on-screen keyboard and drop it on the box. After a
 * drop, typing continues from that piece, like putting a cursor there; deleting
 * all of its characters removes it and typing goes back to the flowing text.
 *
 * It looks like a finished bubble, so what you see is what gets sent. Draw by
 * dragging on it (mouse, finger or stylus).
 */

import { DRAW_HEIGHT, DRAW_WIDTH, MAX_PIECES, MAX_POINTS, MAX_STROKES } from "../constants.js";
import { createBox } from "./box.js";
import { COMPOSE_POSITION, MAX_LINES, pieceFits, textFits } from "./layout.js";
import { markKana } from "./keyboard.js";
import { play } from "./sounds.js";
import { place } from "./stage.js";
import { paintDot, paintSegment, paintStrokes } from "./strokes.js";

const LINE_HEIGHT = 16;
const LOWEST_PIECE_Y = 71; // a piece below this wouldn't fit inside the box

/**
 * `onChange()` runs whenever the text, the pieces or the drawing change.
 * `onActivate()` runs when the box is pressed (the room screen uses it to start
 * listening to the real keyboard).
 */
export function createCompose({ colorId, name, onChange, onActivate }) {
  const box = createBox({ lines: MAX_LINES, colorId, name, multiplyLines: true });
  box.element.classList.add("ds-compose");
  place(box.element, COMPOSE_POSITION);

  const canvas = box.strokeCanvas;
  const ctx = canvas.getContext("2d");

  let text = "";
  let pieces = [];
  let active = null; // the index of the piece typing goes into, or null for the flowing text
  let strokes = [];
  let pointCount = 0;
  let activeStroke = null; // the stroke being drawn right now, while the pointer is down
  let tool = { tool: "pen", size: 2 };

  function changed() {
    box.setContent({ text, pieces });
    onChange();
  }

  // -- Drawing ---------------------------------------------------------------

  /** Where a pointer event is inside the box, in message-box pixels. */
  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * DRAW_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * DRAW_HEIGHT;
    return [clamp(Math.round(x), 1, DRAW_WIDTH - 1), clamp(Math.round(y), 1, DRAW_HEIGHT - 1)];
  }

  // The scratchy drawing sound plays as the pen moves, louder the faster it goes.
  let drawSound = { stop() {} };
  let lastSoundPoint = null;

  canvas.addEventListener("pointerdown", (event) => {
    onActivate();
    const isPrimaryButton = event.pointerType !== "mouse" || event.button === 0;
    if (!isPrimaryButton || strokes.length >= MAX_STROKES || pointCount >= MAX_POINTS) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId); // keep getting events even if the pointer leaves the box

    const stroke = { tool: tool.tool, size: tool.size, points: [pointFrom(event)] };
    strokes.push(stroke);
    activeStroke = stroke;
    pointCount += 1;
    lastSoundPoint = stroke.points[0];

    play("draw_down");
    paintDot(ctx, stroke);
    changed();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!activeStroke || pointCount >= MAX_POINTS) return;

    const point = pointFrom(event);
    const last = activeStroke.points[activeStroke.points.length - 1];
    if (point[0] === last[0] && point[1] === last[1]) return;

    activeStroke.points.push(point);
    pointCount += 1;
    paintSegment(ctx, activeStroke, last, point);

    const distance = Math.hypot(point[0] - lastSoundPoint[0], point[1] - lastSoundPoint[1]);
    if (distance >= 2) {
      drawSound.stop();
      drawSound = play("draw", { volume: distance / 2, offset: Math.random() * 0.4 });
      lastSoundPoint = point;
    }
  });

  const endStroke = () => {
    activeStroke = null;
    drawSound.stop();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  // -- Text: the flowing text, and pieces placed by dragging ---------------------

  /** The text that typing is going into right now. */
  function getActiveText() {
    return active === null ? text : pieces[active].text;
  }

  /** Replace the text typing is going into. Returns false (and changes nothing) if it won't fit. */
  function setActiveText(next) {
    if (active === null) {
      if (!textFits(next)) return false;
      text = next;
    } else if (next === "") {
      pieces.splice(active, 1); // deleting the last character removes the piece
      active = null;
    } else if (pieceFits(pieces[active], next)) {
      pieces[active].text = next;
    } else {
      return false;
    }
    changed();
    return true;
  }

  /** The Enter key: a new line in the flowing text, or a new piece just below the active one. */
  function pressEnter() {
    if (active === null) return setActiveText(`${text}\n`);

    const piece = pieces[active];
    if (pieces.length >= MAX_PIECES || piece.y + LINE_HEIGHT > LOWEST_PIECE_Y) return false;
    pieces.push({ text: "", x: piece.x, y: piece.y + LINE_HEIGHT });
    active = pieces.length - 1;
    changed();
    return true;
  }

  const hasPieceText = () => pieces.some((piece) => piece.text.trim() !== "");

  // -- What the buttons can ask for -------------------------------------------

  return {
    element: box.element,

    /** "pen" or "eraser", and how thick (in message-box pixels). */
    setTool(name, size) {
      tool = { tool: name, size };
    },

    getActiveText,
    setActiveText,

    /** Something typed on the on-screen keyboard (see ds/keyboard.js for the kinds of input). */
    type(input) {
      const characters = [...getActiveText()];

      if (input.type === "enter") return pressEnter();

      if (input.type === "char") {
        characters.push(input.value);
      } else if (input.type === "backspace") {
        if (characters.length === 0) {
          // Backspacing an empty piece (one made with Enter) removes it.
          if (active !== null) {
            pieces.splice(active, 1);
            active = null;
            changed();
          }
          return;
        }
        characters.pop();
      } else if (input.type === "mark") {
        if (characters.length === 0) return;
        characters.push(markKana(characters.pop(), input.kind));
      } else {
        return;
      }

      setActiveText(characters.join(""));
    },

    /** Put a character at a spot in the box, and carry on typing from there. */
    dropPiece(character, x, y) {
      if (pieces.length >= MAX_PIECES) return false;
      pieces.push({ text: character, x, y });
      active = pieces.length - 1;
      changed();
      return true;
    },

    /** Everything in the box, ready to send. */
    getMessage() {
      return {
        text: text.trimEnd(),
        strokes,
        pieces: pieces.filter((piece) => piece.text.trim() !== "").map((piece) => ({ ...piece })),
      };
    },

    isEmpty: () => text.trim() === "" && strokes.length === 0 && !hasPieceText(),

    /** Wipe the text, the pieces and the drawing. */
    clear() {
      text = "";
      pieces = [];
      active = null;
      strokes = [];
      pointCount = 0;
      activeStroke = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      changed();
    },

    /** Put a previous message back in the box (the RENEW button). */
    restore(message) {
      text = message.text;
      pieces = message.pieces.map((piece) => ({ ...piece }));
      active = null;
      strokes = message.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => [...p]) }));
      pointCount = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
      paintStrokes(ctx, strokes);
      changed();
    },
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
