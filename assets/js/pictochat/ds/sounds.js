/**
 * The sound effects: key clicks, pens, sending, joining and so on.
 *
 * They are played with the browser's Web Audio engine, which can start the same
 * sound many times at once and change how loud each one is (the drawing sound gets
 * louder the faster you draw).
 *
 * Two rules from browsers shape this file:
 *   - Sound is only allowed after the person has clicked or pressed a key on the
 *     page, so the audio engine is created on the first such gesture.
 *   - Sound should always be switchable off. isMuted()/setMuted() back the
 *     "Sound" button under the stage, and the choice is remembered.
 *
 * If the sound files can't be loaded, everything here quietly does nothing.
 */

const FOLDER = "/pictochat/sounds/";
const NAMES = [
  "big_pen", "clear", "draw", "draw_down", "drop_letter", "eraser", "error", "join_room", "key_down", "key_up",
  "leave_room", "pen", "player_join", "player_leave", "receive", "retrieve", "scroll", "send", "small_pen", "start_app",
];
const STORAGE_KEY = "pictochat.muted";

const ready = new Map(); // name -> audio that is ready to play
let engine = null; // the Web Audio engine, created on the first click or key press
let muted = readMuted();

const SILENT = { stop() {} };

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Download every sound file and get it ready to play. Failures are ignored: the
 * page just stays quiet.
 *
 * The files are decoded here, ahead of time, with an "offline" decoder, which
 * (unlike the real audio engine) is allowed to run before anyone has clicked.
 * That way the very first click already has its sound ready.
 */
export async function loadSounds() {
  if (!window.OfflineAudioContext) return;
  const decoder = new OfflineAudioContext(1, 1, 48000);

  await Promise.all(
    NAMES.map(async (name) => {
      try {
        const response = await fetch(`${FOLDER}${name}.mp3`);
        if (!response.ok) return;
        ready.set(name, await decoder.decodeAudioData(await response.arrayBuffer()));
      } catch {
        // No network, a missing file, or a format this browser can't play.
      }
    }),
  );
}

/** Create (or wake up) the audio engine. Browsers only let this happen during a click or key press. */
function unlock() {
  const Engine = window.AudioContext || window.webkitAudioContext;
  if (!Engine) return;

  engine ??= new Engine();
  if (engine.state === "suspended") engine.resume();
}
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

/**
 * Play a sound. `volume` is 0 to 1; `offset` starts it that many seconds in.
 * Returns { stop() } so a long sound can be cut short.
 */
export function play(name, { volume = 1, offset = 0 } = {}) {
  const audio = ready.get(name);
  if (muted || !engine || !audio) return SILENT;

  const source = engine.createBufferSource();
  source.buffer = audio;
  const loudness = engine.createGain();
  loudness.gain.value = Math.min(1, Math.max(0, volume));
  source.connect(loudness).connect(engine.destination);
  source.start(0, offset);

  return {
    stop() {
      try {
        source.stop();
      } catch {
        // It had already finished.
      }
    },
  };
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Not being able to remember the choice isn't worth bothering anyone about.
  }
}
