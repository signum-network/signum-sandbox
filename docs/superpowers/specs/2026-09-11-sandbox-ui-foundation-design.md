# Signum Sandbox — UI Foundation

**Date:** 2026-09-11
**Status:** approved
**Scope:** first UI step — a start page served by the mock node, plus the project foundation the later dashboard rebuild slots into.

## Goal

The sandbox is a deliberate extension of the bare mock node: an alternative UI that gives newcomers an understandable, almost playful entry into blockchain app development. This document covers only the foundation and the start page. The dashboard rebuild, chain seeding, and the installer are separate efforts.

## Verified ground truth

Everything below was checked against the shipped `signum-node.jar` (v3.9.11) on a real mock chain, not inferred from documentation.

| Fact | Consequence |
|---|---|
| The jar contains **no** `html/` resources; all static content is read from the filesystem next to the jar. | The sandbox ships its own `html/` tree. |
| `/*` serves the directory named by `API.UI_Dir` (default `html/ui`). Subdirectories below it are served. | The start page lives here, and `/legacy/` works as a subdirectory. |
| `/api-doc/*` serves `html/api-doc` from a **hardcoded** path, gated by `API.DocMode` (`modern` \| `legacy` \| `off`). | API docs need no work beyond placing the directory. |
| `/app/*` does **not** exist in v3.9.11. It is a dev-branch feature gated by `node.webUI.enabled`. | Do not rely on `/app/`. |
| `--headless` is an existing CLI flag; with it no Swing GUI or MetricsPanel starts. | No node patch needed for headless default. |
| `/*` is a catch-all servlet with no SPA fallback — deep links 404 on hard reload. | Client-side routing must use hash history. |
| The mock network uses address prefix `TS` and network name `Signum-LOCAL-MOCK`. | UI must not hardcode the `S` prefix. |
| Forging via `submitNonce` credits the forger 10,000 SIGNA per block. | Seeding later is trivial; no faucet infrastructure needed. |
| Several `submitNonce` calls in quick succession yield only one block. | The later seeding script needs a measured delay between blocks. |
| `getState` crashed on fresh mock chains (NPE on the missing burn-account row). Fixed in `signum-node` commit `dcb7e5d2` on `feat/new-web-ui`; **not in any release**. | The start page uses `getBlockchainStatus` for now. |

## Decisions

1. **Design system is vendored**, not shared. `theme/`, `audio/`, the `components/ui/` primitives and the i18n setup are copied from `signum-node/web` into the sandbox and evolve independently. Accepted cost: style drift between the two apps.
2. **One SPA at `/` with hash routing.** The start page is the home route; the later dashboard becomes `#/dashboard`. Hash history sidesteps the missing SPA fallback entirely — reload and bookmarks always work.
3. **Full i18next** with the reference's ten locales and browser language detection. Accepted cost: every new string needs ten translations while the UI is still changing.
4. **Layout B — split console.** Node state on the left as a live object, entry points on the right as a list that grows.
5. **Built in CI.** Build output is gitignored; release artifacts carry the built `html/`. A bare `git clone` requires `npm install && npm run build`.
6. **`getBlockchainStatus` as the data source**, switching to `getState` once the sandbox pins a node release containing the fix.
7. **Headless by default**, GUI opt-in via a start-script flag.
8. **UI source lives in `web/`**, not `/src`. This deviates from the repo's CLAUDE.md rule. Reason: the repository root *is* the node's runtime directory — `conf/`, `html/` and `db/` are paths the node resolves relative to its working directory — and laying an npm project over that root mixes two unrelated concerns. Reversible: moving the Vite project to `/src` changes only `vite.config.ts` paths and the CI build step.

## Architecture

### Repository

```
signum-sandbox/
  web/                        Vite + React 19, the sandbox UI
    src/
      theme/                  vendored: tokens, themes, ThemeProvider
      audio/                  vendored: synth, sounds, AudioProvider
      components/ui/          vendored: Card, AnimatedNumber, Pill, …
      components/startpage/   new
      i18n/locales/           ten locales
      lib/nodeApi.ts          typed node API client
      routes/                 hash router
    public/legacy/            the existing vanilla mock dashboard
    package.json vite.config.ts
  html/
    api-doc/                  committed; node serves it from this fixed path
    sandbox/                  gitignored; Vite build output
  conf/                       node-default / node / logging properties
  scripts/                    start script, smoke test
  docs/
  signum-node.jar             gitignored
```

### Runtime

