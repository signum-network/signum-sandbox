# Addressable Console — Plan

**Spec:** `docs/superpowers/specs/2026-10-29-addressable-console.md`.

**Constraints:** one commit per task, and only when tests and typecheck both exit 0.

### Task A1: `parseConsoleSearch`

Write the tests first, then implement in `src/lib/consoleNav.ts`.

Commit: `feat: the console reads which account to watch from its address`

### Task A2: Route and shell

`src/routes/console.tsx` gets `validateSearch`. `ConsoleShell` applies `watch` and opens the tab, then replaces the URL.

Commit: `feat: /console?watch=<address> opens the console watching that account`

### Task A3: `WatchLink` in the inspector

Create `src/components/contracts/WatchLink.tsx` and use it in `SlotDetail`, `ContractMaps` and `ContractHeader`. Add `inspector.watch` in all ten languages.

Commit: `feat: every account the inspector knows links to watching it in the console`

### Task A4: Check in the browser, then push to PR #8
