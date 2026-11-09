/**
 * One player's connection to PictoChat. This is the port of server.py: the
 * screens talk to a Session, and the Session talks to the transport.
 *
 * How the tabs stay in sync (no server involved):
 *   - Each tab holds its own ChatState: its picture of who is where.
 *   - When you change something about yourself (name, room) you broadcast a
 *     "presence" event, and everyone else updates their picture.
 *   - When you open the page you broadcast "who" and everyone answers with
 *     their presence, so you learn who's already here.
 *   - When you close the tab you broadcast "bye".
 *
 * The screens listen for three things:
 *   "presence"  somebody arrived, left or moved (refresh counts and rosters)
 *   "notice"    someone joined or left *your* room: { type: "joined" | "left", name }
 *   "message"   a message was posted in your room (yours included)
 */

import { ChatState } from "./state.js";
import { EventType, parseEvent, presenceEvent, byeEvent, whoEvent, messageEvent } from "./protocol.js";

/** The smallest possible "something happened" notifier. */
class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  /** Subscribe to an event. Returns a function that unsubscribes again. */
  on(name, handler) {
    if (!this._handlers.has(name)) this._handlers.set(name, new Set());
    this._handlers.get(name).add(handler);
    return () => this._handlers.get(name).delete(handler);
  }

  emit(name, payload) {
    for (const handler of this._handlers.get(name) ?? []) handler(payload);
  }
}

// Every HEARTBEAT_MS each tab repeats its presence, and anyone not heard from
// for STALE_AFTER_MS is dropped. The gap is generous on purpose: browsers slow
// timers down in background tabs (sometimes to once a minute), and we'd rather
// show a crashed tab's name for a minute too long than drop a live one.
const HEARTBEAT_MS = 15_000;
const STALE_AFTER_MS = 90_000;

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class Session {
  constructor(transport) {
    this._transport = transport;
    this._state = new ChatState();
    this._emitter = new Emitter();

    /** The local player: { id, name, colorId, roomId }. Null until the name screen is done. */
    this.me = null;

    transport.onEvent((raw) => this._handleEvent(parseEvent(raw)));

    // Each time the link comes up (the first time, or again after a drop) say who we
    // are and ask who else is around: we may have missed things while disconnected.
    transport.onConnect(() => {
      if (this.me) this._announce({ askForOthers: true });
    });

    // Tell everyone we're gone when the tab closes or navigates away...
    window.addEventListener("pagehide", () => {
      if (this.me) this._transport.send(byeEvent(this.me.id));
    });
    // ...and say hello again if the browser brings the page back from its back/forward cache.
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && this.me) this._announce({ askForOthers: true });
    });

    // Goodbyes can get lost (see STALE_AFTER_MS), so keep announcing ourselves
    // and tidy up anyone who has gone quiet. Runs for as long as the page does.
    setInterval(() => this._heartbeat(), HEARTBEAT_MS);
  }

  on(name, handler) {
    return this._emitter.on(name, handler);
  }

  // -- What the screens can ask for ----------------------------------------

  /** Set (or change) the local player's name and color. */
  setIdentity({ name, colorId }) {
    if (this.me) {
      this.me = { ...this.me, name, colorId };
    } else {
      this.me = { id: newId(), name, colorId, roomId: null };
    }
    this._announce({ askForOthers: true });
  }

  joinRoom(roomId) {
    this.me = { ...this.me, roomId };
    this._announce();
  }

  leaveRoom() {
    this.me = { ...this.me, roomId: null };
    this._announce();
  }

  /**
   * Post a message to the room we're in. Returns false (and sends nothing) if
   * we aren't in a room, can't reach the chat server, or the message is empty or
   * over the size limits.
   */
  sendMessage({ text, strokes, pieces = [] }) {
    if (!this.me || this.me.roomId === null || !this._transport.isConnected()) return false;

    const { roomId, name, colorId, id: from } = this.me;
    const draft = messageEvent(roomId, { id: newId(), from, name, colorId, text, strokes, pieces });

    // Run our own message through the same checks incoming ones get.
    const event = parseEvent(draft);
    if (!event) return false;

    this._transport.send(event);
    this._emitter.emit("message", { roomId, message: event.message, mine: true });
    return true;
  }

  playersIn(roomId) {
    return this._state.playersIn(roomId);
  }

  roomCounts() {
    return this._state.countsByRoom();
  }

  // -- Internals -----------------------------------------------------------

  /** Record our own presence locally and tell everyone else about it. */
  _announce({ askForOthers = false } = {}) {
    this._state.applyPresence(this.me);
    this._transport.send(presenceEvent(this.me));
    if (askForOthers) this._transport.send(whoEvent());
    this._emitter.emit("presence");
  }

  /** Repeat our presence so others know we're alive, and drop players who've gone quiet. */
  _heartbeat() {
    if (!this.me) return;

    this._state.applyPresence(this.me); // refreshes our own "last heard from" time too
    this._transport.send(presenceEvent(this.me));

    const changes = this._state.removeStale(STALE_AFTER_MS);
    if (changes.length > 0) {
      this._showChanges(changes);
      this._emitter.emit("presence");
    }
  }

  _handleEvent(event) {
    if (!event || !this.me) return;

    switch (event.type) {
      case EventType.WHO:
        this._transport.send(presenceEvent(this.me));
        break;

      case EventType.PRESENCE:
        this._showChanges(this._state.applyPresence(event.player));
        this._emitter.emit("presence");
        break;

      case EventType.BYE:
        this._showChanges(this._state.removePlayer(event.id));
        this._emitter.emit("presence");
        break;

      case EventType.MESSAGE:
        if (event.roomId === this.me.roomId) {
          this._emitter.emit("message", { roomId: event.roomId, message: event.message, mine: false });
        }
        break;
    }
  }

  /** Turn "someone joined/left our room" into "notice" events for the chat log. */
  _showChanges(changes) {
    for (const change of changes) {
      if (change.roomId !== this.me.roomId || change.player.id === this.me.id) continue;
      this._emitter.emit("notice", { type: change.type, roomId: change.roomId, name: change.player.name });
    }
  }
}
