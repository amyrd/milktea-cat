/**
 * Remembering your name and color between visits (in the browser's localStorage),
 * so you don't have to retype them.
 */

import { COLORS } from "./constants.js";
import { cleanName } from "./state.js";

const STORAGE_KEY = "pictochat.profile";

/** The saved { name, colorId }, or null if there isn't a valid one. */
export function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const name = cleanName(saved?.name);
    const hasKnownColor = COLORS.some((color) => color.id === saved?.colorId);
    return name !== "" && hasKnownColor ? { name, colorId: saved.colorId } : null;
  } catch {
    return null; // storage blocked, or the saved data was garbled
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be blocked (private windows, strict settings). Not worth bothering anyone about.
  }
}
