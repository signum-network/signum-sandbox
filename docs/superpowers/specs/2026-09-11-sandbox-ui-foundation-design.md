# Signum Sandbox — UI Foundation

**Date:** 2026-09-11
**Status:** approved
**Scope:** first UI step — a start page served by the mock node — plus the project foundation and build pipeline the later dashboard rebuild slots into.

## Goal

The sandbox is a deliberate extension of the bare mock node: an alternative UI that gives newcomers an understandable, almost playful entry into blockchain app development. This document covers the foundation and the start page. The dashboard rebuild, chain seeding, and the end-user installer are separate efforts.

## What this repository is

The repository holds **the sandbox UI and the packaging around it — nothing else**. The node itself, the compiled API docs and the node's default configuration are artifacts pulled from the `signum-node` repository; they are never committed here.

Two audiences follow from that:

- **Developers** clone the repository and run a bootstrap script that pulls the node artifacts into the working tree, then develop against a locally running mock node.
- **Non-developers** never see the repository. They download a complete, assembled deliverable from GitHub Releases.

## Verified ground truth

Everything below was checked against the shipped `signum-node.jar` (v3.9.11) on a real mock chain, not inferred from documentation.

| Fact | Consequence |
|---|---|
| The jar contains **no** `html/` resources; all static content is read from the filesystem relative to the working directory. | The deliverable ships its own `html/` tree. |
| `/*` serves the directory named by `API.UI_Dir` (default `html/ui`). | The SPA lives there and is reachable at `/`. |
| `/api-doc/*` serves `html/api-doc` from a **hardcoded** path, gated by `API.DocMode` (`modern` \| `legacy` \| `off`). | API docs need no work beyond placing the fetched directory. |
| `/app/*` does **not** exist in v3.9.11. It is a dev-branch feature gated by `node.webUI.enabled`. | Do not rely on `/app/`. |
| `--headless` is an existing CLI flag; with it no Swing GUI or MetricsPanel starts. | No node patch needed for a headless default. |
| `/*` is a catch-all servlet with no SPA fallback — deep links 404 on hard reload. | Client-side routing must use hash history. |
| The node release zip contains `signum-node.jar`, `conf/node-default.properties`, `conf/logging-default.properties`, `html/api-doc` and the GPL `LICENSE.txt`. | One download covers every fetched artifact. |
| `/events` is served on the dedicated WebSocket port (6877 on the mock network) **and** on the API port, because both connectors share one servlet context. Both deliver byte-identical events. | The UI can follow the page origin instead of hardcoding a second port. |
| The socket needs no subscription message; it emits exactly four events — `CONNECTED`, `BLOCK_PUSHED`, `PENDING_TRANSACTIONS_ADDED`, `HEARTBEAT` — and debounces block events by one second. | Only two of them may trigger a refetch; refetching on `HEARTBEAT` would restore polling at the heartbeat interval. |
| The mock network uses address prefix `TS` and network name `Signum-LOCAL-MOCK`. | The UI must not hardcode the `S` prefix; `getNetworkInfo` reports both, and SignumJS's `Address` honours the prefix. |
| Forging via `submitNonce` credits the forger 10,000 SIGNA per block. | Seeding later is trivial; no faucet infrastructure needed. |
| `submitNonce` must be called **without** `accountId`. Passing it takes the node down its passthrough-mining path, which fails with `failed to create generator` once the secret's account exists on chain. | The forge button and the seeding script omit the parameter. |
| Spaced roughly five seconds apart, each `submitNonce` yields exactly one block. Rapid-fire calls all report success but collapse into a single block, since they register competing generators for the same height. | Seeding forges in a loop with a delay, and the UI must not promise one block per click. |
| `getState` crashed on fresh mock chains (NPE on the missing burn-account row). Fixed in `signum-node` commit `dcb7e5d2` on `feat/new-web-ui`; **not in any release**. | The start page uses `getBlockchainStatus` for now. |
| `signum-node` vendors a pinned Bun into its build directory via its own `downloadBun`/`setupBun` Gradle tasks. | Precedent for vendoring the toolchain instead of installing it system-wide. |

## Decisions

