# Signum Sandbox — Contract Inspector

**Date:** 2026-10-27
**Status:** draft, awaiting review
**Scope:** a built-in page that shows one smart contract on the sandbox chain: its attributes, its runtime state, its data stack and its maps, updated live as blocks arrive. Modelled on [signum-contract-inspector](https://github.com/ohager/signum-contract-inspector). The code stack, a list of all contracts, and deploying contracts are out of scope.

## Goal

The sandbox can already send to a contract with arguments. What it cannot do is show what that send *did*. A contract's state lives in its data stack (8-byte slots) and its maps. A person who just called a method wants to see which slot changed, what the balance is now, and whether the contract is still running. The standalone inspector answers this for mainnet and testnet. This page answers it inside the sandbox, live, and in the sandbox's own terms (names of known accounts and contacts, the sandbox theme, beginner notes).

## Verified ground truth

Checked against the working tree, the installed packages and the running sandbox node.

| Fact | Consequence |
|---|---|
| Routes are `/`, `/console` and `/scenarios`, wired by hand in `src/router.tsx` with `createHashHistory`. Console tabs (`transactions`, `blocks`, `accounts`, `watch`) are `useState` inside `ConsoleShell`, not routes. | `/contracts/$contractId` is a fourth top-level route with its own page shell. It cannot be a console tab without turning the tabs into routes, which this change does not do. |
| `useNodeSocket` runs through `useNodeState`, which each page calls itself (`StartPage`, `ConsoleShell`, `ScenarioPage`). On a new block it invalidates every key in `STALE_ON_BLOCK` (`src/lib/queryKeys.ts`). | The inspector page calls `useNodeState` too. Its queries refresh on a block by being in that list, not through polling. |
| `['contract', id]` (`useContract`) is `staleTime: Infinity` and deliberately not in `STALE_ON_BLOCK`, because it only serves the fixed `minActivation`. | The inspector uses its own key, `contractState`, which is in `STALE_ON_BLOCK`. `useContract` stays as it is. |
| `ledger` (the read-only client) exposes `contract.getContract`, `getContractMapValuesByFirstKey`, `getSingleContractMapValue`, `getContractsByAccount`, `getAllContractIds`. | No signing client is needed. Everything goes through `ledger`. |
| `Contract` (`@signumjs/contracts@3.3.4`) has `at, atRS, atVersion, name, description, creator, creatorRS, machineCodeHashId, machineData, balanceNQT, prevBalanceNQT, nextBlock, frozen, running, stopped, finished, dead, minActivation, creationBlock`. There is no `sleepUntil`. | The header shows these fields. Sleeping is shown as `nextBlock`, not as a separate field. |
| `ContractDataView` (`@signumjs/contracts@3.3.4`) was run against `ffffffffffffffff 0100000000000000 6869000000000000 0a00b00000000000 00e1f505`. `getVariable` answers big-endian hex, and `getVariableAsDecimal` answers unsigned (`18446744073709551615`). `getVariableAsString` reads the big-endian hex, so a short string stored as `"hi"` comes back as `"ih"` (this is why the reference inspector has a "reversed string" field). It throws `Error decoding utf-8 data` on non-UTF-8 bytes, and `getVariable` throws on a partial trailing slot. | Slots are decoded here, in about twenty lines of BigInt and `TextDecoder`, rather than through `ContractDataView`. Text is read in stored byte order, which is how SmartC packs short strings, so one text column is enough. No conversion can throw. |
| `getAT` for an unknown id answers `{"errorCode":5,"errorDescription":"Unknown at"}`. | A URL for a contract that does not exist, e.g. after a rewind, shows a "no such contract on this chain" state, not an error dump. |
| `getATMapValues` for an unknown contract or key1 answers `{"keyValues":[]}`. `getATMapValue` for an unknown key pair answers `{"value":"0"}`. | An unset map entry and an entry set to 0 look the same. The page says so next to a single-value result instead of claiming "not set". |
| Contract tokens are not in `getAT`. `getAccount` for a contract id answers normally (with `isAT: true`) and carries `assetBalances`. | Tokens come from a second query, `account` for the contract id, which is already in `STALE_ON_BLOCK`. |
| `TransactionRow` computes `deployedContract` for a confirmed `contractCreate` (contract id = transaction id). `ContactList` knows `contact.kind === 'contract'`. `WatchView` loads `getAccount` for the watched id. | These three places get the link into the inspector. |
| `useValueFlash` flashes a value once on a real change, never on first sight, and respects the motion switch. | Changed slots and the balance reuse it. |
| All ten locales must share `en`'s key set (`locales.test.ts`). Tests run in `node` with no component tests. | Every new string lands in all ten files. Everything worth testing is a pure function in `src/lib`. |

## Decisions

1. **One route, `/contracts/$contractId`.** The parameter accepts a numeric id or an RS address (any case, prefix optional) and is folded through `toComparableId`. A malformed one shows the not-found state. The page has the console's header style and a link back to `/console`. There is no contract list in this change. One may later sit next to the Accounts tab.

2. **Three ways in.**
   - **Contacts:** a contact with `kind: 'contract'` in `ContactList` gets an "Inspect" link.
   - **Watch:** when the watched account's `getAccount` says `isAT: true`, `WatchView` shows the same link.
   - **Deployment:** a confirmed `contractCreate` row in `TransactionRow` links its `deployedContract` to the inspector, next to the existing "save as contact".
   - **Sender and recipient in transaction rows:** a sender or recipient that is a contract links to the inspector. A party counts as a contract when it is a contact with `kind: 'contract'`, or when it is the sender of a `contractPayment` row (that subtype is only ever created by a contract). As in decision 7, there is no per-row `getAccount`. A call to a contract that is not saved as a contact therefore stays unlinked, which is one more reason to save contracts as contacts.

3. **Header: identity, money, state.**
   - **Identity:** name, description, address/id, creator (shown through `displayName`, so a sandbox account or contact shows its name), creation block, `atVersion`, `machineCodeHashId`.
   - **Money:** SIGNA balance (`balanceNQT`), held tokens (from `getAccount`), and activation cost (`minActivation`).
   - **State:** one status, derived by a pure `contractStatus(contract)` in this precedence: `dead` > `frozen` > `finished` > `stopped` > `running` > `idle`. Also `nextBlock`. `frozen` means the balance is below the activation amount, and the page says that in one sentence because it is the most common surprise.

4. **Recent transactions, by direction.** As in `WatchView`: incoming (calls) and outgoing (what the contract paid or sent) side by side, using the same queries (`receivedBy`, `sentBy`, both already in `STALE_ON_BLOCK`). `WatchView`'s private `Direction` list moves to its own file so both views share it. Its row click becomes optional. The inspector has no console to jump into, so its rows are not clickable until the console is addressable.

5. **Data stack as a table, one row per slot.** Columns: index, label (decision 8), raw hex as stored (little-endian), hex (big-endian), decimal unsigned, decimal signed (two's complement), text, and account (decision 7). Both decimal columns are shown because contracts read ids as unsigned while counters and differences can go negative. The signed value is shown only when it differs, i.e. when the top bit is set. A pure `toDataSlots(machineData)` in `src/lib/contractData.ts` produces the rows. Text is the slot's bytes in stored order with trailing zero bytes dropped. A slot that is not valid UTF-8, contains a control character, or is all zeros has no text, and the cell stays empty rather than showing garbage. A partial trailing slot is padded with zero bytes at its high end, which keeps its value. The table shows the total size in bytes and slots.

6. **Live, with changes marked.** `contractState` is in `STALE_ON_BLOCK`. When the data stack comes back different, a pure `changedSlots(previous, next)` names the slots that differ. Those rows flash once (`useValueFlash`) and keep a small "changed" marker, with the block height, until the next refresh that changes something. Balance and status flash the same way. A refetch that answers the same data marks nothing.

7. **Account values are linked only when known.** A slot's decimal value is matched against the ids the page already knows: sandbox accounts, contacts, the creator, and the contract itself. A match shows the name and address, and a contract match links to its own inspector page. Any other match is shown without a link, because the console has no URL for an account yet. Making the watch view addressable (e.g. `/console?watch=<id>`) is a separate, planned change, and these matches become links then. There is no per-slot `getAccount` against the chain (same N+1 reasoning as `TransactionRow`).

8. **Slot labels are set by hand and stored per code hash.** Any slot can be given a label inline. Labels live in `localStorage` under `signum-sandbox.contractLabels.v1` as `{ [machineCodeHashId]: { [slotIndex]: label } }`. They are keyed by code hash because the same code has the same layout, so a redeployed contract keeps its labels. The labels are read by a tolerant `parseContractLabels` (malformed entries dropped), like `parseContacts`.

9. **Maps: key1, optionally key2.** Key fields accept a decimal number or an address (folded to its id, since contracts commonly key maps by account).
   - **key1 only:** `getContractMapValuesByFirstKey` lists `key2 → value`.
   - **key1 and key2:** `getSingleContractMapValue` returns one value, with the note from the ground truth that 0 and unset are indistinguishable.

   Values get the same decimal/account interpretation as slots. The query key `contractMap` is in `STALE_ON_BLOCK`, so a shown map refreshes live too. The last few key1 values used per contract are kept in component state only; persisting them is not part of this change.

10. **Not found and not yet confirmed.** "Unknown at" and an unparsable id show one not-found state with a link back to the console. A deployment that is still unconfirmed has no inspector link, as it has no contact link today.

11. **Beginner mode and glossary.** New glossary terms are data stack, map, activation amount and code hash. Each section gets a `ViewNote` in beginner mode, explaining for example that every slot is one `long` and stored little-endian.

## Components

### `src/lib/contractData.ts` (new, pure, tested first)

```ts
export interface DataSlot {
  index: number
  raw: string            // 16 hex chars as stored (little-endian)
  hex: string            // big-endian
  decimal: string        // unsigned
  signed: string | null  // two's complement; null when equal to decimal
  text: string | null    // null when empty, not UTF-8, or not printable
}

export function toDataSlots(contract: Pick<Contract, 'machineData'>): DataSlot[]
export function changedSlots(previous: DataSlot[] | null, next: DataSlot[]): Set<number>

export type ContractStatus = 'dead' | 'frozen' | 'finished' | 'stopped' | 'running' | 'idle'
export function contractStatus(contract: Contract): ContractStatus
```

### `src/lib/contractLabels.ts` (new, pure, tested)

`parseContractLabels(raw: string | null)`, `setSlotLabel(labels, codeHash, index, label)` (an empty label removes the entry). This is the same storage pattern as contacts.

### `src/lib/queryKeys.ts`

`contractState` and `contractMap` are added to `STALE_ON_BLOCK`. The comment about `contract` stays true and gains one line on why the inspector uses separate keys.

### `src/hooks/useContractInspector.ts` (new)

Bundles the queries `contractState` (`getContract`), `account` (tokens), `receivedBy` and `sentBy`, and keeps the previous slot list in a ref to compute `changedSlots`.

### `src/hooks/useContractLabels.ts` (new)

Reads and writes the label store, in the same way as `useContacts`.

### `src/routes/contracts.$contractId.tsx` (new) and `src/router.tsx`

Route definition and registration in the route tree.

### `src/components/contracts/` (new)

- `ContractPage.tsx` — page shell, `useNodeState`, not-found state.
- `ContractHeader.tsx` — identity, money, state (decision 3).
- `DataStackTable.tsx` — slots, labels, change markers.
- `ContractMaps.tsx` — key1/key2 form and result table.
- `src/components/console/views/Direction.tsx` — moved out of `WatchView`, shared by both views.

### Entry points

These are small edits in `ContactList.tsx`, `WatchView.tsx` and `TransactionRow.tsx`, each a `Link` to `/contracts/$contractId`.

### i18n, glossary

New keys in all ten locales, plus glossary entries.

## Testing

- `contractData.test.ts`: slot splitting incl. a trailing partial slot, endianness against the vector above (`6869…` → text `"hi"`, `0100…` → `1`), non-printable or invalid UTF-8 → `null`, signed value only when the top bit is set (`0xFF…FF` → `-1`), `changedSlots` with `null` previous, equal lists, a grown stack, and the precedence of `contractStatus`.
- `contractLabels.test.ts`: malformed storage, removal by empty label, separation by code hash.
- `queryKeys`: assert the two new keys are present (guards against the drift the file's comment describes).
- Manual: deploy a small SmartC contract to the local chain, call it from the console, and watch a slot change and flash.

## Out of scope

- Code stack and disassembly.
- A list of all contracts (possibly a later tab next to Accounts).
- Deriving slot names from SmartC source or assembly.
- Deploying contracts.
- Persisting map key history.
- An addressable console (`/console?watch=<id>`), planned separately. Once it exists, non-contract account matches in slots and maps become links.
