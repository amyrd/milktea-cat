/**
 * Tests for the relay. Run them with:  npm test
 *
 * Each test starts a real relay on a free port and connects real WebSocket
 * clients to it, so these check the actual behavior, not a copy of it.
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import WebSocket from "ws";
import { createRelay } from "./server.js";

const SITE = "https://milktea.cat";
let relay = null;
const clients = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.ws.terminate();
  await relay?.close();
  relay = null;
});

async function start(options = {}) {
  relay = createRelay({ allowedOrigins: [SITE], ...options });
  return relay.listen(0);
}

/** Connect a client and keep everything it receives in `client.got`. */
async function connect(port, origin = SITE) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: origin ? { Origin: origin } : {} });
  const client = { ws, got: [], closeCode: null };
  clients.push(client);
  ws.on("message", (data) => client.got.push(JSON.parse(data.toString())));
  ws.on("close", (code) => (client.closeCode = code));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
    ws.once("unexpected-response", (request, response) => reject(Object.assign(new Error("refused"), { status: response.statusCode })));
  });
  return client;
}

const send = (client, event) => client.ws.send(typeof event === "string" ? event : JSON.stringify(event));
const presence = (id) => ({ type: "presence", player: { id, name: id, colorId: "red", roomId: "A" } });
const chat = (from, text = "hi") => ({ type: "message", roomId: "A", message: { id: `m-${from}`, from, name: from, colorId: "red", text, strokes: [], pieces: [] } });

/** Wait until `check()` is true (events travel over a real network socket, so they take a moment). */
async function until(check, what = "condition") {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`timed out waiting for ${what}`);
}
const quiet = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

test("an event goes to everyone else, but not back to the sender", async () => {
  const port = await start();
  const amy = await connect(port);
  const bob = await connect(port);
  const cara = await connect(port);

  send(amy, presence("amy"));
  await until(() => bob.got.length === 1 && cara.got.length === 1);
  assert.deepEqual(bob.got[0], presence("amy"));
  await quiet();
  assert.equal(amy.got.length, 0, "the sender doesn't get its own event back");

  send(bob, { type: "who" });
  await until(() => amy.got.length === 1 && cara.got.length === 2);
  assert.deepEqual(amy.got[0], { type: "who" });
});

test("junk is ignored: not JSON, unknown types, binary, non-objects", async () => {
  const port = await start();
  const amy = await connect(port);
  const bob = await connect(port);

  send(amy, "this is not json");
  send(amy, { type: "launch-missiles" });
  send(amy, "42");
  send(amy, "null");
  send(amy, { nothing: "here" });
  amy.ws.send(Buffer.from([1, 2, 3]), { binary: true });
  await quiet();
  assert.equal(bob.got.length, 0);

  send(amy, presence("amy")); // and a good one still gets through afterwards
  await until(() => bob.got.length === 1);
});

test("a connection can only speak for its own player id", async () => {
  const port = await start();
  const amy = await connect(port);
  const bob = await connect(port);
  const cara = await connect(port);

  send(amy, presence("amy"));
  await until(() => cara.got.length === 1);

  // Amy tries to speak as someone else: messages, presence and goodbyes.
  send(amy, chat("bob", "i am bob"));
  send(amy, presence("bob"));
  send(amy, { type: "bye", id: "bob" });
  send(amy, chat("amy", "this one is really from amy"));
  await until(() => cara.got.length === 2);
  await quiet();
  assert.equal(cara.got.length, 2);
  assert.equal(cara.got[1].message.text, "this one is really from amy");

  // Bob can't take over the id that Amy is already using.
  send(bob, presence("amy"));
  send(bob, chat("amy", "bob pretending to be amy"));
  await quiet();
  assert.equal(cara.got.length, 2, "an id that is in use can't be claimed again");

  // ...but Bob can use his own.
  send(bob, presence("bob"));
  await until(() => cara.got.length === 3);
});

test("ids must be sensible", async () => {
  const port = await start();
  const amy = await connect(port);
  const bob = await connect(port);

  for (const bad of ["", "x".repeat(65), 5, null, { nested: true }]) send(amy, { type: "presence", player: { id: bad } });
  send(amy, { type: "bye" });
  send(amy, { type: "message", message: {} });
  await quiet();
  assert.equal(bob.got.length, 0);
});

