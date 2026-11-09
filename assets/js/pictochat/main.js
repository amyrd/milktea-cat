/**
 * PictoChat (web): entry point.
 *
 * A browser port of my terminal PictoChat (the Python/Textual project), dressed
 * in the look of the Nintendo DS original. The layout mirrors that project:
 *
 *   Python                          JavaScript
 *   picto/app.py                    main.js (this file: switches between screens)
 *   picto/state.py                  state.js, plus constants.js and protocol.js
 *   picto/server.py + ssh_driver    session.js + transport.js
 *   picto/screens/name_entry.py     screens/intro.js
 *   picto/screens/room_list.py      screens/rooms.js
 *   picto/screens/room.py           screens/room.js
 *   picto/widgets/canvas.py         ds/compose.js + ds/strokes.js
 *   picto/widgets/chatlog.py        ds/bubble.js (+ the feed in screens/room.js)
 *
 * The ds/ folder is the DS look: sprites, the stage they sit on, and the
 * on-screen keyboard. The sprites and font come from "PictoChat Online" (see
 * static/pictochat/CREDITS.md).
 *
 * Not ported: the Discord bridge, the Perspective filter and the ban list.
 * They all need a real server, and this site is static.
 *
 * Hugo bundles these files into one script (see layouts/projects/pictochat.html).
 */

import { h } from "./dom.js";
import { loadAssets } from "./ds/assets.js";
import { isMuted, loadSounds, setMuted } from "./ds/sounds.js";
import { createStage } from "./ds/stage.js";
import { loadProfile } from "./profile.js";
import { createIntroScreen } from "./screens/intro.js";
import { createRoomScreen } from "./screens/room.js";
import { createRoomsScreen } from "./screens/rooms.js";
import { Session } from "./session.js";
import { generateRoomCode, normalizeRoomCode } from "./state.js";
import { createTransport } from "./transport.js";

/** One line under the stage saying whether chat is reaching other people. */
function createStatusLine(transport) {
  const words = {
    local: "Chat works between tabs of this browser.",
    connecting: "Connecting to the chat server...",
    online: "Connected: you can chat with other visitors.",
    offline: "Can't reach the chat server, so messages can't be sent. Trying again...",
  };
  const line = h("p", { className: "pc-status", role: "status" });
  transport.onStatus((status) => (line.textContent = words[status]));
  return line;
}

/** The "Sound: on / off" button under the stage. The choice is remembered. */
function createSoundSwitch() {
  const button = h("button", {
    type: "button",
    onClick() {
      setMuted(!isMuted());
      show();
    },
  });
  const show = () => (button.textContent = isMuted() ? "Sound: off" : "Sound: on");
  show();
  return button;
}

async function start(root) {
  root.replaceChildren(h("p", { className: "pc-loading", role: "status" }, "Loading PictoChat..."));

  try {
    await loadAssets();
  } catch (error) {
    root.replaceChildren(h("p", { className: "pc-error" }, "Sorry, PictoChat couldn't load its pictures. Try reloading the page."));
    throw error;
  }

  loadSounds(); // not awaited: the page doesn't wait for sound, and works fine without it

  // The relay's address comes from hugo.toml (see layouts/projects/pictochat.html).
  // With none, chat only works between tabs of this browser.
  const transport = createTransport({ relayUrl: root.dataset.relay ?? "" });
  const session = new Session(transport);
  const stage = createStage(root);
  stage.controls.append(createStatusLine(transport), createSoundSwitch());
  let current = null;

  /**
   * Show one screen at a time. `build()` fills the stage and returns { destroy },
   * which runs when the screen is replaced so it can stop listening for events.
   */
  function show(build, { moveFocus = true } = {}) {
    current?.destroy();
    stage.clear();
    current = build();

    // Move focus to the new screen's heading so screen-reader and keyboard users notice
    // the change. preventScroll stops the page from jumping.
    if (moveFocus) stage.element.querySelector("[data-autofocus]")?.focus({ preventScroll: true });
  }

  function showIntro({ moveFocus = true } = {}) {
    show(
      () =>
        createIntroScreen({
          stage,
          initialProfile: session.me ?? loadProfile(),
          onEnter: (profile) => {
            session.setIdentity(profile);
            showRooms();
          },
        }),
      { moveFocus },
    );
  }

  function showRooms({ moveFocus = true } = {}) {
    show(
      () =>
        createRoomsScreen({
          stage,
          session,
          onJoinRoom: enterRoom,
          onJoinPrivate: enterPrivateRoom,
          onChangeName: () => showIntro(),
        }),
      { moveFocus },
    );
  }

  function enterRoom(roomId) {
    session.joinRoom(roomId);
    show(() =>
      createRoomScreen({
        stage,
        session,
        roomId,
        onLeave: () => {
          session.leaveRoom();
          history.replaceState(null, "", location.pathname + location.search); // drop the private room's code from the address
          showRooms();
        },
      }),
    );
  }

  /**
   * Private rooms are shared by link. If the page was opened with a code in the address
   * (".../#KQTM") we join that room; otherwise we make a new code and put it in the
   * address, so copying the page's link invites people to it.
   */
  function enterPrivateRoom() {
    const code = normalizeRoomCode(location.hash.slice(1)) ?? generateRoomCode();
    history.replaceState(null, "", `#${code}`);
    enterRoom(code);
  }

  // Returning visitors skip straight to the room list. On first load we don't move
  // focus: grabbing it would pull keyboard users past the page's own text.
  const savedProfile = loadProfile();
  if (savedProfile) {
    session.setIdentity(savedProfile);
    showRooms({ moveFocus: false });
  } else {
    showIntro({ moveFocus: false });
  }
}

const root = document.getElementById("pictochat");
if (root) start(root);
