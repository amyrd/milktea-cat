/**
 * Screen 2: choose a chat room. Rooms A to D are public; the fifth button makes a
 * private room whose link you can share.
 *
 * Top screen: the welcome message. Bottom screen: the room list, drawn from the
 * sprites, with a real button laid over each one. Only four fit at a time, so a
 * little arrow slides the list to reveal the fifth.
 */

import { FIXED_ROOMS, findColor } from "../constants.js";
import { h } from "../dom.js";
import { spriteUrl, tintedUrl } from "../ds/assets.js";
import { play } from "../ds/sounds.js";
import { hitZone, place, sprite, text } from "../ds/stage.js";

const LIST = { x: 31, y: 224, w: 192, h: 128 }; // the window showing four buttons at a time
const BUTTON_HEIGHT = 32;
const LETTERS = ["a", "b", "c", "d", "e"];
const ARROW = { x: 240, y: 344, w: 14, h: 14 };

/**
 * `onJoinRoom(roomId)` is called for A to D; `onJoinPrivate()` for the fifth button;
 * `onChangeName()` when the player wants to go back and edit their name.
 */
export function createRoomsScreen({ stage, session, onJoinRoom, onJoinPrivate, onChangeName }) {
  const color = findColor(session.me.colorId);
  stage.element.style.setProperty("--tint", color.hex);

  // -- The list of rooms -------------------------------------------------------
  const countLabels = {};
  const roomButtons = {};

  const entries = LETTERS.flatMap((letter, i) => {
    const isPrivate = i === 4;
    const roomId = FIXED_ROOMS[i];
    const rect = { x: 0, y: BUTTON_HEIGHT * i, w: LIST.w, h: BUTTON_HEIGHT };

    const zone = hitZone(rect, {
      label: isPrivate ? "New private chat room" : `Chat Room ${roomId}`,
      onPress: isPrivate ? onJoinPrivate : () => onJoinRoom(roomId),
    });
    if (isPrivate) return [sprite(spriteUrl(`room_${letter}`), rect), zone];

    // The head count is drawn on the sprite, to the right of the room's name.
    countLabels[roomId] = text("", { x: 130, y: BUTTON_HEIGHT * i + 10 });
    roomButtons[roomId] = zone;
    return [sprite(spriteUrl(`room_${letter}`), rect), countLabels[roomId], zone];
  });

  const track = h("div", { className: "ds-track" }, entries);
  const list = h("div", { className: "ds-list" }, track);
  place(list, LIST);

  function refreshCounts() {
    const members = session.roomCounts();
    for (const roomId of FIXED_ROOMS) {
      countLabels[roomId].textContent = `${members[roomId]}/16`;
      // The numbers are drawn on the sprite, so give the button the words to read aloud.
      roomButtons[roomId].setAttribute("aria-label", `Chat Room ${roomId}, ${members[roomId]} of 16 people`);
    }
  }

  // -- Sliding the list to reveal the fifth room -------------------------------
  const arrowSprite = sprite(spriteUrl("scroll"), ARROW, "ds-no-pointer");
  let showingLast = false;

  const arrow = hitZone(ARROW, {
    label: "Show more rooms",
    onPress() {
      play("scroll");
      showingLast = !showingLast;
      track.style.transform = showingLast ? `translateY(calc(var(--s) * -${BUTTON_HEIGHT}px))` : "";
      arrowSprite.classList.toggle("is-flipped", showingLast); // the arrow points the other way
      arrow.setAttribute("aria-label", showingLast ? "Show previous rooms" : "Show more rooms");
    },
  });

  // -- Put it all on the stage -------------------------------------------------
  stage.element.append(
    h("h2", { className: "pc-sr-only", tabindex: "-1", "data-autofocus": true }, "Choose a chat room"),
    sprite(spriteUrl("background"), { x: 0, y: 0, w: 256, h: 384 }),
    sprite(spriteUrl("opening_message"), { x: 21, y: 169, w: 234, h: 22 }),
    sprite(spriteUrl("bottom_screen"), { x: 0, y: 192, w: 256, h: 192 }),
    list,
    sprite(spriteUrl("choose"), { x: 0, y: 192, w: 256, h: 192 }, "ds-no-pointer"),
    sprite(tintedUrl("choose_mask", color.hex), { x: 0, y: 192, w: 256, h: 192 }, "ds-no-pointer"),
    arrowSprite,
    arrow,
  );

  // The player's name and a way back, as ordinary page content under the stage.
  stage.aside.append(
    h(
      "p",
      { className: "pc-hint" },
      `Signed in as ${session.me.name}. `,
      h("button", { type: "button", onClick: onChangeName }, "Change name or color"),
    ),
  );

  refreshCounts();
  const stopListening = session.on("presence", refreshCounts);
  return { destroy: stopListening };
}