test("when a connection closes, everyone is told that player left", async () => {
  const port = await start();
  const amy = await connect(port);
  const bob = await connect(port);
  const lurker = await connect(port); // never says who they are

  send(amy, presence("amy"));
  await until(() => bob.got.length === 1);

  amy.ws.terminate(); // e.g. a crashed tab: no goodbye was sent
  await until(() => bob.got.length === 2);
  assert.deepEqual(bob.got[1], { type: "bye", id: "amy" });

  const before = bob.got.length;
  lurker.ws.terminate(); // someone who never spoke leaves quietly
  await until(() => relay.online === 1);
  await quiet();
  assert.equal(bob.got.length, before);
});

test("after a player leaves, their id can be used again (a reload)", async () => {
  const port = await start();
  const first = await connect(port);
  const watcher = await connect(port);

  send(first, presence("amy"));
  await until(() => watcher.got.length === 1);
  first.ws.terminate();
  await until(() => watcher.got.length === 2);

  const second = await connect(port);
  send(second, presence("amy"));
  await until(() => watcher.got.length === 3);
  assert.equal(watcher.got[2].type, "presence");
});

test("only the allowed sites may connect", async () => {
  const port = await start();

  await assert.rejects(connect(port, "https://evil.example"), (error) => error.status === 403);
  await assert.rejects(connect(port, "https://milktea.cat.evil.example"), (error) => error.status === 403);
  await assert.rejects(connect(port, null), (error) => error.status === 403, "no Origin header at all");

  const ok = await connect(port, SITE);
  assert.equal(ok.ws.readyState, WebSocket.OPEN);
  assert.equal(relay.online, 1);
});

test("limits: total connections and connections per address", async () => {
  const port = await start({ maxConnections: 3, maxPerAddress: 2 });
  await connect(port);
  await connect(port);
  // Every test client comes from 127.0.0.1, so the third is over the per-address limit.
  await assert.rejects(connect(port), (error) => error.status === 429);

  await relay.close();
  const port2 = await start({ maxConnections: 2, maxPerAddress: 10 });
  await connect(port2);
  await connect(port2);
  await assert.rejects(connect(port2), (error) => error.status === 503);
});

test("an address can be reused once its connections close", async () => {
  const port = await start({ maxPerAddress: 1 });
  const one = await connect(port);
  await assert.rejects(connect(port), (error) => error.status === 429);
  one.ws.close();
  await until(() => relay.online === 0);
  await connect(port);
});

test("sending too fast is dropped, and keeps being punished with a disconnect", async () => {
  const port = await start({ eventsPerSecond: 1, burst: 5 });
  const spammer = await connect(port);
  const bob = await connect(port);

  send(spammer, presence("spammer"));
  for (let i = 0; i < 60; i++) send(spammer, { type: "who" });
  await until(() => spammer.closeCode !== null, "the spammer to be disconnected");
  assert.equal(spammer.closeCode, 1008);
  assert.ok(bob.got.length <= 6, `only the first few got through, got ${bob.got.length}`);
});

test("one huge event closes the connection", async () => {
  const port = await start({ maxEventBytes: 1000 });
  const amy = await connect(port);
  const bob = await connect(port);

  send(amy, chat("amy", "x".repeat(5000)));
  await until(() => amy.closeCode !== null);
  assert.equal(amy.closeCode, 1009);
  assert.equal(bob.got.length, 0);
});

test("a dead connection that stops answering pings is dropped", async () => {
  const port = await start({ pingEveryMs: 40 });
  const client = await connect(port);
  client.ws.pause?.(); // a client that stops reading can't answer pings
  client.ws._socket.pause();
  await until(() => relay.online === 0, "the silent connection to be dropped");
});

test("/health says the relay is up", async () => {
  const port = await start();
  await connect(port);
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), "ok 1");

  const other = await fetch(`http://127.0.0.1:${port}/anything`);
  assert.equal(other.status, 426);
});

test("behind a proxy, the real address comes from X-Forwarded-For", async () => {
  const port = await start({ trustProxy: true, maxPerAddress: 1 });
  const connectAs = async (address) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: SITE, "X-Forwarded-For": address } });
    const client = { ws, got: [] };
    clients.push(client);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("unexpected-response", (request, response) => reject(Object.assign(new Error("refused"), { status: response.statusCode })));
      ws.once("error", reject);
    });
  };
  await connectAs("203.0.113.1");
  await connectAs("203.0.113.2"); // a different visitor behind the same proxy is fine
  await assert.rejects(connectAs("203.0.113.1"), (error) => error.status === 429);
});
