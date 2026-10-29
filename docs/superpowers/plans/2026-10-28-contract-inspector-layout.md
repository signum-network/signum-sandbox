# Contract Inspector Layout — Implementation Plan

**Goal:** The contract page is a full-height page: the header on top, and under it tabs for Data, Call stack, User stack, Maps and Activity, with a search field. Memory is a paged hex list with a detail panel that shows every reading of the selected slot. A slot's type is set by hand. Search marks hits in tabs, pages and rows.

**Spec:** `docs/superpowers/specs/2026-10-28-contract-inspector-layout.md`. Read it first.

**Global constraints** are those of `2026-10-27-contract-inspector.md`, with two additions:
- **Keep what is already verified.** The data layer (`toDataSlots`, `changedSlots`, `contractStatus`, `wakeThreshold`, `stackLayout`, `knownIds`, the queries and their keys) does not change behaviour.
- **One commit per task.** Run tests and typecheck first, and commit only when both exit 0.

## Review Focus

1. **Labels set before this change survive.** The stored v1 strings must parse as labels (Task L2).
2. **The list never infers.** Without a set type the value is hex. A known id is only a ◆ hint (Tasks L1 and L4).
3. **An empty query marks nothing.** No tab, page or row shows a count (Task L1).
4. **The page does not grow with the data.** Lists scroll inside the fixed tab panel (Task L3).

---

### Task L1: Readings, pages and search, as pure functions

**Files:** Modify `src/lib/contractData.ts` and `src/lib/contractData.test.ts`.

Add `SlotType`, `SlotReadings`, `slotReadings`, `slotValue`, `slotOfValue`, `slotMatches` and `toPages` as typed in the spec.

- **`textOf`:** gains a minimum length. `DataSlot.text` keeps 2. The `string` reading uses 1.
- **`slotMatches`:**
  - Lower-case the query and trim it. An empty query is `false`.
  - Strip a leading `0x` for the hex comparisons.
  - Compare with `includes` against: `decimal`, `signed ?? decimal`, `hex`, `raw`, `text`, the address from `toAddress(decimal, prefix)` when the value is not 0, `known.get(decimal)?.name`, and `label`.
- **`slotOfValue`:** parses with `BigInt`. A negative value goes to two's complement (`+ 2^64`) and is written little-endian into a 16-hex `raw`, then goes through `toDataSlots`. The index is 0.
- **`toPages`:** splits into chunks of 32 and keeps each slot's own `index`.

Tests are listed in the spec under Testing. Write them first, watch them fail, then implement.

Commit: `feat: a slot can be read every way, found by any of them, and paged like the AT pages it`

### Task L2: A slot's label and type, stored together

**Files:** Modify `src/lib/contractLabels.ts` with its test, `src/hooks/useContractLabels.ts`, and the callers.

- **Types:** `SlotMeta = { label?: string; type?: SlotType }` and `ContractLabels = Record<string, Record<number, SlotMeta>>`.
- **Parsing:** `parseContractLabels` accepts a string value (v1) as `{ label }`, and an object with a string `label` and/or a known `type`. Anything else is dropped. The storage key does not change.
- **Updating:** `setSlotMeta(labels, codeHash, index, patch)` merges the patch. An empty label is removed, and `type: undefined` is removed. A slot left empty goes, and so does a code hash left empty.
- **Hook:** `useContractLabels` returns `{ meta, setMeta }`. `meta` is the record for this code hash.

Tests: a v1 string becomes a label, setting the type keeps the label (and the other way round), clearing both removes the slot, and an unknown type is dropped.

Commit: `feat: a slot's label and type are kept together, and labels set so far survive`

### Task L3: The page as header and tabs

**Files:**
- Modify `src/components/contracts/ContractPage.tsx`.
- Create `src/components/contracts/ContractTabs.tsx`.
- Touch `ContractMaps.tsx` only as far as it moves.
- Add the locale keys in all ten languages.

- **Page shell:** `ContractPage` becomes `mx-auto flex h-screen flex-col p-6`, like `ConsoleShell`. `ContractBody` is a flex column with the header (`shrink-0`) and the tab panel (`flex min-h-[320px] flex-1 flex-col border p-3`, `min-h-0`).
- **`ContractTabs`:** the tab bar copies the console's markup: `ConsoleButton`, the `motion.span` marker with its own `layoutId` (`contract-tab-marker`), and `SearchField` on the right with an inspector placeholder. Each tab can carry a hit count (blue) and a changed dot (amber). Those props are wired in Tasks L4 and L5.
- **Tabs:** `data`, `callStack`, `userStack`, `maps`, `activity`. A stack tab is shown only when its section has slots.
- **Content in this task:**
  - Maps renders `ContractMaps` in a `themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto` container.
  - Activity renders the two `Direction` lists in the same kind of container.
  - The memory tabs keep the old table for now.
- **Beginner notes:** each `ViewNote` moves to the top of its tab.
- **New keys:**
  - `inspector.tab.{data,callStack,userStack,maps,activity}`
  - `inspector.search`: "Value, address, text or label"
  - `inspector.page`: "Page"

