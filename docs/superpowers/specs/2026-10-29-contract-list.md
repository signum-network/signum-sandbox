# Contract List

**Date:** 2026-10-29
**Status:** Agreed with the reviewer. Placement was the reviewer's choice; scope and columns follow the recommendation the reviewer was given.

**Scope:** a console tab that lists every contract on the chain and leads to the inspector.

## Decisions

1. **A console tab "Contracts", right after Accounts.** It is a list on the main screen like Transactions, Blocks and Accounts. The inspector stays a page of its own, reached from each row.

2. **All contracts on the chain,** not only those deployed by sandbox accounts. On a sandbox chain they are few, and a contract someone else deployed is just as worth inspecting.

3. **One request for the list.** The node's `getATs` (not wrapped by SignumJS, so through `ledger.service.query`) answers with every contract and its flags. It is paged by `firstIndex`/`lastIndex` and says `nextIndex` while more exist; the list follows `nextIndex` until the end. `includeDetails=false`, since the list needs no creation bytes. Query key `['contracts']`, in `STALE_ON_BLOCK`: a block can deploy a contract or change one's status.

4. **The balance comes from the account,** one `['account', id]` query per row on screen, the key the watch view and the inspector already share. `getATs` gives the balance after the last run, which would hide a payment until the contract runs again. That is the same reasoning as in the inspector header.

5. **Columns:**
   - name, with identicon
   - address
   - creator (display name, as everywhere in the console)
   - created in block
   - status (word and colour as in the inspector header)
   - balance
   - an Inspect link

   Newest first, by creation block.

6. **The console's search filters the list.** The same `Query` the other tabs use:
   - **name:** the contract's or the creator's display name contains it
   - **address:** the contract's or the creator's address is it
   - **id:** the contract's id, the creator's id or the code hash is it
   - **height:** created in that block

7. **Paged like the other lists,** with `paginate` and `Pager`.

## Pure functions

In `src/lib/contractList.ts`:

```ts
/** Every contract, following nextIndex until the node has no more. */
fetchAllContracts(fetchPage: (firstIndex: number) => Promise<{ ats: Contract[]; nextIndex?: number }>): Promise<Contract[]>

/** Newest first, by creation block; ties by id, so the order is stable. */
sortContracts(contracts: Contract[]): Contract[]

matchesContract(contract: Contract, query: Query, creatorName: string): boolean
```

## Testing

- `fetchAllContracts`: one page; several pages through `nextIndex`; an empty chain.
- `sortContracts`: newest first; a tie broken by id.
- `matchesContract`: each query kind matching the contract and the creator; no query matches all.
- `STALE_ON_BLOCK` holds `contracts` (the existing classification test covers it).
- In the browser: the tab next to Accounts, Construct and a deployed InspectorTest listed with status and balance, search by name, creator and height, Inspect opens the page, a new deployment appears after its block, German, beginner note.
