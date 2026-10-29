# Addressable Console

**Date:** 2026-10-29
**Status:** Agreed with the reviewer. It goes on the inspector branch (PR #8).

**Scope:** other pages can link to "watch this account" in the console. The inspector uses that to link every known account, not only contracts.

## Decisions

1. **`/console?watch=<address>`.** The console route accepts a `watch` search parameter. When it holds a valid account, the console watches that account (the same `watch()` the Watch button calls, so it is stored as before) and opens the Watch tab.

2. **Links carry the address, not the numeric id.** TanStack Router reads search values as JSON. A hand-typed `?watch=8099521788498608209` would become a JavaScript number and lose its last digits. A number is therefore ignored. A string is folded through `toAccountId`, so a quoted numeric id still works. Anything that does not parse is ignored as well, and the console opens as usual.

3. **The parameter is consumed.** Once applied, the URL is replaced by plain `/console`. Otherwise a reload after "stop watching" would watch the account again. `useWatched` reads its stored id in an effect, so the URL is applied after that read and wins.

4. **`WatchLink`,** built like `InspectLink`. The inspector shows it wherever a known account that is not a contract appears:
   - a slot's address reading
   - a map key or value
   - the creator in the header

## Pure function

In `src/lib/consoleNav.ts`:

```ts
/** The console's search parameters, keeping only what parses. */
parseConsoleSearch(search: Record<string, unknown>): { watch?: string }
```

## Testing

- `parseConsoleSearch`:
  - an address and a quoted numeric id give the numeric id
  - a number, an invalid string and a missing value give `{}`
- In the browser:
  - a watch link from the inspector opens the console watching that account, and the URL is plain `/console` afterwards
  - "stop watching" plus a reload stays unwatched
  - an invalid `?watch=` opens the console normally