The node runs with the repository root as its working directory and `API.UI_Dir = html/sandbox`:

| URL | Serves |
|---|---|
| `/` | start page (SPA entry) |
| `/#/dashboard` | later dashboard route |
| `/legacy/` | existing vanilla dashboard, via `web/public/legacy` |
| `/api-doc/` | RapiDoc, from committed `html/api-doc` |
| `/api` | node JSON API |
| `/events` | node WebSocket (SIP-50) |

Placing the legacy dashboard in `web/public/legacy` rather than directly in `html/sandbox/legacy` keeps it committed while the build output stays gitignored; Vite copies `public/` into the build.

## Components

**`lib/nodeApi.ts`** — typed wrappers over `/api` returning parsed responses. Owns the request-type strings and response types. Knows nothing about React.

**`hooks/useNodeStatus.ts`** — exposes node state to components. Subscribes to `/events`; while the socket is connected it does not poll, and it falls back to polling when the socket drops. This mirrors the reference's `useNodeQuery` pattern.

**`components/startpage/`** — `NodeStatePanel` (left column, metric tiles), `EntryList` (right column, links), `StatusHeader` (network name, version, connection dot). Each takes data as props and holds no fetching logic, which keeps them trivially previewable and pushes every decision worth testing into the pure functions below.

**`theme/`, `audio/`, `components/ui/`** — vendored, treated as a unit. Local changes stay minimal so that picking up later reference improvements remains cheap.

## Data flow

`getConstants` is fetched once for network name and address prefix. `getBlockchainStatus` supplies the live values. A `block` event on the WebSocket invalidates the status query.

Tiles in this step:

| Tile | Field |
|---|---|
| Block Height | `numberOfBlocks` |
| Last Block | `lastBlockTimestamp`, rendered as elapsed time |
| Cumulative Difficulty | `cumulativeDifficulty` |

The header shows `version` from the same response and `networkName` from `getConstants`. `isScanning` drives a scanning indicator.

Three tiles is deliberately sparse. Cumulative difficulty in particular is a developer-facing number rather than a newcomer-friendly one; it earns its place only until richer metrics unblock. The left panel is expected to be revisited once `getState` is available, and the layout is explicitly not final.

Transactions, accounts, minted coins, contracts and tokens are **not** shown in this step — `getBlockchainStatus` does not carry them, and `getState` is unusable on the released node. When the sandbox pins a node release with commit `dcb7e5d2`, `getState` alone fills the whole tile set and these tiles are added without touching component structure.

## Interaction and presentation

Audio is on by default with a toggle in the header, persisted in localStorage, matching the reference. New block plays `chime`, clicks play `click`, hovering an entry plays `hover`. Animations respect `prefers-reduced-motion`. The Nexus theme is the default; the vendored theme switcher stays available.

## Error handling

- **Node unreachable:** the page renders a dedicated state naming the expected address, not empty tiles.
- **WebSocket down:** the connection dot reflects it and polling takes over. Not an error state — a mock node is frequently restarted.
- **Single API call fails:** the affected tile shows a placeholder; the rest of the page keeps working. A failing `getConstants` must not blank the header.
- **Chain reset:** height going backwards is legitimate in a sandbox. Derived values must not assume monotonic growth.

## Testing

- **Vitest** for pure functions: elapsed-time and large-number formatting, mapping an API response to tile values, the placeholder decision, and the node-unreachable/stale-socket state derivation. Named `*.utils.test.ts` after the reference convention. State decisions therefore live in testable functions, not inline in JSX.
- **Smoke script** in `scripts/`: start the node headless, assert that `/`, `/legacy/`, `/api-doc/` and `/api?requestType=getBlockchainStatus` respond, then shut down. This is what catches a broken `API.UI_Dir` or a missing build output — the class of failure unit tests cannot see.

Component rendering is **not** tested in this step. The reference project runs Vitest with `environment: 'node'` and has neither jsdom nor a testing library; adding that stack is a deliberate follow-up decision rather than something inherited. Keeping render-state logic in pure functions means most of the risk is covered without it.

## Out of scope

Dashboard rebuild, seeding script, installer and distribution channels, faucet, contract tooling. The start page carries a single visibly disabled entry as a placeholder for seeding, and nothing else anticipating future features.

## Open risk

The design reference is `signum-node`'s `feat/new-web-ui` branch, which is unreleased and moving. Vendoring rather than sharing contains the risk: the sandbox cannot be broken by upstream changes, at the price of drifting from them.
