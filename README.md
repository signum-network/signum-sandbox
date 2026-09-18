# Signum Sandbox

The sandbox to start building cool blockchain apps with Signum — no costs, no risk, no friction.

A local Signum node running an offline mock network, with a UI built for getting started.

<!-- Video: drag brag-output/brag.mp4 into a GitHub comment box, wait for the
     upload, and paste the github.com/user-attachments/assets URL it hands back
     into the src below. Keep it a <video> tag — a bare URL would embed too, but
     only outside this div, and then it would not be centred. -->

<div align="center">
  <video src="https://github.com/user-attachments/assets/4ba00004-da61-411b-bc70-456b7eef1f09" controls muted width="640"></video>
  <p><em>
    A whole blockchain, here,<br />
    mined by a button, for free —<br />
    consensus of one.
  </em></p>
</div>

## For users

```bash
curl -fsSL https://github.com/signum-network/signum-sandbox/releases/latest/download/install.sh | sh
```

Then:

```bash
signum-sandbox
```

and open **http://localhost:6876/**.

It brings its own Java, so there is nothing to install first. macOS and Linux
for now; on Windows, download the release, unpack it and run
`scripts\start.cmd`.

| Command | Does |
|---|---|
| `signum-sandbox` | starts the chain here, until Ctrl-C |
| `signum-sandbox start --daemon` | starts it in the background |
| `signum-sandbox stop` | stops a background node |
| `signum-sandbox status` | version, process, and what the node says |
| `signum-sandbox logs` | follows the node's log |
| `signum-sandbox update` | moves to the newest release |
| `signum-sandbox rollback` | moves back to the previous release |
| `signum-sandbox reset` | deletes the chain and starts from empty |

Everything lives in `~/.signum-sandbox`, and the chain survives updates. A
background node does not survive a logout or a reboot, on purpose: a sandbox
should not keep running unnoticed.

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
| `bun run test:launcher` | the launcher's decisions, in plain `sh` |
| `./scripts/smoke.sh` | starts the node and checks every mount responds |
| `./scripts/package.sh` | assembles the release deliverable |
| `sh scripts/e2e-install.sh <zip>` | installs a built release in a bare Debian container |
| `bun run new-version` | bumps the version and sets a release going |

The node version is pinned in `.signum-node-version`. Nothing the bootstrap
downloads is committed.

### Releasing

`main` is what has been published, and only the pipeline moves it. Work happens on
`develop`, and feature branches go there.

```bash
bun run new-version
```

On a clean `develop` that equals `origin/develop`, this asks for patch, minor or
major, prefills a changeset from the commit subjects since the last tag for you to
edit, lets [changesets](https://github.com/changesets/changesets) do the arithmetic
and write `CHANGELOG.md`, commits and — after one last question — pushes.

`.github/workflows/release.yml` takes it from there. Every push to `develop` is
tested and built. A push whose version carries no tag yet is also packaged,
installed in a `debian:stable-slim` container and made to answer, and only then
published — with `main` fast-forwarded onto it and the tag created by the release
itself. The missing tag is the entire trigger, so a re-run or a second push does
nothing at all.

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