Verify in the browser: the header stays put and the tab panel scrolls inside itself.

Commit: `feat: the contract page keeps its header and puts memory, maps and activity under tabs`

### Task L4: Memory as a paged hex list with a detail panel

**Files:**
- Create `src/components/contracts/MemoryView.tsx` and `src/components/contracts/SlotDetail.tsx`.
- Delete `DataStackTable.tsx`.
- Modify `ContractPage.tsx`.
- Locales: add the new keys and drop the obsolete ones.

- **`MemoryView`** takes `slots` (one section), `meta`, `onMeta`, `known`, `addressPrefix`, `changed`, `matches: Set<number>` and `codeHash`.
  - It holds `page` and `selected` in state. Selecting a hit on another page switches to that page.
  - **Page picker:** page numbers as `RowButton`s, the current one in `--blue3` and underlined. A page with a changed slot gets an amber dot, and a page with hits gets a blue count. The picker is hidden for a single page.
  - **List:** the page's slots in `themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto`. Each row is a `RowButton` showing the index, the label (or nothing), ◆ when `known.has(decimal)`, and `slotValue(slot, meta[i]?.type, prefix)`.
    - Row states: selected (the tab marker's blue background), hit (blue left edge), changed (Δ with title and an amber edge).
    - Every row flashes with `useValueFlash(slot.raw)`.
- **`SlotDetail`** shows a heading `#index · label`, then one line per reading of `slotReadings`. The address line shows the identicon and the known name, plus `InspectLink` for a contract.
  - **Label:** an input that saves on blur or Enter, keyed by `codeHash-index`.
  - **Type choice:** a row of `ConsoleButton`s, `active` on the set type, plus "none". Clicking the active one clears it. When the slot holds a known id and no type is set, a muted hint suggests "address".
- **Layout:** `flex min-h-0 flex-1 gap-3`, the list at `flex-1` and the panel at `w-[300px] shrink-0`. Below `md` they stack: `flex-col`, and the panel at `w-full`.
- **Sections:** `ContractBody` derives them from `inspector.slots` and `inspector.layout` (data, call stack, user stack) and gives each memory tab its `MemoryView`. Tabs whose section holds a changed slot get the amber dot.
- **New keys:**
  - `inspector.reading.{unsigned,signed,string,bool,address,hex,stored}`
  - `inspector.type.{label,none}` ("Show as", "Hex")
  - `inspector.type.suggestAddress`
  - `inspector.detail.empty`
- **Removed keys:** the obsolete `inspector.data.*` ones, namely the column keys, `showStack`, `hideStack` and `sizeWithStack`. `data.size` stays as the page footer: "{{bytes}} bytes · {{slots}} slots".

Commit: `feat: a contract's memory reads as pages of slots, each opened beside the list`

### Task L5: Search marks tabs, pages and rows

**Files:** Modify `ContractPage.tsx`, `ContractTabs.tsx`, `MemoryView.tsx` and `ContractMaps.tsx`.

- **State:** `query` lives in `ContractBody`.
- **Memory hits:** for each section, `matches = new Set(slots.filter(s => slotMatches(s, query, { addressPrefix, known, label: meta[s.index]?.label })).map(s => s.index))`, memoised.
- **Map hits:** `ContractMaps` gets `query` and reports its hit count upwards through `onHits(count)`. It highlights matching rows (by key2 or value, through `slotOfValue`) with the same blue left edge.
- **Tabs:** they show the counts. An empty query shows none.
- **Jumping to hits:** when the query changes and the current tab has no hits but another tab has some, nothing jumps; the counts point the way. Inside a memory tab, the first hit is selected and its page opened when the query changes.

Commit: `feat: one search finds a value in every part of a contract and marks where it is`

### Task L6: Verify against the node

1. Deploy two instances of InspectorTest with the test account (`scratchpad/inspector-test/deploy.ts`) and call them.
2. Check:
   - **Tabs:** Construct shows Data, Call stack, User stack, Maps and Activity. InspectorTest shows Data, Maps and Activity.
   - **Pages:** Construct's Data tab has pages 0–7. Selecting slot 6 of InspectorTest shows its address reading with ◆ and the suggestion.
   - **Types:** set "address" on slot 6 and "string" on slot 4 of the first instance, then open the second instance: both are set there too.
   - **Search:**
     - "hi" marks slot 4
     - the test account's address marks slot 6 and the map entry, with the map loaded under key1 = 1
     - "TS-RANK" on Construct marks slot 65 on page 2
     - clearing the query removes every mark
   - **Changes:** a call marks Δ on the row, a dot on the page and a dot on the tab.
   - **Layout:** the page does not scroll as a whole on a 900px-high window, and the list scrolls inside. At 600px width the panel sits under the list.
   - **Language and beginner mode:** German, and beginner mode on.
3. Run `bun run test && bunx tsc -p tsconfig.json && bun run build`.
4. Rewind only the blocks this task added.
