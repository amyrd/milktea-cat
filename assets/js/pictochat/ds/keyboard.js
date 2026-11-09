/**
 * The on-screen keyboard drawn into the bottom screen's sprite.
 *
 * The picture of the keyboard is one big sprite; this module lays an invisible
 * button over every key, in the right place, so clicking a key in the picture
 * works. Those buttons are hidden from the keyboard and screen readers, because
 * anyone using those types into the real text box instead (see room.js).
 *
 * Pressing a key types it. Pressing a key and moving instead picks the character
 * up so it follows the pointer; letting go over the message box drops it there as
 * a piece of text at that spot (see the `onDrop` callback).
 *
 * The keyboard has several modes, each with its own picture:
 *   normal, shift (one capital letter), caps (all capitals), accents, japanese,
 *   symbols and emojis.
 */

import { spriteUrl } from "./assets.js";
import { COMPOSE_POSITION, DRAG_OFFSET, canDropAt } from "./layout.js";
import { play } from "./sounds.js";
import { hitZone, place, sprite, stagePoint, text } from "./stage.js";

const BOTTOM_SCREEN = { x: 0, y: 192, w: 256, h: 192 };

const MODE = { NORMAL: 0, SHIFT: 1, CAPS: 2, ACCENTS: 3, JAPANESE: 4, SYMBOLS: 5, EMOJIS: 6 };

/** Which picture to show over the base keyboard for each mode (normal has none). */
const OVERLAY_FOR_MODE = {
  [MODE.SHIFT]: "shift",
  [MODE.CAPS]: "caps",
  [MODE.ACCENTS]: "accents",
  [MODE.SYMBOLS]: "symbols",
  [MODE.EMOJIS]: "emojis",
};

// -- Layout of the keys in the picture (stage pixels) --------------------------

/** One entry per key of the normal / shift / caps keyboard, left to right, top to bottom. */
function normalKeyRects() {
  const rects = [];
  for (let i = 0; i < 12; i++) rects.push({ x: 26 + 16 * i, y: 297, w: 15, h: 14 }); // 1 2 3 ... - =
  for (let i = 0; i < 10; i++) rects.push({ x: 35 + 16 * i, y: 312, w: 15, h: 15 }); // q w e ... p
  rects.push({ x: 195, y: 312, w: 25, h: 15 }); // backspace
  for (let i = 0; i < 10; i++) rects.push({ x: 26 + 16 * i, y: 328, w: 15, h: 15 }); // caps a s ... l
  rects.push({ x: 186, y: 328, w: 34, h: 15 }); // enter
  rects.push({ x: 24, y: 344, w: 25, h: 15 }); // shift
  for (let i = 0; i < 10; i++) rects.push({ x: 50 + 16 * i, y: 344, w: 15, h: 15 }); // z x c ... /
  rects.push({ x: 58, y: 360, w: 15, h: 14 }); // ;
  rects.push({ x: 74, y: 360, w: 15, h: 14 }); // '
  rects.push({ x: 90, y: 360, w: 79, h: 14 }); // space
  rects.push({ x: 170, y: 360, w: 15, h: 14 }); // [
  rects.push({ x: 186, y: 360, w: 15, h: 14 }); // ]
  return rects;
}

/**
 * One entry per key of the accents / japanese / symbols / emojis keyboards:
 * space, enter, backspace, five keys down the left side, a 10 x 5 grid, and one extra key.
 */
function gridKeyRects() {
  const rects = [
    { x: 202, y: 360, w: 18, h: 15 }, // space
    { x: 202, y: 328, w: 18, h: 31 }, // enter
    { x: 202, y: 312, w: 18, h: 15 }, // backspace
  ];
  for (let i = 0; i < 5; i++) rects.push({ x: 24, y: 296 + 16 * i, w: 17, h: 15 }); // left side
  for (let i = 0; i < 50; i++) {
    rects.push({ x: 42 + 16 * (i % 10), y: 296 + 16 * Math.floor(i / 10), w: 15, h: 15 }); // the grid
  }
  rects.push({ x: 202, y: 296, w: 18, h: 15 }); // the extra key (used by the japanese keyboard)
  return rects;
}

