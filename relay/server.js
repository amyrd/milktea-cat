/**
 * The PictoChat relay: a small server that passes each visitor's events on to
 * everyone else, so people on different devices can chat.
 *
 * It's the same job the browser's BroadcastChannel did between tabs, only over
 * the internet. A visitor connects with a WebSocket and sends small JSON events
 * (see assets/js/pictochat/protocol.js in the site): "who", "presence", "bye" and
 * "message". The relay forwards each one, unchanged, to every OTHER visitor. It
 * never stores anything and never looks inside a message beyond the checks below.
 *
 * Because it faces the whole internet, it is strict:
 *   - Only pages from allowed sites (ALLOWED_ORIGINS) may connect.
 *   - Limits on how many connections there are (overall, and per address), how big
 *     one event can be, and how fast one visitor can send.
 *   - A connection can only speak for ONE player id, and two connections can't
 *     share an id, so nobody can send messages "from" somebody else.
 *   - When a connection closes, the relay announces "bye" for that player, so
 *     nobody is left looking like they're still in a room.
 *
 * Run it:  node server.js     (settings are environment variables; see README.md)
 */

import http from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";

const EVENT_TYPES = new Set(["who", "presence", "bye", "message"]);

const DEFAULT_ORIGINS = [
  "https://milktea.cat",
  "https://www.milktea.cat",
  // For trying things out on your own computer:
  "http://localhost:1313",
  "http://localhost:1314",
  "http://127.0.0.1:1313",
  "http://127.0.0.1:1314",
];

/**
 * Create a relay. Nothing listens until you call `relay.listen(port, host)`.
 * Every option has a sensible default; tests override some of them.
 */