1. **Design system is vendored**, not shared. `theme/`, `audio/`, the `components/ui/` primitives and the i18n setup are copied from `signum-node/web` and evolve independently. Accepted cost: style drift between the two apps.
2. **A single SPA served at `/`, with hash routing.** The start page is the home route; the later dashboard becomes `#/dashboard`. Hash history sidesteps the missing SPA fallback, so reload and bookmarks always work. There is no separate static landing page: the usual reason to split one off is first-paint bundle weight, which is meaningless over loopback, while the cost — duplicated theme tokens, a second i18n mechanism, and an audio context that unlocks per document — is real and recurring.
3. **Full i18next** with the reference's ten locales and browser language detection. Accepted cost: every new string needs ten translations while the UI is still changing.
4. **Layout B — split console.** Node state on the left as a live object, entry points on the right as a list that grows.
5. **UI source in `/src`**, with `package.json` and `vite.config.ts` at the repository root. The root is a JavaScript project, not a node runtime directory.
6. **Node artifacts are fetched, never committed** — jar, `html/api-doc`, and the two `*-default.properties` files. Only `conf/node.properties`, our mock configuration, belongs to us.
7. **The node version is pinned** in `.signum-node-version`. Raising it is a deliberate commit. The bootstrap accepts `--latest` as an explicit opt-in for trying the newest release.
8. **The bootstrap never installs a runtime system-wide.** It uses an existing Bun or Node if one is present, and otherwise fetches a pinned Bun into `.tools/`, following the node repository's own `downloadBun` precedent.
9. **SignumJS is the API layer**, not a hand-written client. It carries the whole chain vocabulary the sandbox will need — signing, address handling, amounts, contracts — instead of us re-deriving it call by call. `ChainService.query<T>()` remains available as an escape hatch for request types without a typed method, `getState` among them.
10. **`getBlockchainStatus` as the data source**, switching to `getState` once the sandbox pins a node release containing the fix.
11. **Headless by default**, GUI opt-in via a start-script flag.

## Architecture

### Repository

Committed content only:

```
signum-sandbox/
  src/
    theme/                    vendored: tokens, themes, ThemeProvider
    audio/                    vendored: synth, sounds, AudioProvider
    components/ui/            vendored: Card, AnimatedNumber, Pill, …
    components/startpage/     new
    i18n/locales/             ten locales
    lib/ledger.ts             SignumJS client, configured once
    routes/                   hash router
  conf/node.properties        mock node configuration
  scripts/
    bootstrap                 pulls node artifacts, vendors Bun
    package                   assembles the release deliverable
    smoke                     starts the node, asserts the mounts
  docs/
  index.html  package.json  vite.config.ts  .signum-node-version
```

After `scripts/bootstrap`, the working tree additionally holds these gitignored artifacts:

```
  signum-node.jar                    from the node release
  conf/node-default.properties       from the node release
  conf/logging-default.properties    from the node release
  html/api-doc/                      from the node release
  html/sandbox/                      Vite build output
  .tools/                            pinned Bun
```

### Runtime, for both the developer and the deliverable

The node runs with this directory as its working directory and `API.UI_Dir = html/sandbox`:

| URL | Serves |
|---|---|
| `/` | start page — the SPA's home route |
| `/#/dashboard` | later dashboard route |
| `/api-doc/` | RapiDoc, from the fetched `html/api-doc` |
| `/api` | node JSON API |
| `/events` | node WebSocket (SIP-50) |

`html/sandbox` is a subdirectory rather than `html/` itself, following the node's own convention of `html/` as a container of independently mounted UIs, and keeping our build output separate from the fetched docs.

### Development loop

`bun run dev` starts Vite on 5173 with `/api` and `/events` proxied to the node on 6876, mirroring the reference's `vite.config.ts`. The node runs separately from the bootstrapped jar. In this mode Vite serves the UI, so `API.UI_Dir` is irrelevant; hash routing still matters because production serves from the node.

### Packaging

`scripts/package` assembles the deliverable: ensure artifacts via bootstrap, build the UI into `html/sandbox`, then stage `build/signum-sandbox-<version>/` containing the jar, all three `conf` files, `html/sandbox`, `html/api-doc`, the node's GPL `LICENSE.txt`, our own licence and README, and the start script. The result is zipped and published to GitHub Releases.

The script **fails loudly if `html/sandbox/index.html` is missing**. A deliverable whose UI build silently did not happen would present a bare 404 with no explanation — this check replaces a static fallback page.

Licensing resolves along the same seam: the repository is MIT for our own code, and the node's GPL `LICENSE.txt` travels with the node artifact inside the deliverable.

## Components

**`lib/ledger.ts`** — creates the SignumJS client against the node host and exports it. The single place that knows the node address, so switching between the Vite proxy in development and the same origin in production touches one file. This step only reads, so it uses `createReadOnlyClient`; signing later swaps in the full client without changing call sites.