// -- What each key types, in the same order as the rects above --------------------

const SPECIAL = ["BACKSPACE", "CAPS", "ENTER", "SHIFT"];
const keyList = (...parts) => parts.flatMap((part) => (SPECIAL.includes(part) ? [part] : [...part]));

const NORMAL_KEYS = keyList("1234567890-=", "qwertyuiop", "BACKSPACE", "CAPS", "asdfghjkl", "ENTER", "SHIFT", "zxcvbnm,./", ";'", " ", "[]");
const CAPS_KEYS = keyList("1234567890-=", "QWERTYUIOP", "BACKSPACE", "CAPS", "ASDFGHJKL", "ENTER", "SHIFT", "ZXCVBNM,./", ";'", " ", "[]");
const SHIFT_KEYS = keyList("!@#$%^&*()_+", "QWERTYUIOP", "BACKSPACE", "CAPS", "ASDFGHJKL", "ENTER", "SHIFT", "ZXCVBNM<>?", ":~", " ", "{}");

// The first three keys are always space, enter, backspace; then 5 left-side keys; then the grid.
const GRID_FIXED = [" ", "ENTER", "BACKSPACE"];
const ACCENT_KEYS = [...GRID_FIXED, ...keyList("àïñÍÜ", "áâäèéêëìíî", "òóôöœùúûüç", "ßÀÁÂÄÈÉÊËÌ", "ÎÏÒÓÔÖŒÙÚÛ", "ÇÑ¡¿€¢£")];
const SYMBOL_KEYS = [...GRID_FIXED, ...keyList("!+「%^", "?&″'⁓", ":;@~_", "-*/×÷", "=→←↑↓", "」“”()", "<>{}•", "♨〒#♭♪", "±$¢£\\", "°|／＼∞", "∴…™©®")];
const EMOJI_KEYS = [...GRID_FIXED, ...keyList("1☸☰☶➔", "234567890=", "☹☺☻☼☁☂☃✉☎☄", "☱☲☳☴☵✜♠♦♥♣", "☷+-✫✲◇□△▽◎", "➕➖➗✬✱◆■▲▼✕")];
const KANA_ROWS = ["あかさたなはまやらわ", "いきしちにひみゆりを", "うくすつぬふむよるん", "えけせてねへめ！れ、", "おこそとのほも？ろ。"];
const HIRAGANA_KEYS = [...GRID_FIXED, "", "", "", "", "", ...KANA_ROWS.join(""), "－"];
const KATAKANA_KEYS = [
  ...GRID_FIXED, "", "", "", "", "",
  ..."アカサタナハマヤラワイキシチニヒミユリヲウクスツヌフムヨルンエケセテネヘメ！レ、オコソトノホモ？ロ。",
  "－",
];

// Japanese: the third, fourth and fifth keys on the left toggle hiragana/katakana and add marks.
const KANA_BASE = ["かさたはきしちひくすつふけせてへこそとほカサタハキシチヒウクスツフケセテヘコソトホ", "はひふへほハヒフヘホ", "あやわいゆうつよえおアカヤワイユウツヨエケオ"];
const KANA_MARKED = ["がざだばぎじぢびぐずづぶげぜでべごぞどぼガザダバギジヂビヴグズヅブゲゼデベゴゾドボ", "ぱぴぷぺぽパピプペポ", "ぁゃゎぃゅぅっょぇぉァヵャヮィュゥッョェヶォ"];

/** Add a mark to a kana ("か" -> "が"). `kind` is 0 (dakuten), 1 (handakuten) or 2 (small). */
export function markKana(character, kind) {
  const position = [...KANA_BASE[kind]].indexOf(character);
  return position === -1 ? character : [...KANA_MARKED[kind]][position];
}

// -- The buttons down the left side that switch keyboards ---------------------