export function createRelay({
  allowedOrigins = DEFAULT_ORIGINS,
  maxConnections = 200,
  maxPerAddress = 10,
  maxEventBytes = 100_000,
  eventsPerSecond = 10, // how many events per second one visitor can send, on average
  burst = 30, // ...and how many at once before being slowed down
  pingEveryMs = 30_000,
  trustProxy = false, // true only if a reverse proxy in front of this adds X-Forwarded-For
  log = () => {},
} = {}) {
  const connections = new Set();
  const ownerOfId = new Map(); // player id -> the connection speaking for it
  const connectionsPerAddress = new Map();

  const server = http.createServer((request, response) => {
    // A plain page so you (or a monitoring service) can check the relay is up.
    if (request.url === "/health") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(`ok ${connections.size}\n`);
      return;
    }
    response.writeHead(426, { "Content-Type": "text/plain" });
    response.end("This is the PictoChat relay. It only speaks WebSocket.\n");
  });

  const sockets = new WebSocketServer({ noServer: true, maxPayload: maxEventBytes });

  // -- Letting visitors in ---------------------------------------------------------

  server.on("upgrade", (request, socket, head) => {
    const refuse = (status, reason) => {
      log(`refused (${reason})`);
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };

    if (!allowedOrigins.includes(request.headers.origin)) return refuse("403 Forbidden", "origin not allowed");
    if (connections.size >= maxConnections) return refuse("503 Service Unavailable", "full");

    const address = addressOf(request, trustProxy);
    if ((connectionsPerAddress.get(address) ?? 0) >= maxPerAddress) return refuse("429 Too Many Requests", "too many from one address");

    sockets.handleUpgrade(request, socket, head, (ws) => accept(ws, address));
  });

  function accept(ws, address) {
    const connection = { ws, address, playerId: null, alive: true, tokens: burst, lastRefill: Date.now(), strikes: 0 };
    connections.add(connection);
    connectionsPerAddress.set(address, (connectionsPerAddress.get(address) ?? 0) + 1);
    log(`connected (${connections.size} online)`);

    ws.on("pong", () => (connection.alive = true));
    ws.on("message", (data, isBinary) => handleEvent(connection, data, isBinary));
    ws.on("error", () => {}); // a broken connection is handled by "close"
    ws.on("close", () => leave(connection));
  }

  // -- Handling what a visitor sends ----------------------------------------------

  /** Allow `eventsPerSecond` on average, with short bursts of up to `burst`. */
  function allowedToSend(connection) {
    const now = Date.now();
    connection.tokens = Math.min(burst, connection.tokens + ((now - connection.lastRefill) / 1000) * eventsPerSecond);
    connection.lastRefill = now;
    if (connection.tokens < 1) return false;
    connection.tokens -= 1;
    return true;
  }

  function handleEvent(connection, data, isBinary) {
    if (isBinary) return;

    if (!allowedToSend(connection)) {
      if (++connection.strikes >= 20) connection.ws.close(1008, "too fast");
      return;
    }

    const text = data.toString();
    let event;
    try {
      event = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof event !== "object" || event === null || !EVENT_TYPES.has(event.type)) return;

    // Whoever sends anything but "who" is speaking for a player; pin the connection to that id.
    if (event.type !== "who" && !claimId(connection, speakerOf(event))) return;

    forwardToOthers(connection, text);
  }

  /** The player id an event says it is from. */
  function speakerOf(event) {
    if (event.type === "presence") return event.player?.id;
    if (event.type === "message") return event.message?.from;
    if (event.type === "bye") return event.id;
    return undefined;
  }

  /** A connection may speak for exactly one id, and an id can have only one connection. */
  function claimId(connection, id) {
    if (typeof id !== "string" || id.length === 0 || id.length > 64) return false;
    if (connection.playerId !== null) return connection.playerId === id;
    if (ownerOfId.has(id)) return false;

    ownerOfId.set(id, connection);
    connection.playerId = id;
    return true;
  }

  function forwardToOthers(sender, text) {
    for (const other of connections) {
      if (other !== sender && other.ws.readyState === other.ws.OPEN) other.ws.send(text);
    }
  }

  // -- Letting go ----------------------------------------------------------------

  function leave(connection) {
    if (!connections.delete(connection)) return;

    const remaining = (connectionsPerAddress.get(connection.address) ?? 1) - 1;
    if (remaining > 0) connectionsPerAddress.set(connection.address, remaining);
    else connectionsPerAddress.delete(connection.address);

    if (connection.playerId !== null && ownerOfId.get(connection.playerId) === connection) {
      ownerOfId.delete(connection.playerId);
      // Everyone should stop showing this player, even if their tab never said goodbye.
      forwardToOthers(connection, JSON.stringify({ type: "bye", id: connection.playerId }));
    }
    log(`left (${connections.size} online)`);
  }

  // Every so often, ping everyone and drop anyone who didn't answer the last ping.
  const pinger = setInterval(() => {
    for (const connection of connections) {
      if (!connection.alive) {
        connection.ws.terminate();
        continue;
      }
      connection.alive = false;
      connection.ws.ping();
    }
  }, pingEveryMs);
  pinger.unref();

  return {
    server,

    /** How many visitors are connected right now. */
    get online() {
      return connections.size;
    },

    /** Start accepting connections. Resolves with the port actually used (pass 0 to pick any free one). */
    listen(port, host = "127.0.0.1") {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve(server.address().port));
      });
    },

    /** Disconnect everyone and stop listening. */
    close() {
      clearInterval(pinger);
      for (const connection of connections) connection.ws.terminate();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

/** Who is connecting. Behind a reverse proxy the real address is in X-Forwarded-For. */
function addressOf(request, trustProxy) {
  const forwarded = request.headers["x-forwarded-for"];
  if (trustProxy && typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return request.socket.remoteAddress ?? "unknown";
}

// -- Running it for real ------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1"; // only this computer, unless you say otherwise
  const origins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);

  const relay = createRelay({
    allowedOrigins: origins?.length ? origins : DEFAULT_ORIGINS,
    maxConnections: Number(process.env.MAX_CONNECTIONS ?? 200),
    maxPerAddress: Number(process.env.MAX_PER_ADDRESS ?? 10),
    trustProxy: process.env.TRUST_PROXY === "1",
    log: (line) => console.log(`${new Date().toISOString()} ${line}`),
  });

  await relay.listen(port, host);
  console.log(`PictoChat relay listening on ${host}:${port}`);
  console.log(`Allowed sites: ${(origins?.length ? origins : DEFAULT_ORIGINS).join(", ")}`);

  const shutDown = async () => {
    console.log("Shutting down...");
    await relay.close();
    process.exit(0);
  };
  process.on("SIGINT", shutDown);
  process.on("SIGTERM", shutDown);
}
