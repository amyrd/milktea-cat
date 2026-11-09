/**
 * Loading the DS sprites and font, and tinting sprites with a player's color.
 *
 * The sprites live in static/pictochat/ (see CREDITS.md there for where they
 * came from). The bubble sprites are drawn in white so each can be tinted with
 * its player's color by multiplying, the same way a game engine "tints" a sprite.
 */

const BASE = "/pictochat/";

/** Every sprite the app uses, by file name (without .png). */
const SPRITE_NAMES = [
  "background", "bottom_screen", "choose", "choose_mask", "drawui",
  "shift", "caps", "accents", "symbols", "emojis", "japanese", "japanese2",
  "intro_bg", "logo", "scroll", "copy_link", "opening_message",
  ...["a", "b", "c", "d", "e"].flatMap((letter) => [
    `room_${letter}`, `letter_room_${letter}`, `enter_room_${letter}`, `leave_room_${letter}`,
  ]),
  ...[1, 2, 3, 4, 5].flatMap((lines) => [`box_bg${lines}`, `box_lines${lines}`, `box_outline${lines}`]),
];

const images = new Map();
const tintCache = new Map();

export const spriteUrl = (name) => `${BASE}images/${name}.png`;

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      images.set(name, image);
      resolve();
    };
    image.onerror = () => reject(new Error(`Could not load sprite "${name}"`));
    image.src = spriteUrl(name);
  });
}

/** Load every sprite and the pixel font. Resolves once they are all ready to draw. */
export async function loadAssets() {
  // The @font-face rule for "nds" is in pictochat.css; this just waits for the file.
  const font = document.fonts.load('10px nds');
  await Promise.all([font, ...SPRITE_NAMES.map(loadImage)]);
}

/**
 * A version of a sprite multiplied by `hex` (like "#e8423c"), as an image URL.
 * Transparent parts stay transparent. Results are cached.
 */
export function tintedUrl(name, hex) {
  const key = `${name}|${hex}`;
  if (tintCache.has(key)) return tintCache.get(key);

  const source = images.get(name);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "multiply"; // colors the sprite...
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-in"; // ...then cuts it back to the sprite's shape
  ctx.drawImage(source, 0, 0);

  const url = canvas.toDataURL();
  tintCache.set(key, url);
  return url;
}

/** Make a color lighter: percent = 0 leaves it alone, 100 is white. */
export function lighten(hex, percent) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const lightened = channels.map((value) => Math.round(value + ((255 - value) * percent) / 100));
  return `#${lightened.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
