# Contract Inspector — Layout Redesign

**Date:** 2026-10-28
**Status:** Draft. Revises the presentation parts of `2026-10-27-contract-inspector-design.md`. The data layer (slots, status, layout, labels, live refresh, entry points) stays as it is.

**Scope:** how the contract page lays out memory, maps and activity. The reviewer found the first version too wide and too long. It had eight value columns, every section stacked under the next, and 320 rows in one table.

## Decisions

1. **Header on top, tabs below.** The header (identity, balance, status, activation, …) stays always visible. Under it is one tab bar: **Data · Call stack · User stack · Maps · Activity**. A stack tab appears only when the contract has that stack (`stackLayout` says more than 0 slots). The tab bar is the console's (`ConsoleButton` with the travelling marker), and the search field sits on its right like the console's.

2. **Fixed height, scrolling inside.** The page becomes a full-height flex column like `ConsoleShell` (`h-screen`, `min-h-0`). The tab panel takes the remaining height (`flex-1`, at least 320px), and lists scroll inside it with `themed-scroll console-scroll`. The page itself does not grow with the data.

3. **Memory as a hex dump with a detail panel.** Each memory tab (Data, Call stack, User stack) is split in two:
   - **Left: the slot list.** One compact row per slot: index, label, value. It is monospaced, with no other columns.
   - **Right: the detail panel** for the selected slot (initially the first one). It shows every reading:
     - unsigned
     - signed
     - string
     - bool
     - address
     - hex (big-endian)
     - stored (little-endian)

     It also holds the label input and the type choice.
   - **Narrow screens:** below `md` the panel moves under the list.

4. **No guessing of a slot's meaning.** A slot is a `long` and only the code knows what it means. Small numbers can be counters, flags or states; large ones can be ids, hash parts or random values; printable bytes can be accidental. So:
   - **The type is set by hand.** The person sets a slot's **type** (`unsigned | signed | string | bool | address`) in the detail panel. It is stored next to the label, per code hash, so it holds for every instance of the same code.
   - **The list shows a value only in its set type.** Without a type the list shows hex. Nothing is inferred.
   - **A known account id is only a hint.** When the slot's value is an id the page knows (`knownIds`), the list shows a small ◆ before the value and the panel suggests "address". It does not set the type.

5. **Pages are the AT's own 256-byte pages.** A memory tab shows one page of 32 slots at a time. The page picker is a row of page numbers above the list. A page that holds a changed slot or a search hit is marked:
   - amber dot: changed
   - blue count: hits

   The Data tab of Construct has pages 0–7. A stack tab of 32 slots has one page and shows no picker.

6. **Search across memory and loaded maps.** One query matches a slot when any of these contain it, ignoring case and ignoring a leading `0x` for hex:
   - its decimal (unsigned or signed)
   - its hex or stored hex
   - its string reading
   - its address, or the name of a known account it holds
   - its label

   Maps can only be searched where the node has answered, so the search covers the entries currently loaded in the Maps tab, by key2 and value with the same rules. Results:
   - matching rows are highlighted
   - each tab shows its hit count
   - each page shows its hit count, as in decision 5

   An empty query marks nothing. Matching is a pure function, so map entries are turned into the same `DataSlot` shape (`slotOfValue(decimal)`) and go through the same code.

7. **Changed markers move with the layout.**
   - **Row:** a changed slot keeps its amber Δ (title "changed in block N") and its flash.
   - **Page and tab:** both get an amber dot.

   The rules for when a marker is set or kept are unchanged.

8. **Maps and Activity are tabs.** The map form and its result table move into the Maps tab unchanged, apart from search highlighting. The incoming and outgoing lists move into the Activity tab.

## Data layer changes

```ts
// src/lib/contractData.ts
export type SlotType = 'unsigned' | 'signed' | 'string' | 'bool' | 'address'

export interface SlotReadings {
  unsigned: string
  signed: string          // always, even when equal to unsigned
  string: string | null   // printable UTF-8 of any length; null otherwise
  bool: boolean           // value != 0
  address: string | null  // null for 0
  hex: string
  stored: string
}
export function slotReadings(slot: DataSlot, addressPrefix: string): SlotReadings
/** The list's value: the reading of the set type, or hex when none is set. */
export function slotValue(slot: DataSlot, type: SlotType | undefined, addressPrefix: string): string
/** A map value (decimal, possibly negative) as a slot, so search and readings are shared. */
export function slotOfValue(decimal: string): DataSlot
export function slotMatches(
  slot: DataSlot,
  query: string,
  context: { addressPrefix: string; known: Map<string, KnownId>; label?: string },
): boolean
/** Slots split into the AT's 32-slot pages, indices kept. */
export function toPages(slots: DataSlot[]): DataSlot[][]
```

- **`DataSlot.text`** keeps its rule of at least two characters, because it is what search treats as "the slot's text". The `string` reading in the panel shows any printable content, a single character included, because there someone is asking for it on purpose.
- **Labels become slot metadata:** `Record<codeHash, Record<index, { label?: string; type?: SlotType }>>`, under the same storage key. `parseContractLabels` still accepts the stored v1 shape, where the value is a plain label string, so labels set so far survive. `setSlotLabel` becomes `setSlotMeta(labels, codeHash, index, patch)`. A slot with neither a label nor a type is removed.

## Removed

`DataStackTable` and its eight-column layout, the inline label input, the "show stacks" toggle, and the column, toggle and size keys that only the table used.

## Testing

- **`contractData.test.ts`:**
  - **`slotReadings`:** `"hi"`, a single `"U"`, −1, 0 as bool and address, and a known id.
  - **`slotValue`:** every type, plus hex when no type is set.
  - **`slotOfValue`:** a negative value round-trips.
  - **`slotMatches`:** decimal, signed, hex with and without `0x`, string, address, known name, label, and an empty query that matches nothing.
  - **`toPages`:** 320 → 10 pages, indices kept, and a partial last page.
- **`contractLabels.test.ts`:** a v1 string still parses as a label, type and label are set independently, and a slot is removed when both are empty.
- **Manual check against the node,** as in Task 9:
  - tab switching
  - hit counts on tabs and pages
  - changed dots
  - a type set on one InspectorTest instance, seen on a second deployment of the same code
  - the narrow layout
