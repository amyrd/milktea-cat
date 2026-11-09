/**
 * How events travel between players.
 *
 * There are two ways, and the rest of the code doesn't know which one is in use:
 *
 *   RelayTransport              through the relay server (relay/server.js), so
 *                               visitors on different devices can chat
 *   BroadcastChannelTransport   through the browser, between tabs of the same
 *                               browser only (used when no relay is set up)
 *
 * A transport is:
 *   send(event)            post an event to everyone else
 *   onEvent(handler)       call handler(rawEvent) whenever one arrives
 *   onConnect(handler)     call handler() each time the link comes up (again)
 *   onStatus(handler)      call handler(status) now and whenever it changes:
 *                          "local" | "connecting" | "online" | "offline"
 *   isConnected()          can events be sent right now?
 *
 * Which one you get is decided in createTransport(), from the relay address
 * in hugo.toml (see layouts/projects/pictochat.html and relay/README.md).
 */

const CHANNEL_NAME = "pictochat-web";

/** Chat between tabs of the same browser. Always "connected". */
class BroadcastChannelTransport {
  constructor() {
    this._channel = new BroadcastChannel(CHANNEL_NAME);
  }

  send(event) {
    this._channel.postMessage(event);
  }

  onEvent(handler) {
    this._channel.addEventListener("message", (message) => handler(message.data));
  }

  onConnect(handler) {
    handler();
  }

  onStatus(handler) {
    handler("local");
  }

  isConnected() {
    return true;
  }
}

/** For browsers without BroadcastChannel: you can still draw and talk to yourself. */
class SoloTransport {
  send() {}
  onEvent() {}
  onConnect(handler) {
    handler();
  }
  onStatus(handler) {
    handler("local");
  }
  isConnected() {
    return true;
  }
}

const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 30_000;

/**
 * Chat through the relay server. If the connection drops (the server restarts,
 * the wifi blips), it reconnects by itself, waiting a little longer after each
 * failed try so it doesn't hammer a server that's down.
 */
class RelayTransport {
  constructor(url) {
    this._url = url;
    this._socket = null;
    this._status = "connecting";
    this._retryDelay = FIRST_RETRY_MS;
    this._retryTimer = null;
    this._eventHandlers = [];
    this._connectHandlers = [];
    this._statusHandlers = [];

    // When the device comes back online, don't wait out the retry timer.
    window.addEventListener("online", () => this._reconnectNow());
    this._connect();
  }

  send(event) {
    if (this.isConnected()) this._socket.send(JSON.stringify(event));
    // If we're not connected the event is dropped. That's fine for presence (it's
    // re-sent on reconnect); for a chat message, Session refuses to send it at all.
  }

  onEvent(handler) {
    this._eventHandlers.push(handler);
  }

  onConnect(handler) {
    this._connectHandlers.push(handler);
  }

  onStatus(handler) {
    this._statusHandlers.push(handler);
    handler(this._status);
  }

  isConnected() {
    return this._socket !== null && this._socket.readyState === WebSocket.OPEN;
  }

  _setStatus(status) {
    if (status === this._status) return;
    this._status = status;
    for (const handler of this._statusHandlers) handler(status);
  }

  _connect() {
    clearTimeout(this._retryTimer);

    let socket;
    try {
      socket = new WebSocket(this._url);
    } catch {
      // A badly written address. Nothing will ever work, but don't crash the page.
      this._setStatus("offline");
      return;
    }
    this._socket = socket;
    this._setStatus("connecting");

    socket.addEventListener("open", () => {
      this._retryDelay = FIRST_RETRY_MS;
      this._setStatus("online");
      for (const handler of this._connectHandlers) handler();
    });

    socket.addEventListener("message", (message) => {
      if (typeof message.data !== "string") return;
      let event;
      try {
        event = JSON.parse(message.data);
      } catch {
        return; // not for us
      }
      for (const handler of this._eventHandlers) handler(event);
    });

    socket.addEventListener("close", () => {
      if (this._socket !== socket) return; // an old connection we already replaced
      this._setStatus("offline");
      this._scheduleRetry();
    });
    // "error" is always followed by "close", which is where we deal with it.
  }

  _scheduleRetry() {
    const jitter = Math.random() * 0.3 * this._retryDelay; // so a restarted server isn't hit by everyone at once
    this._retryTimer = setTimeout(() => this._connect(), this._retryDelay + jitter);
    this._retryDelay = Math.min(LONGEST_RETRY_MS, this._retryDelay * 2);
  }

  _reconnectNow() {
    if (this.isConnected() || this._status === "connecting") return;
    this._retryDelay = FIRST_RETRY_MS;
    this._connect();
  }
}

/** `relayUrl` is the relay's address ("wss://..."), or empty for same-browser chat. */
export function createTransport({ relayUrl = "" } = {}) {
  if (relayUrl) return new RelayTransport(relayUrl);
  return "BroadcastChannel" in window ? new BroadcastChannelTransport() : new SoloTransport();
}