SignumJS also supplies what would otherwise be hand-written helpers: `Amount` converts between planck and SIGNA and carries the currency symbol, `ChainTime` converts chain timestamps against the Signum epoch, and `Address` formats account identifiers with the network's own prefix. None of these are reimplemented here.

**`hooks/useNodeStatus.ts`** — exposes node state to components. Subscribes to `/events`; while the socket is connected it does not poll, and it falls back to polling when the socket drops. This mirrors the reference's `useNodeQuery` pattern.

**`components/startpage/`** — `NodeStatePanel` (left column, metric tiles), `EntryList` (right column), `StatusHeader` (network name, version, connection dot). Each takes data as props and holds no fetching logic, which keeps them trivially previewable and pushes every decision worth testing into pure functions.

**`theme/`, `audio/`, `components/ui/`** — vendored, treated as a unit. Local changes stay minimal so that picking up later reference improvements remains cheap.

## Data flow

`network.getNetworkInfo()` is fetched once for network name, address prefix and decimal places. `network.getBlockchainStatus()` supplies the live values. A `BLOCK_PUSHED` or `PENDING_TRANSACTIONS_ADDED` event invalidates the status query; `CONNECTED` and `HEARTBEAT` are ignored, and that filter is a tested pure function rather than a condition buried in an effect.

Tiles in this step:

| Tile | Field |
|---|---|
| Block Height | `numberOfBlocks` |
| Last Block | `lastBlockTimestamp`, rendered as elapsed time |

The header shows `version` from the same response and `networkName` from `getNetworkInfo`. `isScanning` drives a scanning indicator.

Two tiles is deliberately sparse. Cumulative difficulty was carried here at first and then dropped: it is a number for people who already know what it means, and a sandbox aimed at newcomers is the wrong place to spend a tile on it. Everything else worth showing waits on `getState`, so the left panel is expected to be revisited and the layout is explicitly not final.

Transactions, accounts, minted coins, contracts and tokens are **not** shown in this step — `getBlockchainStatus` does not carry them, and `getState` is unusable on the released node. When the sandbox pins a node release containing commit `dcb7e5d2`, `getState` alone fills the whole tile set and these tiles are added without touching component structure.

## Entry points on the start page

| Entry | Target |
|---|---|
| API Docs | `/api-doc/` |
| Mock Node Dashboard | visibly disabled, labelled as coming next |

The previous vanilla mock dashboard is not carried over. One live entry and one placeholder is a thin start page; this is accepted for the first step because the alternative is shipping code the dashboard rebuild would immediately replace.

## Interaction and presentation

Audio is on by default with a toggle in the header, persisted in localStorage, matching the reference. A new block plays `chime`, clicks play `click`, hovering an entry plays `hover`. Animations respect `prefers-reduced-motion`. The Nexus theme is the default; the vendored theme switcher stays available.

## Error handling

- **Node unreachable:** the page renders a dedicated state naming the expected address, not empty tiles.
- **WebSocket down:** the connection dot reflects it and polling takes over. Not an error state — a mock node is restarted often.
- **A single API call fails:** the affected tile shows a placeholder and the rest of the page keeps working. A failing `getNetworkInfo` must not blank the header.
- **Chain reset:** height going backwards is legitimate in a sandbox. Derived values must not assume monotonic growth.
- **Bootstrap failures:** an unreachable release, a checksum mismatch or a missing asset must abort with the failing URL named. Half-populated artifacts are worse than none.

## Testing

- **Vitest** for pure functions: mapping an API response to tile values, the placeholder decision, and the node-unreachable/stale-socket state derivation. Named `*.utils.test.ts` after the reference convention. State decisions therefore live in testable functions rather than inline in JSX. Amount and timestamp formatting are not tested here — they belong to SignumJS.
- **Smoke script** in `scripts/smoke`: start the node headless from the bootstrapped jar, assert that `/`, `/api-doc/` and `/api?requestType=getBlockchainStatus` respond, then shut down. This catches a broken `API.UI_Dir` or a missing build output — the class of failure unit tests cannot see.

Component rendering is **not** tested in this step. The reference project runs Vitest with `environment: 'node'` and has neither jsdom nor a testing library; adding that stack is a deliberate follow-up decision rather than something inherited. Keeping render-state logic in pure functions covers most of the risk without it.

## Out of scope

Dashboard rebuild, seeding script, end-user installer and distribution channels, faucet, contract tooling.

## Open risk

The design reference is `signum-node`'s `feat/new-web-ui` branch, which is unreleased and moving. Vendoring rather than sharing contains the risk: the sandbox cannot be broken by upstream changes, at the price of drifting from them.