const MODE_BUTTONS = [
  { mode: MODE.NORMAL, label: "Normal keyboard", rect: { x: 2, y: 299, w: 14, h: 14 } },
  { mode: MODE.ACCENTS, label: "Accents keyboard", rect: { x: 2, y: 316, w: 14, h: 14 } },
  { mode: MODE.JAPANESE, label: "Japanese keyboard", rect: { x: 2, y: 333, w: 14, h: 14 } },
  { mode: MODE.SYMBOLS, label: "Symbols keyboard", rect: { x: 2, y: 350, w: 14, h: 14 } },
  { mode: MODE.EMOJIS, label: "Emoji keyboard", rect: { x: 2, y: 367, w: 14, h: 14 } },
];

/** How far (in screen pixels) the pointer has to move before a press becomes a drag. */
const DRAG_DISTANCE = 4;

/** Keys that do something rather than type a character can't be picked up. */
const isCharacterKey = (key) => key !== "" && key !== " " && !SPECIAL.includes(key);

/**
 * Build the keyboard into `stage`.
 *
 * `onInput(input)` is called for everything typed:
 *   { type: "char", value: "a" }   a character
 *   { type: "backspace" } / { type: "enter" }
 *   { type: "mark", kind: 0 | 1 | 2 }   a Japanese mark for the last character
 *
 * `onDrop(character, x, y)` is called when a character is dragged and dropped on
 * the message box. x and y are in message-box pixels.
 */
