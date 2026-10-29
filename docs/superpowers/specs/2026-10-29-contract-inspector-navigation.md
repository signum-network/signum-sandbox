# Contract Inspector — Navigation

**Date:** 2026-10-29
**Status:** Agreed with the reviewer. Extends `2026-10-28-contract-inspector-layout.md`.

**Scope:** three changes from the review of the redesigned page.

1. The header is too tall: at 900px window height the memory list gets about 180px.
2. The search marks hits, but there is no way to step from one to the next.
3. The slot list can only be used with the mouse.

## Decisions

### 1. The header in two columns

From `md` up, the header's rows sit in two columns under the identity line:

- **Left, what the contract is:** description, creator, created, version, code hash, raw `getAT`.
- **Right, how it stands:** balance, holdings, activation, status (with its hints), next block.

Below `md` it stays one column, in that order. Nothing is hidden; the rows only move.

### 2. Stepping through hits

Next to the search field, while a query is set: a counter `position / total` and two buttons, ▲ previous and ▼ next. Enter in the field steps to the next hit and Shift+Enter to the previous one.

- **What is stepped through:** the slots of all three memory tabs, in memory order (data, then call stack, then user stack). A step to a hit in another tab opens that tab. Map entries keep their marks and the Maps tab its count, but they are not stepped through: they are only the entries of one lookup, not a part of the contract's memory.
- **Where a step starts:** at the selected slot of the open memory tab. "Next" is the first hit after it, "previous" the last hit before it, and both wrap around. From the Maps or Activity tab, "next" starts at the first hit and "previous" at the last.
- **The position:** the selected slot's place among the hits. When the selected slot is not a hit, the counter shows `– / total`.
- **A new query** still selects the first hit of each memory tab, as before. It does not change the open tab.

Because the start is the selection and not a remembered hit, stepping keeps working when a block changes which slots match.

### 3. Keys in the slot list

The slot list takes the keyboard focus (a click on a row gives it). Then:

| Key | Moves to |
|---|---|
| ↓ / ↑ | the next / previous slot; at a page edge, onto the next / previous page |
| → / ← and PageDown / PageUp | the same row of the next / previous page, or the last / first slot when there is no full page left |
| Home / End | the first / last slot of the tab |

Moves stop at the ends; they do not wrap. The list scrolls the selected row into view.

**The page follows the selection.** The page shown is always the one holding the selected slot. A click on a page number selects that page's first slot. So the detail panel always shows a slot on the visible page.

## Pure functions

In `src/lib/contractData.ts`:

```ts
/** The hit to step to from a slot, or null when there are none. `hits` ascend. */
stepHit(hits: number[], from: number | null, direction: 1 | -1): number | null

/** Where a key moves the selection among `count` slots, or null for a key it ignores. */
moveSlot(count: number, position: number, key: string): number | null
```

## Testing

- `stepHit`: no hits; next and previous from a hit, from a slot between hits, and from null; wrap-around both ways; a single hit steps to itself.
- `moveSlot`: each key in the table; the stops at both ends; a page move on the last, partial page; an unknown key is null.
- In the browser: the header in two columns at md+ and one column on a narrow screen; the counter and steps across tabs; Enter and Shift+Enter; the keys in the list, with page changes.
