# Signum Sandbox

The sandbox to start building cool blockchain apps with Signum — no costs, no risk, no friction.

A local Signum node running an offline mock network, with a UI built for getting started.

## For users

Download the latest release, unpack it, and run:

```bash
./scripts/start.sh      # macOS, Linux
scripts\start.cmd       # Windows
```

Then open **http://localhost:6876/**. You need Java 21 or newer.

## For developers

```bash
./scripts/bootstrap.sh   # pulls the node jar and API docs from a pinned release
bun install
bun run build            # builds the UI into html/sandbox
./scripts/start.sh       # serves it at http://localhost:6876/
```

For UI work, `bun run dev` serves the UI on http://localhost:5173 with `/api` and
`/events` proxied to the node, so changes reload without rebuilding. The node
has to be running separately — `bun run dev` alone will report that it cannot
find one.

### Pointing the dev server at another node

Copy `.env.example` to `.env.local` and set the node you want:

```
VITE_NODE_URL=http://192.168.15.3:6876
```

Or pass it inline, which takes precedence:

```bash
VITE_NODE_URL=http://192.168.15.3:6876 bun run dev
```

Both the API and the event socket follow, and both travel through the Vite
proxy, so the browser never makes a cross-origin request and the node needs no
CORS configuration. The variable affects development only: a production build
is served by the node itself and talks to its own origin.

| Command | Does |
|---|---|
| `./scripts/bootstrap.sh` | fetches node artifacts; `--latest` resolves the newest release |
| `./scripts/start.sh` / `scripts\start.cmd` | starts the node headless; `--gui` for its own window, `--reset` to begin from an empty chain |
| `bun run test` | unit tests |
| `./scripts/smoke.sh` | starts the node and checks every mount responds |
| `./scripts/package.sh` | assembles the release deliverable |

The node version is pinned in `.signum-node-version`. Nothing the bootstrap
downloads is committed.

## What is served

| URL | |
|---|---|
| `/` | the sandbox UI, which leads to the console |
| `/#/console` | the sandbox console — accounts, forging, transactions |
| `/api-doc/` | the node's API documentation |
| `/api` | the node's JSON API |
| `/events` | the node's WebSocket event stream |

## Forging blocks

The console's forge button mines a block on demand, and auto-forge keeps
mining at an interval. Under the hood, the mock network accepts any nonce, so
a block is one request away:

```bash
curl -X POST "http://localhost:6876/api?requestType=submitNonce&secretPhrase=whatever&nonce=0"
```

That's the scriptable alternative when you want blocks from a shell or a test
rather than the UI. Leave out `accountId` — passing it routes the call into
passthrough mining, which fails once the passphrase's account exists on
chain. The forger receives 10,000 SIGNA per block. Calls fired in rapid
succession all report success but yield a single block, since they compete
for the same height.

## Writing scenarios

A scenario describes a chain — accounts, payments, tokens, aliases, messages,
standing orders — as plain text, one instruction per line. The console has an
editor for them at `/#/scenarios`, with four written ones to load and change.

The language is documented in [`public/scenarios_doc.md`](public/scenarios_doc.md),
which the node also serves at `/scenarios_doc.md` so the reference is there on
a machine with no internet.

## Licence

This repository is MIT licensed. Released deliverables additionally contain the
Signum node, which is GPLv3; its licence ships alongside it as
`LICENSE-signum-node.txt`.
