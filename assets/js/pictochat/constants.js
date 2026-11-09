/**
 * Numbers and lists shared by several modules. Keeping them in one place means
 * a question like "how long can a name be?" has exactly one answer.
 */

/** Rooms everyone can see in the list, like the first four rooms on the DS. */
export const FIXED_ROOMS = ["A", "B", "C", "D"];

/** The fifth room is private: it gets a short code, and you share a link to it. */
export const ROOM_CODE_LENGTH = 4;

export const MAX_NAME_LENGTH = 10;
export const MAX_TEXT_LENGTH = 200;

/**
 * The message box (where you write and draw) is 234 x 85 stage pixels, and
 * strokes are stored in that same unit. That keeps a drawing identical on every
 * screen size; the stage just scales it up.
 */
export const DRAW_WIDTH = 234;
export const DRAW_HEIGHT = 85;

/** Limits that stop a single message from becoming huge. */
export const MAX_PIECES = 20; // pieces of text dragged into the box (see ds/keyboard.js)
export const MAX_PIECE_TEXT = 30;
export const MAX_STROKES = 80;
export const MAX_POINTS = 3000;
export const MAX_STROKE_SIZE = 20;

/**
 * Player colors. Your color tints your message bubbles (`hex`). `ink` is a darker
 * shade of it used for your name, so the name stays readable on a white bubble.
 *
 * Messages carry only the color's `id`, never a raw CSS value, so nothing a
 * stranger sends can end up inside a style.
 */
export const COLORS = [
  { id: "red", label: "Red", hex: "#e8423c", ink: "#b3231e" },
  { id: "orange", label: "Orange", hex: "#f79a2d", ink: "#a85a00" },
  { id: "yellow", label: "Yellow", hex: "#f6d62e", ink: "#7a6600" },
  { id: "green", label: "Green", hex: "#5fbf3a", ink: "#2f7a14" },
  { id: "teal", label: "Teal", hex: "#29b6a4", ink: "#12786b" },
  { id: "blue", label: "Blue", hex: "#289acb", ink: "#106d94" },
  { id: "purple", label: "Purple", hex: "#8a5cc7", ink: "#5f35a0" },
  { id: "pink", label: "Pink", hex: "#ec6fa9", ink: "#b02e6e" },
];

export const DEFAULT_COLOR_ID = "blue";

/** Look up a color by id, falling back to the first one if the id is unknown. */
export function findColor(id) {
  return COLORS.find((color) => color.id === id) ?? COLORS[0];
}
