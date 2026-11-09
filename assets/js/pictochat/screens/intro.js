/**
 * Screen 1: pick a name and a color. Click the logo to enter, like the original.
 *
 * The look is the grid-paper intro sprite with a logo, a name box and color
 * squares. The name box and color squares are real form controls (a text input
 * and radio buttons) styled to fit, so they work with a keyboard and a screen reader.
 */

import { COLORS, DEFAULT_COLOR_ID, MAX_NAME_LENGTH, findColor } from "../constants.js";
import { h } from "../dom.js";
import { spriteUrl } from "../ds/assets.js";
import { play } from "../ds/sounds.js";
import { hitZone, place, sprite, text } from "../ds/stage.js";
import { cleanName } from "../state.js";
import { saveProfile } from "../profile.js";

const COLUMN_X = 81; // the column of controls is 93 pixels wide, centered on the 256-pixel stage
const COLUMN_WIDTH = 93;

/**
 * `onEnter({ name, colorId })` is called with the validated choice.
 * `initialProfile` (optional) pre-fills the form.
 */
export function createIntroScreen({ stage, initialProfile, onEnter }) {
  const chosenColorId = initialProfile?.colorId ?? DEFAULT_COLOR_ID;

  const nameInput = h("input", {
    id: "pc-name",
    className: "ds-input",
    type: "text",
    maxlength: MAX_NAME_LENGTH,
    autocomplete: "nickname",
    spellcheck: "false",
    value: initialProfile?.name ?? "",
  });
  place(nameInput, { x: COLUMN_X, y: 120, w: COLUMN_WIDTH, h: 21 });

  const message = text("", { x: COLUMN_X, y: 190, w: COLUMN_WIDTH, color: "#a40000" }, "ds-wrap");
  const status = h("p", { className: "pc-sr-only", role: "alert" });

  function say(words) {
    message.textContent = words;
    status.textContent = words;
  }
  nameInput.addEventListener("input", () => say(""));

  function enter() {
    const name = cleanName(nameInput.value);
    if (name === "") {
      play("error");
      say("Type a name first.");
      nameInput.focus();
      return;
    }
    const colorId = stage.element.querySelector('input[name="color"]:checked')?.value ?? DEFAULT_COLOR_ID;
    const profile = { name, colorId };
    saveProfile(profile);
    play("start_app");
    onEnter(profile);
  }
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") enter();
  });

  // Color squares: 4 across, 2 down. Each is a radio button; the square you see is
  // just how it is drawn.
  const swatches = COLORS.map((color, i) => {
    const input = h("input", { type: "radio", name: "color", value: color.id, checked: color.id === chosenColorId });
    const chip = h("span", { className: "ds-chip" });
    chip.style.background = color.hex;
    const label = h("label", { className: "ds-swatch" }, input, chip, h("span", { className: "pc-sr-only" }, color.label));
    return place(label, { x: COLUMN_X + 24 * (i % 4), y: 160 + 24 * Math.floor(i / 4), w: 21, h: 21 });
  });

  stage.element.style.setProperty("--tint", findColor(chosenColorId).hex);
  stage.element.append(
    sprite(spriteUrl("intro_bg"), { x: 0, y: 0, w: 256, h: 384 }),
    h("h2", { className: "pc-sr-only", tabindex: "-1", "data-autofocus": true }, "Welcome to PictoChat"),

    sprite(spriteUrl("logo"), { x: COLUMN_X, y: 44, w: COLUMN_WIDTH, h: 45 }),
    hitZone({ x: COLUMN_X, y: 44, w: COLUMN_WIDTH, h: 45 }, { label: "Enter PictoChat", onPress: enter }),

    text("Username:", { x: COLUMN_X, y: 106 }),
    h("label", { for: "pc-name", className: "pc-sr-only" }, "Username"),
    nameInput,

    text("Color:", { x: COLUMN_X, y: 148 }),
    h("div", { role: "radiogroup", "aria-label": "Color" }, swatches),

    message,
    status,
    text("Click the logo to enter.", { x: COLUMN_X, y: 214, w: COLUMN_WIDTH }, "ds-wrap"),
  );

  return { destroy() {} };
}
