# PictoChat relay

A tiny Node server that passes each visitor's PictoChat events on to everyone
else, so people on different devices can chat. It stores nothing, but it can see
messages as they pass through (it has to, to forward them).

The website itself is static and lives on GitHub Pages. **This server is separate:
you have to run it somewhere that stays on** (a small VPS, a Raspberry Pi, a home
computer with a tunnel). GitHub Pages can't run it.

## Run it on your computer

Needs Node 18 or newer.

```bash
cd relay
npm install      # installs one package, `ws`, into relay/node_modules
npm test         # optional: 14 tests
node server.js   # listens on 127.0.0.1:8787
```

To try it with the local site, start Hugo like this so the page knows where the relay is:

```bash
HUGO_PARAMS_PICTOCHATRELAY=ws://localhost:8787 hugo server
```

Open the PictoChat page in two browsers; the status line should say "Connected".

## Settings (environment variables)

| Name | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | Port to listen on |
| `HOST` | `127.0.0.1` | Address to listen on. Keep this when a proxy sits in front |
| `ALLOWED_ORIGINS` | milktea.cat, www.milktea.cat, localhost:1313/1314 | Comma-separated sites allowed to connect |
| `MAX_CONNECTIONS` | `200` | Total visitors at once |
| `MAX_PER_ADDRESS` | `10` | Connections from one address |
| `TRUST_PROXY` | off | Set to `1` ONLY behind a reverse proxy that sets `X-Forwarded-For` |

`/health` answers `ok N` (N = people connected), handy for monitoring.

## Putting it on the internet

Your site is `https://`, so browsers only allow a secure `wss://` connection. The
relay speaks plain `ws://`, so put something in front that adds TLS. Two easy ways:

1. **Caddy** (reverse proxy, gets certificates by itself). Point a subdomain such as
   `chat.milktea.cat` at your server (an A record in Namecheap), then a Caddyfile:

   ```
   chat.milktea.cat {
       reverse_proxy 127.0.0.1:8787
   }
   ```

   Run the relay with `TRUST_PROXY=1`.
2. **Cloudflare Tunnel**, if the server is at home and you can't open ports.

Then tell the site where it is, in `hugo.toml`:

```toml
pictochatRelay = "wss://chat.milktea.cat"
```

Rebuild and push. To keep the relay running after you log out, use something like
`systemd` or `pm2`.

## What it protects against

Only the allowed sites can connect; connection, size and speed limits; a connection
can only speak as one player, and nobody can use a name someone else holds.
It does not check that message text is nice, and anyone can open your page, so
treat it as a public chat room.
