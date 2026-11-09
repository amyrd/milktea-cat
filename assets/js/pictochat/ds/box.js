/**
 * A message box: the white rounded rectangle with a colored outline that holds a
 * name, some text and a drawing. Chat bubbles and the box you write in are both
 * built from this, so a message looks the same before and after you send it.
 *
 * It is a stack of sprites, bottom to top:
 *   white background / the drawing / ruled lines (a light tint of your color) /
 *   outline (your color) / your name / text rows
 */

import { DRAW_HEIGHT, DRAW_WIDTH, findColor } from "../constants.js";
import { h } from "../dom.js";
import { lighten, spriteUrl, tintedUrl } from "./assets.js";
import { BOX_HEIGHTS, NAME_POSITION, layoutText } from "./layout.js";
import { place, sprite, text as textElement } from "./stage.js";
import { createStrokeCanvas } from "./strokes.js";

export const BOX_WIDTH = 234;

/**
 * `lines` (1-5) picks the height. `multiplyLines` blends the ruled lines over the
 * drawing instead of under it, which is how the box you write in looks.
 * Returns { element, strokeCanvas, setContent({ text, pieces }) }.
 */
export function createBox({ lines, colorId, name, multiplyLines = false }) {
  const color = findColor(colorId);
  const height = BOX_HEIGHTS[lines - 1];
  const whole = { x: 0, y: 0, w: BOX_WIDTH, h: height };

  const strokeCanvas = createStrokeCanvas("ds-strokes");
  place(strokeCanvas, { x: 0, y: 0, w: DRAW_WIDTH, h: DRAW_HEIGHT });

  const rows = h("div", { className: "ds-rows" });

  const element = h(
    "div",
    { className: "ds-box" },
    sprite(spriteUrl(`box_bg${lines}`), whole),
    strokeCanvas,
    sprite(tintedUrl(`box_lines${lines}`, lighten(color.hex, 75)), whole, multiplyLines ? "ds-multiply" : ""),
    sprite(tintedUrl(`box_outline${lines}`, color.hex), whole),
    textElement(name, { ...NAME_POSITION, color: color.ink }, "ds-name"),
    rows,
  );
  place(element, { w: BOX_WIDTH, h: height });

  /**
   * Show the box's text: `text` laid out in rows like the DS does, plus any
   * `pieces` (bits of text placed at a spot by dragging a key onto the box).
   */
  function setContent({ text, pieces = [] }) {
    const flowing = layoutText(text).rows.map((row) => textElement(row.text, row));
    const placed = pieces.map((piece) => textElement(piece.text, piece));
    rows.replaceChildren(...flowing, ...placed);
  }

  return { element, strokeCanvas, setContent };
}
