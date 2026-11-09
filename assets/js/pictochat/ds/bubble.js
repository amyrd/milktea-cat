/**
 * The things that appear in the top screen's chat: message bubbles, and the
 * black "Now entering..." / "Leaving..." bars.
 */

import { h } from "../dom.js";
import { spriteUrl } from "./assets.js";
import { BOX_WIDTH, createBox } from "./box.js";
import { linesNeeded } from "./layout.js";
import { place, sprite, text } from "./stage.js";
import { paintStrokes } from "./strokes.js";

/** A sent message, sized to as many lines as its text and drawing need. */
export function createBubble(message) {
  const lines = linesNeeded(message.text, message.strokes, message.pieces);
  const box = createBox({ lines, colorId: message.colorId, name: message.name });

  box.setContent(message);
  paintStrokes(box.strokeCanvas.getContext("2d"), message.strokes);
  return box.element;
}

/**
 * A join or leave bar. `kind` is "joined" or "left"; `roomLetter` picks the
 * sprite ("a" to "e"; private rooms use "e"). The name is written in on top.
 */
export function createNotice(kind, roomLetter, name) {
  const joined = kind === "joined";
  const bar = h(
    "div",
    { className: "ds-box" },
    sprite(spriteUrl(`${joined ? "enter" : "leave"}_room_${roomLetter}`), { x: 0, y: 0, w: BOX_WIDTH, h: 22 }),
    // These x positions line the name up with the end of the text printed in the sprite.
    text(name, { x: joined ? 89 : 82, y: 4, color: "#d3cbc3" }),
  );
  return place(bar, { w: BOX_WIDTH, h: 22 });
}
