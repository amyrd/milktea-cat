/**
 * The stage: a 256 x 384 "pixel" canvas made of two stacked 256 x 192 screens,
 * like the DS (top screen = chat, bottom screen = controls).
 *
 * Everything on it is positioned in *stage pixels* (0-256 across, 0-384 down)
 * and scaled with one CSS variable, --s. Make the stage bigger or smaller by
 * changing --s and every sprite, button and piece of text follows.
 */

import { h } from "../dom.js";

export const STAGE_WIDTH = 256;
export const STAGE_HEIGHT = 384;

const MIN_SCALE = 1;
const MAX_SCALE = 3;

/** A CSS length for `n` stage pixels. */
export const px = (n) => `calc(var(--s) * ${n}px)`;

/** Put an element at a position and size, given in stage pixels. Leave out whatever you don't need. */
export function place(element, { x, y, w, h: height }) {
  if (x !== undefined) element.style.left = px(x);
  if (y !== undefined) element.style.top = px(y);
  if (w !== undefined) element.style.width = px(w);
  if (height !== undefined) element.style.height = px(height);
  return element;
}

/** Where a pointer event happened on the stage, in stage pixels (0-256 across, 0-384 down). */
export function stagePoint(stageElement, event) {
  const box = stageElement.getBoundingClientRect();
  const scale = parseFloat(getComputedStyle(stageElement).getPropertyValue("--s")) || 1;
  return {
    x: (event.clientX - box.left - stageElement.clientLeft) / scale, // clientLeft/Top: the stage's own border
    y: (event.clientY - box.top - stageElement.clientTop) / scale,
  };
}

/** A picture (one of the sprites) shown at a position, scaled with hard pixel edges. */
export function sprite(url, rect, className = "") {
  const element = h("div", { className: `ds-sprite ${className}`.trim(), "aria-hidden": "true" });
  element.style.backgroundImage = `url(${url})`;
  return place(element, rect);
}

/**
 * A piece of text in the DS font, at a position given in stage pixels. Give a
 * width `w` (and the "ds-wrap" class) to let it wrap onto several lines.
 */
export function text(content, { x, y, w, color = "#000" }, className = "") {
  // Decorative: anything shown in this text is also available in a form screen readers can use.
  const element = h("span", { className: `ds-text ${className}`.trim(), "aria-hidden": "true" }, content);
  element.style.color = color;
  return place(element, { x, y, w });
}

/**
 * An invisible button laid over part of a sprite, so a picture of a key or a
 * button becomes a real, clickable <button>.
 *   label       what a screen reader calls it
 *   onPress     what happens when it is clicked (or activated from the keyboard)
 *   decorative  true for things a keyboard or screen-reader user doesn't need
 *               (the on-screen keyboard), so they're hidden from both
 */
export function hitZone(rect, { label, onPress, decorative = false }) {
  const button = h("button", {
    type: "button",
    className: "ds-hit",
    "aria-label": label,
    "aria-hidden": decorative ? "true" : null,
    tabindex: decorative ? "-1" : null,
    onClick: onPress,
  });
  return place(button, rect);
}

/**
 * Create the stage inside `host`. It picks the biggest scale at which the whole
 * stage fits the host's width and the window's height (in quarter steps, 1x to 3x),
 * and keeps it up to date when either changes.
 *
 * Returns { element, controls, aside, clear }:
 *   element    the 256 x 384 stage that screens draw into
 *   controls   page content under the stage that stays on every screen (the sound switch)
 *   aside      page content under that, for the current screen (hints, extra buttons)
 *   clear()    empty the stage and the aside, ready for the next screen
 */
export function createStage(host) {
  const element = h("div", { className: "ds-stage" });
  const controls = h("div", { className: "pc-controls" });
  const aside = h("div", { className: "pc-aside" });
  host.replaceChildren(element, controls, aside);

  function updateScale() {
    // The biggest scale at which the whole stage fits both the page's width and the window's height.
    const fitsWidth = (host.clientWidth - 2) / STAGE_WIDTH; // minus the stage's 1px border on each side
    const fitsHeight = (window.innerHeight - 24) / (STAGE_HEIGHT + 2);
    const scale = Math.floor(Math.min(fitsWidth, fitsHeight) * 4) / 4;
    element.style.setProperty("--s", String(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))));
  }

  new ResizeObserver(updateScale).observe(host);
  window.addEventListener("resize", updateScale);
  updateScale();

  return {
    element,
    controls,
    aside,
    clear() {
      element.replaceChildren();
      aside.replaceChildren();
    },
  };
}
