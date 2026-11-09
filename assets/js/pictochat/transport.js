/**
 * How events travel between players.
 *
 * The Python version used an SSH server so everyone shared one process. This
 * site is static (GitHub Pages), so there is no server to talk to. Instead we
 * use the browser's BroadcastChannel: every tab of this site, in the same
 * browser, can hear what the others post. Open PictoChat in two tabs and you
 * can chat with yourself.
 *
 * Nothing else in the code knows how events travel. A transport is just:
 *   send(event)        post an event to everyone else
 *   onEvent(handler)   call handler(rawEvent) whenever one arrives
 * So chatting between real visitors later only means writing a second
 * transport (say, one that wraps a WebSocket) and returning it from
 * createTransport(). Nothing else has to change.
 */

const CHANNEL_NAME = "pictochat-web";

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
}

/** Fallback for browsers without BroadcastChannel: you can still draw and talk to yourself. */
class SoloTransport {
  send() {}
  onEvent() {}
}

export function createTransport() {
  return "BroadcastChannel" in window ? new BroadcastChannelTransport() : new SoloTransport();
}
