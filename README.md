# Signum Sandbox

The sandbox to start building cool blockchain apps with Signum — no costs, no risk, no friction.

A local Signum node running an offline mock network, with a UI built for getting started.

## For users

Download the latest release, unpack it, and run:

```bash
./scripts/start.sh
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
`/events` proxied to the node, so changes reload without rebuilding.

| Command | Does |
|---|---|
| `./scripts/bootstrap.sh` | fetches node artifacts; `--latest` resolves the newest release |
| `./scripts/start.sh` | starts the node headless; `--gui` for the node's own window |
| `bun run test` | unit tests |
| `./scripts/smoke.sh` | starts the node and checks every mount responds |
| `./scripts/package.sh` | assembles the release deliverable |

The node version is pinned in `.signum-node-version`. Nothing the bootstrap
downloads is committed.

## What is served

| URL | |
|---|---|
| `/` | the sandbox UI |
| `/api-doc/` | the node's API documentation |
| `/api` | the node's JSON API |
| `/events` | the node's WebSocket event stream |

## Forging blocks

The mock network accepts any nonce, so a block is one request away:

```bash
curl -X POST "http://localhost:6876/api?requestType=submitNonce&secretPhrase=whatever&nonce=0"
```

Leave out `accountId` — passing it routes the call into passthrough mining,
which fails once the passphrase's account exists on chain. The forger receives
10,000 SIGNA per block. Calls fired in rapid succession all report success but
yield a single block, since they compete for the same height.

## Licence

This repository is MIT licensed. Released deliverables additionally contain the
Signum node, which is GPLv3; its licence ships alongside it as
`LICENSE-signum-node.txt`.
