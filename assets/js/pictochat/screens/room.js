/**
 * Screen 3: inside a room. Port of screens/room.py.
 *
 * Top screen: the chat, as message bubbles and join/leave bars.
 * Bottom screen: the box you write in, plus the tools and the on-screen keyboard
 * (all part of one sprite, with a real button laid over every control).
 *
 * The caller (main.js) has already joined the room by the time this is built.
 */

import { MAX_TEXT_LENGTH, findColor } from "../constants.js";
import { appendAll, h } from "../dom.js";
import { spriteUrl } from "../ds/assets.js";
import { createBubble, createNotice } from "../ds/bubble.js";
import { createCompose } from "../ds/compose.js";
import { createKeyboard } from "../ds/keyboard.js";
import { play } from "../ds/sounds.js";
import { hitZone, place, sprite } from "../ds/stage.js";
import { describeRoom } from "../state.js";

const FEED = { x: 21, y: 0, w: 234, h: 190 };
const MAX_ENTRIES = 200; // keep the page light: older chat drops off after this many entries
const NEAR_BOTTOM = 40; // pixels from the bottom that still counts as "reading the latest"

const PEN = { x: 2, y: 230, w: 14, h: 13 };
const ERASER = { x: 2, y: 244, w: 14, h: 13 };
const BIG_LINE = { x: 2, y: 263, w: 14, h: 14 };
const SMALL_LINE = { x: 2, y: 278, w: 14, h: 14 };

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `onLeave()` is called when the player presses EXIT. */
export function createRoomScreen({ stage, session, roomId, onLeave }) {
  const me = session.me;
  const color = findColor(me.colorId);
  const isPrivate = roomId.length > 1;
  const letter = isPrivate ? "e" : roomId.toLowerCase(); // private rooms share the "E" sprites
  stage.element.style.setProperty("--tint", color.hex);

  // -- The chat (top screen) ---------------------------------------------------
  const feed = h("div", { className: "ds-feed", "aria-hidden": "true" });
  place(feed, FEED);

  // The pictures are for people who can see them; this list is the same chat as text.
  const readableLog = h("ol", { className: "pc-sr-only", role: "log", "aria-label": "Chat messages" });

  /** Add something to the chat, and stay pinned to the newest entry unless the user scrolled up. */
  function addToChat(visual, words) {
    const wasNearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < NEAR_BOTTOM;

    feed.append(visual);
    readableLog.append(h("li", {}, words));
    while (feed.children.length > MAX_ENTRIES) feed.firstElementChild.remove();
    while (readableLog.children.length > MAX_ENTRIES) readableLog.firstElementChild.remove();

    if (wasNearBottom) feed.scrollTop = feed.scrollHeight;
  }

  const welcome = h("div", { className: "ds-box" }, sprite(spriteUrl("opening_message"), { x: 0, y: 0, w: 234, h: 22 }));
  place(welcome, { w: 234, h: 22 });
  feed.append(welcome);

  function describeMessage(message, mine) {
    const who = mine ? "You" : message.name;
    const placed = message.pieces.map((piece) => piece.text).join(" ");
    const drawing = message.strokes.length > 0 ? " [drawing]" : "";
    return `${who}: ${[message.text, placed].filter(Boolean).join(" ")}${drawing}`;
  }

  // -- The box you write in (bottom screen) ------------------------------------
  // The real keyboard types into this hidden text box, which is also what screen
  // readers and phone keyboards talk to. The compose box shows whatever it holds.
  const textInput = h("textarea", {
    id: "pc-text",
    className: "pc-sr-only",
    rows: "1",
    maxlength: MAX_TEXT_LENGTH,
    "aria-label": "Message. Press Enter to send, or Shift and Enter for a new line.",
    autocomplete: "off",
    spellcheck: "false",
  });
  const focusTyping = () => textInput.focus({ preventScroll: true });

  const compose = createCompose({
    colorId: me.colorId,
    name: me.name,
    onChange: syncTextInput,
    onActivate: focusTyping,
  });

  // The text box always holds whatever typing is going into: the flowing text, or a
  // piece that was dropped on the box (see ds/compose.js).
  function syncTextInput() {
    if (textInput.value !== compose.getActiveText()) textInput.value = compose.getActiveText();
  }

  textInput.addEventListener("input", () => {
    if (!compose.setActiveText(textInput.value)) textInput.value = compose.getActiveText(); // too long for the box: undo
  });
  textInput.addEventListener("keydown", (event) => {
    play("key_down");
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send();
    }
  });
  textInput.addEventListener("keyup", () => play("key_up"));

  // If someone just starts typing while nothing in particular has focus (or focus is on
  // the stage), send the keys to the text box. Space is left alone so it can still scroll the page.
  function redirectTyping(event) {
    const nothingFocused = event.target === document.body || stage.element.contains(event.target);
    const isControl = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement;
    const isTyping = event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (nothingFocused && !isControl && isTyping) {
      play("key_down"); // the text box isn't listening yet for this first key, so click for it here
      focusTyping();
    }
  }
  document.addEventListener("keydown", redirectTyping);

  // -- Buttons ---------------------------------------------------------------
  let lastSent = null;

  function send() {
    const message = compose.getMessage();
    const nothingToSend = compose.isEmpty();
    if (nothingToSend || !session.sendMessage(message)) return play("error");

    play("send");
    lastSent = message; // kept so RENEW can bring it back
    compose.clear();
    focusTyping();
  }

  function renew() {
    if (!lastSent) return play("error");
    play("retrieve");
    compose.restore(lastSent);
  }

  function clearBox() {
    play(compose.isEmpty() ? "error" : "clear");
    compose.clear();
  }

  /** A button that is either on or off, drawn as a highlight over the sprite. */
  function toggleZone(rect, label, onPress) {
    const zone = hitZone(rect, { label, onPress });
    zone.setAttribute("aria-pressed", "false");
    return zone;
  }
  const setOn = (zone, on) => {
    zone.setAttribute("aria-pressed", String(on));
    zone.classList.toggle("is-on", on);
  };

  let usingEraser = false;
  let thick = true;
  const penZone = toggleZone(PEN, "Pen", () => {
    play("pen");
    chooseTool(false, thick);
  });
  const eraserZone = toggleZone(ERASER, "Eraser", () => {
    play("eraser");
    chooseTool(true, thick);
  });
  const thickZone = toggleZone(BIG_LINE, "Thick line", () => {
    play("big_pen");
    chooseTool(usingEraser, true);
  });
  const thinZone = toggleZone(SMALL_LINE, "Thin line", () => {
    play("small_pen");
    chooseTool(usingEraser, false);
  });

  function chooseTool(eraser, isThick) {
    usingEraser = eraser;
    thick = isThick;
    const penSize = isThick ? 2 : 1;
    compose.setTool(eraser ? "eraser" : "pen", eraser ? penSize * 3 : penSize); // the eraser is wider than the pen
    setOn(penZone, !eraser);
    setOn(eraserZone, eraser);
    setOn(thickZone, isThick);
    setOn(thinZone, !isThick);
  }
  chooseTool(false, true);

  const scrollChat = (direction) => {
    play("scroll");
    feed.scrollBy({ top: direction * feed.clientHeight * 0.6, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const copyStatus = h("span", { className: "pc-sr-only", role: "status" });
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      copyStatus.textContent = "Link copied.";
      play("retrieve");
    } catch {
      copyStatus.textContent = "Could not copy the link. Copy it from the address bar instead.";
    }
  }

  // -- Put it all on the stage -------------------------------------------------
  appendAll(
    stage.element,
    h("h2", { className: "pc-sr-only", tabindex: "-1", "data-autofocus": true }, describeRoom(roomId)),
    sprite(spriteUrl("background"), { x: 0, y: 0, w: 256, h: 384 }),
    feed,
    readableLog,
    sprite(spriteUrl("bottom_screen"), { x: 0, y: 192, w: 256, h: 192 }),
    sprite(spriteUrl("drawui"), { x: 0, y: 192, w: 256, h: 192 }),
    sprite(spriteUrl(`letter_room_${letter}`), { x: 1, y: 192, w: 16, h: 16 }),
    isPrivate ? sprite(spriteUrl("copy_link"), { x: 19, y: 193, w: 38, h: 10 }) : null,
    compose.element,
  );
  createKeyboard({
    stage: stage.element,
    onInput: (input) => compose.type(input),
    onDrop: (character, x, y) => compose.dropPiece(character, x, y),
  });
  appendAll(
    stage.element,
    penZone,
    eraserZone,
    thickZone,
    thinZone,
    hitZone({ x: 2, y: 194, w: 14, h: 14 }, { label: "Scroll chat up", onPress: () => scrollChat(-1) }),
    hitZone({ x: 2, y: 209, w: 14, h: 14 }, { label: "Scroll chat down", onPress: () => scrollChat(1) }),
    hitZone({ x: 225, y: 296, w: 31, h: 30 }, { label: "Send", onPress: send }),
    hitZone({ x: 225, y: 327, w: 31, h: 23 }, { label: "Bring back your last message", onPress: renew }),
    hitZone({ x: 225, y: 351, w: 31, h: 24 }, { label: "Clear what you are writing", onPress: clearBox }),
    hitZone({ x: 245, y: 193, w: 10, h: 10 }, {
        label: "Leave room",
        onPress() {
          play("leave_room");
          onLeave();
        },
      }),
    isPrivate ? hitZone({ x: 19, y: 193, w: 38, h: 10 }, { label: "Copy invite link", onPress: copyLink }) : null,
    textInput,
    copyStatus,
  );

  // -- Who is here, as ordinary page content under the stage -------------------
  const roster = h("p", { className: "pc-hint", role: "status" });
  appendAll(
    stage.aside,
    isPrivate
      ? h("p", { className: "pc-hint" }, `${describeRoom(roomId)}. Anyone with this page's link can join. Use the link button at the top of the room to copy it.`)
      : null,
    roster,
  );

  function refreshRoster() {
    const names = session.playersIn(roomId).map((player) => player.name).sort((a, b) => a.localeCompare(b));
    roster.textContent =
      names.length > 1
        ? `Here now: ${names.join(", ")}.`
        : "You're the only one here. Chat is shared between tabs of this browser, so open this page in a second tab to talk to yourself.";
  }

  play("join_room");
  addToChat(createNotice("joined", letter, me.name), `You entered ${describeRoom(roomId)}.`);
  refreshRoster();

  const stopListening = [
    session.on("message", ({ message, mine }) => {
      addToChat(createBubble(message), describeMessage(message, mine));
      if (!mine) play("receive");
    }),
    session.on("notice", ({ type, name }) => {
      addToChat(createNotice(type, letter, name), `${name} ${type === "joined" ? "joined" : "left"}.`);
      play(type === "joined" ? "player_join" : "player_leave");
    }),
    session.on("presence", refreshRoster),
  ];

  return {
    destroy() {
      stopListening.forEach((stop) => stop());
      document.removeEventListener("keydown", redirectTyping); // the page outlives this screen
    },
  };
}