export function createKeyboard({ stage, onInput, onDrop }) {
  let mode = MODE.NORMAL;
  let kana = 0; // 0 = hiragana, 1 = katakana

  // The character that follows the pointer while one is being dragged.
  const draggedCharacter = text("", { x: 0, y: 0 }, "ds-dragging");
  draggedCharacter.hidden = true;

  const overlays = {};
  for (const [modeId, name] of Object.entries(OVERLAY_FOR_MODE)) {
    overlays[modeId] = sprite(spriteUrl(name), BOTTOM_SCREEN, "ds-overlay");
    stage.append(overlays[modeId]);
  }
  const kanaOverlays = [sprite(spriteUrl("japanese"), BOTTOM_SCREEN, "ds-overlay"), sprite(spriteUrl("japanese2"), BOTTOM_SCREEN, "ds-overlay")];
  stage.append(...kanaOverlays);

  const normalKeys = () => ({ [MODE.NORMAL]: NORMAL_KEYS, [MODE.SHIFT]: SHIFT_KEYS, [MODE.CAPS]: CAPS_KEYS })[mode] ?? NORMAL_KEYS;

  const normalZones = normalKeyRects().map((rect, i) => keyZone(rect, () => normalKeys()[i], () => pressNormal(i)));
  const gridZones = gridKeyRects().map((rect, i) => keyZone(rect, () => gridKeys()[i] ?? "", () => pressGrid(i)));
  const modeZones = MODE_BUTTONS.map(({ mode: target, label, rect }) => {
    const button = hitZone(rect, {
      label,
      decorative: true,
      onPress() {
        play("scroll");
        setMode(target);
      },
    });
    return { button, target };
  });
  stage.append(...normalZones, ...gridZones, ...modeZones.map((z) => z.button), draggedCharacter);

  // -- Keys: press to type, press and move to pick the character up ----------------

  /**
   * An invisible button over one key of the picture. `keyOf()` says which character
   * it is right now (it changes with the keyboard mode); `press()` types it.
   */
  function keyZone(rect, keyOf, press) {
    const button = hitZone(rect, { label: "key", decorative: true, onPress() {} });
    button.classList.add("ds-key");
    let gesture = null; // set while the pointer is down on this key

    // Pressing a key mustn't take keyboard focus away from the text box (or the page).
    button.addEventListener("mousedown", (event) => event.preventDefault());

    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      button.setPointerCapture(event.pointerId); // keep hearing from the pointer wherever it goes
      gesture = { startX: event.clientX, startY: event.clientY, dragging: false, key: "" };
      button.classList.add("is-down");
      play("key_down");
    });

    button.addEventListener("pointermove", (event) => {
      if (!gesture) return;
      if (!gesture.dragging) {
        const moved = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
        const key = keyOf();
        if (moved < DRAG_DISTANCE || !isCharacterKey(key)) return;
        gesture.dragging = true;
        gesture.key = key;
        draggedCharacter.textContent = key;
        draggedCharacter.hidden = false;
      }
      moveDraggedCharacter(event);
    });

    function finish(event, cancelled) {
      if (!gesture) return;
      const { dragging, key } = gesture;
      gesture = null;
      button.classList.remove("is-down");

      if (dragging) {
        draggedCharacter.hidden = true;
        if (!cancelled) dropCharacter(key, event);
        return;
      }
      // A plain press types the key, as long as the pointer is still on it when let go.
      const box = button.getBoundingClientRect();
      const stillOnKey = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!cancelled && stillOnKey) {
        press();
        play("key_up");
      }
    }
    button.addEventListener("pointerup", (event) => finish(event, false));
    button.addEventListener("pointercancel", (event) => finish(event, true));

    return button;
  }

  /** Where the dragged character is drawn: up and left of the pointer (see DRAG_OFFSET). */
  function characterOrigin(event) {
    const point = stagePoint(stage, event);
    return { x: point.x + DRAG_OFFSET.x, y: point.y + DRAG_OFFSET.y };
  }

  function moveDraggedCharacter(event) {
    place(draggedCharacter, characterOrigin(event));
  }

  /** Let go of a dragged character: if it's over the message box, it stays there. */
  function dropCharacter(character, event) {
    const origin = characterOrigin(event);
    const x = Math.round(origin.x - COMPOSE_POSITION.x);
    const y = Math.round(origin.y - COMPOSE_POSITION.y);
    if (!canDropAt(x, y)) return;

    play("drop_letter");
    onDrop(character, x, y);
  }

  // -- Which pictures and keys are active ------------------------------------

  function setMode(next) {
    mode = next;
    refresh();
  }

  function refresh() {
    const usesGrid = mode >= MODE.ACCENTS;
    normalZones.forEach((zoneButton) => (zoneButton.hidden = usesGrid));

    gridZones.forEach((zoneButton, i) => {
      const keys = gridKeys();
      const hasKey = usesGrid && (keys[i] ?? "") !== "" || (mode === MODE.JAPANESE && i >= 3 && i <= 7);
      zoneButton.hidden = !hasKey;
    });

    for (const [modeId, overlay] of Object.entries(overlays)) overlay.hidden = Number(modeId) !== mode;
    kanaOverlays[0].hidden = !(mode === MODE.JAPANESE && kana === 0);
    kanaOverlays[1].hidden = !(mode === MODE.JAPANESE && kana === 1);

    const highlighted = mode <= MODE.CAPS ? MODE.NORMAL : mode;
    for (const { button, target } of modeZones) button.classList.toggle("is-on", target === highlighted);
  }

  const gridKeys = () =>
    ({ [MODE.ACCENTS]: ACCENT_KEYS, [MODE.JAPANESE]: kana === 0 ? HIRAGANA_KEYS : KATAKANA_KEYS, [MODE.SYMBOLS]: SYMBOL_KEYS, [MODE.EMOJIS]: EMOJI_KEYS })[mode] ?? [];

  // -- Pressing keys -------------------------------------------------------

  function emitKey(key) {
    if (key === "BACKSPACE") onInput({ type: "backspace" });
    else if (key === "ENTER") onInput({ type: "enter" });
    else onInput({ type: "char", value: key });
  }

  function pressNormal(index) {
    const key = normalKeys()[index];

    if (key === "SHIFT") return setMode(mode === MODE.SHIFT ? MODE.NORMAL : MODE.SHIFT);
    if (key === "CAPS") return setMode(mode === MODE.CAPS ? MODE.NORMAL : MODE.CAPS);

    emitKey(key);
    if (mode === MODE.SHIFT) setMode(MODE.NORMAL); // shift only lasts for one key
  }

  function pressGrid(index) {
    if (mode === MODE.JAPANESE && index >= 3 && index <= 7) {
      if (index <= 4) {
        kana = index - 3; // hiragana / katakana
        refresh();
      } else {
        onInput({ type: "mark", kind: index - 5 });
      }
      return;
    }
    const key = gridKeys()[index];
    if (key) emitKey(key);
  }

  refresh();
}
