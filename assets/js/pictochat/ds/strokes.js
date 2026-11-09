/**
 * Painting pen and eraser strokes onto a canvas.
 *
 * A stroke is the pen going down, moving, and coming up:
 *   { tool: "pen" | "eraser", size: 2, points: [[x, y], [x, y], ...] }
 * Coordinates are in message-box pixels (see constants.js), so a drawing can be
 * replayed at any size. Canvases are made BACKING times bigger than the box so
 * lines stay smooth however large the stage is scaled.
 */

import { DRAW_WIDTH, DRAW_HEIGHT } from "../constants.js";
import { h } from "../dom.js";

const BACKING = 3;
const INK = "#000";

/** A canvas that strokes can be painted on, sized for a message box. */
export function createStrokeCanvas(className = "") {
  return h("canvas", { className, width: DRAW_WIDTH * BACKING, height: DRAW_HEIGHT * BACKING, "aria-hidden": "true" });
}

function applyStyle(ctx, stroke) {
  // The eraser doesn't paint white; it cuts transparent holes in the ink.
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = stroke.size * BACKING;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** A tap without movement is a dot. */
export function paintDot(ctx, stroke) {
  applyStyle(ctx, stroke);
  const [x, y] = stroke.points[0];
  ctx.beginPath();
  ctx.arc(x * BACKING, y * BACKING, (stroke.size * BACKING) / 2, 0, Math.PI * 2);
  ctx.fill();
}

export function paintSegment(ctx, stroke, from, to) {
  applyStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(from[0] * BACKING, from[1] * BACKING);
  ctx.lineTo(to[0] * BACKING, to[1] * BACKING);
  ctx.stroke();
}

/** Clear the canvas and replay a list of strokes onto it. */
export function paintStrokes(ctx, strokes) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const stroke of strokes) {
    if (stroke.points.length === 1) {
      paintDot(ctx, stroke);
      continue;
    }
    for (let i = 1; i < stroke.points.length; i++) {
      paintSegment(ctx, stroke, stroke.points[i - 1], stroke.points[i]);
    }
  }
}
