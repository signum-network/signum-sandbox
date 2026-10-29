# Contract Inspector Navigation — Plan

**Goal:** a header half as tall, a search that steps from hit to hit, and a slot list that works with the keys.

**Spec:** `docs/superpowers/specs/2026-10-29-contract-inspector-navigation.md`.

**Constraints:** as in `2026-10-28-contract-inspector-layout.md`. One commit per task, and only when tests and typecheck both exit 0.

### Task N1: `stepHit` and `moveSlot`

**Files:** `src/lib/contractData.ts` and its test.

Write the tests listed in the spec first, watch them fail, then implement.

Commit: `feat: a hit can be stepped to from any slot, and a key moves the selection`

### Task N2: The page follows the selection

**Files:** `MemoryView.tsx` and `ContractPage.tsx`.

- **Selection moves up:** the selection of each memory tab moves into `ContractBody`. `MemoryView` takes `selected`, `onSelect` and a `jump` counter. It loses its page state: the page is derived from the selected slot, and a page number selects that page's first slot.
- **New query:** the jump to the first hit moves into `ContractBody`'s query handler.
- **Keys:** the list gets `tabIndex={0}` and an `onKeyDown` handler through `moveSlot`. The handler keeps the focus on the list, so it survives a page change. The selected row scrolls into view on every selection change and every jump.

Commit: `feat: the slot list moves with the arrow keys, page by page`

### Task N3: Counter and steps

**Files:**
- `ContractTabs.tsx`, `SearchField.tsx` (optional `onEnter`) and `ContractPage.tsx`.
- Locale keys `inspector.hit.{previous,next}` in all ten languages.

Commit: `feat: the search counts its hits and steps to the next or previous one`

### Task N4: The header in two columns

**Files:** `ContractHeader.tsx`.

Commit: `feat: the contract header sits in two columns, leaving the memory more room`

### Task N5: Check in the browser

Check every point under Testing in the spec, against Construct and an InspectorTest instance.
