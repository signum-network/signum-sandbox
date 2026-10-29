# Contract List — Plan

**Goal:** a Contracts tab in the console listing every contract on the chain, each leading to the inspector.

**Spec:** `docs/superpowers/specs/2026-10-29-contract-list.md`.

**Constraints:** one commit per task, and only when tests and typecheck both exit 0.

### Task C1: `fetchAllContracts`, `sortContracts`, `matchesContract`

**Files:** create `src/lib/contractList.ts` and its test.

Write the tests listed in the spec first, watch them fail, then implement.

Commit: `feat: every contract on the chain can be fetched, ordered and searched`

### Task C2: The tab

**Files:**
- `src/lib/consoleNav.ts` (`'contracts'`) and `src/lib/queryKeys.ts` (`contracts`)
- `src/hooks/useContracts.ts`
- `src/components/console/views/ContractsView.tsx` and `src/components/console/ConsoleShell.tsx`
- `ContractHeader.tsx`: export `STATUS_COLOR`, so list and header share it
- Locale keys in all ten languages:
  - `console.tab.contracts`
  - `console.viewNote.contracts`
  - `console.contracts.{name,address,creator,created,status,balance,empty}`

Commit: `feat: the console lists every contract on the chain, each a link to its inspector`

### Task C3: Check in the browser

Check every point under Testing in the spec. Deploy an InspectorTest instance to see a new contract appear, then rewind the chain to 1079 again.
