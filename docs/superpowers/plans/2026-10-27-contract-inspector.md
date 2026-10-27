# Contract Inspector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page at `/contracts/$contractId` shows one smart contract on the sandbox chain: identity, money, runtime state, recent activity, its data stack as a table of slots (with hand-set labels, known accounts, and changed slots marked live), and its maps by key1 and optional key2. Contacts, the watch view and transaction rows link into it.

**Architecture:** Decoding, change detection, status and account matching are pure functions in `src/lib/contractData.ts`. Label storage is in `src/lib/contractLabels.ts`, also pure. One hook, `useContractInspector`, holds the queries and the "what changed" state. The page is a new top-level route next to `/console` and `/scenarios` and keeps itself live through `useNodeState`, the same way `ScenarioPage` does. Its query keys are in `STALE_ON_BLOCK`.

**Tech Stack:** TypeScript 5.8, React 19, TanStack Router 1 (hash history, hand-wired route tree), TanStack Query 5, SignumJS 3.3.4, i18next across ten locales, Vitest (`environment: 'node'`, no component tests), Bun.

**Spec:** `docs/superpowers/specs/2026-10-27-contract-inspector-design.md`. Read it before starting. It holds the verified ground truth this plan relies on.

## Global Constraints

- **Decode slots here, not with `ContractDataView`.** In 3.3.4 it reverses short strings (`"hi"` → `"ih"`), throws on non-UTF-8, and throws on a partial slot. The spec has the vector.
- **Never import `src/lib/ledger.ts` from a file that has tests.** It reads `window` at import time, and tests run in `node`.
- **Keep `['contract', id]` (`useContract`) as it is.** It is `staleTime: Infinity` on purpose. The inspector uses `['contractState', id]` and `['contractMap', …]`, and both go into `STALE_ON_BLOCK`.
- **No per-row or per-slot `getAccount`.** Account names come from sandbox accounts, contacts, the creator and the contract itself.
- **Only contracts are linked.** Non-contract account matches are shown without a link until the console becomes addressable (separate, planned change).
- **Every new i18n key lands in all ten locales** (`de en es hi ja ko pt ru uk zh`) in the same commit, or `locales.test.ts` fails. Every new glossary term needs `term` and `help` (`glossary.test.ts`). This plan gives `en` and `de`. Translate the other eight in the same commit.
- **Commit messages follow the repo style:** a lowercase conventional prefix and a subject that says what is now true. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Verification:** `bun run test` and `bunx tsc -p tsconfig.json`.

## Review Focus

1. **A short string slot.** `6869000000000000` must read `"hi"`, not `"ih"`. Pinned in Task 1.
2. **A refetch that changes nothing.** No slot may be marked, and an earlier marker stays with its block height. Pinned in Task 1 (`changedSlots` on equal lists) and Task 6 (the hook only replaces the marker when something changed).
3. **The `contract` cache.** `useContract`'s `['contract', id]` must stay out of `STALE_ON_BLOCK`. Pinned in Task 4's `queryKeys.test.ts`.
4. **A sender of a `contractPayment` that is not a contact.** It is still linked, because only a contract can send that subtype. A call to a non-contact contract is not. Pinned in Task 2.
5. **An id in the URL for a contract that a rewind removed.** It shows the not-found state, not an error dump. Covered in Task 9 Step 3.

---

### Task 1: Slots, status and changes

**Files:**
- Create: `src/lib/contractData.ts`
- Test: `src/lib/contractData.test.ts`

**Interfaces:**
- Consumes: `Contract` type from `@signumjs/contracts` (type-only import).
- Produces:
  ```ts
  export interface DataSlot { index: number; raw: string; hex: string; decimal: string; signed: string | null; text: string | null }
  export function toDataSlots(machineData: string): DataSlot[]
  export function changedSlots(previous: DataSlot[] | null, next: DataSlot[]): Set<number>
  export type ContractStatus = 'dead' | 'frozen' | 'finished' | 'stopped' | 'running' | 'idle'
  export function contractStatus(contract: Pick<Contract, 'dead' | 'frozen' | 'finished' | 'stopped' | 'running'>): ContractStatus
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/contractData.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { changedSlots, contractStatus, toDataSlots } from './contractData'

describe('toDataSlots', () => {
  it('splits machine data into 8-byte slots and reads them little-endian', () => {
    const [max, one] = toDataSlots('ffffffffffffffff0100000000000000')
    expect(max).toEqual({
      index: 0,
      raw: 'ffffffffffffffff',
      hex: 'ffffffffffffffff',
      decimal: '18446744073709551615',
      signed: '-1',
      text: null,
    })
    expect(one).toMatchObject({ index: 1, hex: '0000000000000001', decimal: '1', signed: null })
  })

  it('reads a short string in stored byte order', () => {
    expect(toDataSlots('6869000000000000')[0].text).toBe('hi')
    expect(toDataSlots('c3a4c3b600000000')[0].text).toBe('äö')
  })

  it('has no text for zeros, control characters or invalid UTF-8', () => {
    expect(toDataSlots('0000000000000000')[0].text).toBeNull()
    expect(toDataSlots('0100000000000000')[0].text).toBeNull()
    expect(toDataSlots('0a00b00000000000')[0].text).toBeNull()
    expect(toDataSlots('c300000000000000')[0].text).toBeNull()
  })

  it('pads a partial trailing slot at its high end, keeping its value', () => {
    const slots = toDataSlots('ffffffffffffffff00e1f505')
    expect(slots).toHaveLength(2)
    expect(slots[1]).toMatchObject({ raw: '00e1f50500000000', decimal: '100000000' })
  })

  it('accepts upper-case hex and an empty stack', () => {
    expect(toDataSlots('0A00000000000000')[0].decimal).toBe('10')
    expect(toDataSlots('')).toEqual([])
  })
})

describe('changedSlots', () => {
  const before = toDataSlots('01000000000000000200000000000000')

  it('marks nothing on first sight', () => {
    expect(changedSlots(null, before).size).toBe(0)
  })

  it('marks nothing when the data is the same', () => {
    expect(changedSlots(before, toDataSlots('01000000000000000200000000000000')).size).toBe(0)
  })

  it('marks exactly the slots that differ', () => {
    const after = toDataSlots('01000000000000000300000000000000')
    expect([...changedSlots(before, after)]).toEqual([1])
  })

  it('marks a slot that did not exist before', () => {
    const grown = toDataSlots('010000000000000002000000000000000100000000000000')
    expect([...changedSlots(before, grown)]).toEqual([2])
  })
})

describe('contractStatus', () => {
  const flags = { dead: false, frozen: false, finished: false, stopped: false, running: false }

  it('is idle with no flag set', () => {
    expect(contractStatus(flags)).toBe('idle')
  })

  it('takes the most final flag', () => {
    expect(contractStatus({ ...flags, running: true, stopped: true })).toBe('stopped')
    expect(contractStatus({ ...flags, stopped: true, finished: true })).toBe('finished')
    expect(contractStatus({ ...flags, finished: true, frozen: true })).toBe('frozen')
    expect(contractStatus({ ...flags, frozen: true, dead: true })).toBe('dead')
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test src/lib/contractData.test.ts`
Expected: FAIL, because `./contractData` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/contractData.ts`:

```ts
import type { Contract } from '@signumjs/contracts'

/**
 * One 8-byte variable of a contract, read every way a person might need it.
 *
 * `raw` is what the node stores: little-endian hex. `hex` and the decimals are
 * the value a contract computes with. `text` is the bytes in stored order,
 * which is how SmartC packs a short string, so "hi" reads as "hi".
 */
export interface DataSlot {
  index: number
  raw: string
  hex: string
  /** Unsigned, the way a contract reads an id. */
  decimal: string
  /** Two's complement, only when it differs from `decimal`. */
  signed: string | null
  /** Null when the slot is empty, not UTF-8, or not printable. */
  text: string | null
}

const SLOT_HEX = 16
const TWO_63 = 2n ** 63n
const TWO_64 = 2n ** 64n
const utf8 = new TextDecoder('utf-8', { fatal: true })

function bytesOf(raw: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < raw.length; i += 2) bytes.push(parseInt(raw.slice(i, i + 2), 16))
  return bytes
}

function textOf(bytes: number[]): string | null {
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  if (end === 0) return null
  try {
    const text = utf8.decode(new Uint8Array(bytes.slice(0, end)))
    // A number that happens to decode is not text: a slot holding 1 would
    // otherwise show an invisible \u0001.
    return /[\u0000-\u001f\u007f-\u009f]/.test(text) ? null : text
  } catch {
    return null
  }
}

/**
 * The data stack as slots.
 *
 * Decoded here rather than through ContractDataView, which in 3.3.4 reads
 * strings from the big-endian hex (so "hi" comes back "ih") and throws on
 * bytes that are not UTF-8 and on a partial slot. Nothing in here throws.
 * A partial trailing slot is padded at its high end, which keeps its value.
 */
export function toDataSlots(machineData: string): DataSlot[] {
  const slots: DataSlot[] = []
  for (let index = 0; index * SLOT_HEX < machineData.length; index++) {
    const raw = machineData
      .slice(index * SLOT_HEX, (index + 1) * SLOT_HEX)
      .toLowerCase()
      .padEnd(SLOT_HEX, '0')
    const bytes = bytesOf(raw)
    const hex = [...bytes]
      .reverse()
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const unsigned = BigInt(`0x${hex}`)
    slots.push({
      index,
      raw,
      hex,
      decimal: unsigned.toString(),
      signed: unsigned >= TWO_63 ? (unsigned - TWO_64).toString() : null,
      text: textOf(bytes),
    })
  }
  return slots
}

/**
 * The slots whose stored bytes differ. Nothing on first sight: a stack
 * appearing for the first time did not change, it arrived.
 */
export function changedSlots(previous: DataSlot[] | null, next: DataSlot[]): Set<number> {
  const changed = new Set<number>()
  if (previous === null) return changed
  for (const slot of next) {
    if (previous[slot.index]?.raw !== slot.raw) changed.add(slot.index)
  }
  return changed
}

export type ContractStatus = 'dead' | 'frozen' | 'finished' | 'stopped' | 'running' | 'idle'

/**
 * One word for the node's five flags, which can be set together. The most
 * final one wins: a dead contract that is also frozen is, above all, dead.
 */
export function contractStatus(
  contract: Pick<Contract, 'dead' | 'frozen' | 'finished' | 'stopped' | 'running'>,
): ContractStatus {
  if (contract.dead) return 'dead'
  if (contract.frozen) return 'frozen'
  if (contract.finished) return 'finished'
  if (contract.stopped) return 'stopped'
  if (contract.running) return 'running'
  return 'idle'
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/lib/contractData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractData.ts src/lib/contractData.test.ts
git commit -m "feat: a contract's data stack reads as slots, short strings the right way round

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Which ids the page can name, and which parties are contracts

**Files:**
- Modify: `src/lib/contractData.ts`
- Modify: `src/lib/contractData.test.ts`

**Interfaces:**
- Consumes: `Contacts` from `src/lib/contacts.ts`, `SandboxAccount` from `src/lib/accounts.ts`, `toComparableId` from `src/lib/recipient.ts`, `TxKind` from `src/lib/txSummary.ts`.
- Produces:
  ```ts
  export interface KnownId { id: string; name: string; contract: boolean }
  export function knownIds(accounts: SandboxAccount[], contacts: Contacts, extra: KnownId[]): Map<string, KnownId>
  export function contractPartyId(address: string, role: 'sender' | 'recipient', kind: TxKind, contacts: Contacts): string | null
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/contractData.test.ts`. Add `contractPartyId` and `knownIds` to the import from `./contractData`, and add these imports at the top:

```ts
import { toAddress } from './recipient'
```

```ts
describe('knownIds', () => {
  // Only id and name are read, so no key derivation (and no crypto adapter) is needed.
  const alice = { id: '9999', address: toAddress('9999', 'TS'), name: 'Alice', passphrase: '' }
  const contacts = {
    '1111': { name: 'Bob', kind: 'account' as const },
    '2222': { name: 'Registry', kind: 'contract' as const },
  }

  it('names owned accounts, contacts and the extras', () => {
    const known = knownIds([alice], contacts, [{ id: '3333', name: 'Creator', contract: false }])
    expect(known.get(alice.id)).toEqual({ id: alice.id, name: 'Alice', contract: false })
    expect(known.get('1111')).toEqual({ id: '1111', name: 'Bob', contract: false })
    expect(known.get('2222')).toEqual({ id: '2222', name: 'Registry', contract: true })
    expect(known.get('3333')?.name).toBe('Creator')
  })

  it('lets an owned account or a contact name win over an extra', () => {
    const known = knownIds([alice], contacts, [
      { id: alice.id, name: 'Creator', contract: false },
      { id: '2222', name: 'This contract', contract: true },
    ])
    expect(known.get(alice.id)?.name).toBe('Alice')
    expect(known.get('2222')?.name).toBe('Registry')
  })

  it('never knows zero, which is what an unset slot holds', () => {
    expect(knownIds([], {}, [{ id: '0', name: 'x', contract: false }]).has('0')).toBe(false)
  })
})

describe('contractPartyId', () => {
  const contacts = { '2222': { name: 'Registry', kind: 'contract' as const } }
  const registry = toAddress('2222', 'TS')

  it('links a contract contact in either role', () => {
    expect(contractPartyId(registry, 'recipient', 'payment', contacts)).toBe('2222')
    expect(contractPartyId(registry, 'sender', 'message', contacts)).toBe('2222')
  })

  it('links the sender of a contract payment even when it is no contact', () => {
    const other = toAddress('4444', 'TS')
    expect(contractPartyId(other, 'sender', 'contractPayment', contacts)).toBe('4444')
    expect(contractPartyId(other, 'recipient', 'contractPayment', contacts)).toBeNull()
  })

  it('does not link anyone else', () => {
    expect(contractPartyId(toAddress('4444', 'TS'), 'recipient', 'payment', contacts)).toBeNull()
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test src/lib/contractData.test.ts`
Expected: FAIL, because `knownIds` and `contractPartyId` are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/contractData.ts` and merge the imports at the top:

```ts
import type { Contacts } from './contacts'
import type { SandboxAccount } from './accounts'
import type { TxKind } from './txSummary'
import { toComparableId } from './recipient'

export interface KnownId {
  id: string
  name: string
  contract: boolean
}

/**
 * Every id the page can put a name to without asking the chain: what the
 * console already knows, plus what this contract says about itself. A slot
 * is matched against this; a per-slot getAccount would be an N+1 on every
 * block. Owned accounts and contacts win over the extras, because a name the
 * person gave is the one they recognise. Zero is never an account: it is
 * what every unset slot holds.
 */
export function knownIds(
  accounts: SandboxAccount[],
  contacts: Contacts,
  extra: KnownId[],
): Map<string, KnownId> {
  const known = new Map<string, KnownId>()
  for (const entry of extra) known.set(entry.id, entry)
  for (const [id, contact] of Object.entries(contacts)) {
    known.set(id, { id, name: contact.name, contract: contact.kind === 'contract' })
  }
  for (const account of accounts) {
    known.set(account.id, { id: account.id, name: account.name, contract: false })
  }
  known.delete('0')
  return known
}

/**
 * The contract id behind a sender or recipient, when the row can tell it is
 * one: a contact saved as a contract, or the sender of a contract payment,
 * a subtype only a contract ever creates. Anyone else is not looked up.
 */
export function contractPartyId(
  address: string,
  role: 'sender' | 'recipient',
  kind: TxKind,
  contacts: Contacts,
): string | null {
  const id = toComparableId(address)
  if (contacts[id]?.kind === 'contract') return id
  if (role === 'sender' && kind === 'contractPayment') return id
  return null
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/lib/contractData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractData.ts src/lib/contractData.test.ts
git commit -m "feat: the sandbox can tell which ids it knows and which parties are contracts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Slot labels, stored per code hash

**Files:**
- Create: `src/lib/contractLabels.ts`
- Test: `src/lib/contractLabels.test.ts`
- Create: `src/hooks/useContractLabels.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ContractLabels = Record<string, Record<number, string>>   // codeHash → slot index → label
  export function parseContractLabels(raw: string | null): ContractLabels
  export function serializeContractLabels(labels: ContractLabels): string
  export function setSlotLabel(labels: ContractLabels, codeHash: string, index: number, label: string): ContractLabels
  // hook
  export function useContractLabels(codeHash: string | null): { labels: Record<number, string>; setLabel: (index: number, label: string) => void }
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/contractLabels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseContractLabels, serializeContractLabels, setSlotLabel } from './contractLabels'

describe('contract labels', () => {
  it('reads nothing as empty', () => {
    expect(parseContractLabels(null)).toEqual({})
    expect(parseContractLabels('not json')).toEqual({})
    expect(parseContractLabels('[1,2]')).toEqual({})
  })

  it('drops malformed entries and keeps the rest', () => {
    const raw = JSON.stringify({
      abc: { '0': 'owner', '1': 42, x: 'nope', '-1': 'nope', '2': '' },
      def: 'nope',
    })
    expect(parseContractLabels(raw)).toEqual({ abc: { 0: 'owner' } })
  })

  it('round-trips', () => {
    const labels = setSlotLabel({}, 'abc', 3, 'counter')
    expect(parseContractLabels(serializeContractLabels(labels))).toEqual(labels)
  })

  it('keeps code hashes apart, trims, and removes on an empty label', () => {
    let labels = setSlotLabel({}, 'abc', 0, ' owner ')
    labels = setSlotLabel(labels, 'def', 0, 'price')
    expect(labels).toEqual({ abc: { 0: 'owner' }, def: { 0: 'price' } })
    labels = setSlotLabel(labels, 'abc', 0, '  ')
    expect(labels).toEqual({ def: { 0: 'price' } })
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test src/lib/contractLabels.test.ts`
Expected: FAIL, because the module does not exist.

- [ ] **Step 3: Implement the library**

Create `src/lib/contractLabels.ts`:

```ts
/**
 * Names a person gave to a contract's slots, keyed by code hash and then by
 * slot index. By code hash rather than by contract, because the same code
 * has the same layout: a redeployed contract keeps its labels, and so does
 * every other instance of it.
 */
export type ContractLabels = Record<string, Record<number, string>>

/** Tolerant like parseContacts: storage can be hand-edited, and one odd entry should not cost the rest. */
export function parseContractLabels(raw: string | null): ContractLabels {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw ?? '')
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const labels: ContractLabels = {}
  for (const [codeHash, slots] of Object.entries(parsed)) {
    if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) continue
    const kept: Record<number, string> = {}
    for (const [index, label] of Object.entries(slots)) {
      if (!/^\d+$/.test(index) || typeof label !== 'string' || label.trim() === '') continue
      kept[Number(index)] = label
    }
    if (Object.keys(kept).length > 0) labels[codeHash] = kept
  }
  return labels
}

export function serializeContractLabels(labels: ContractLabels): string {
  return JSON.stringify(labels)
}

/** An empty label removes the entry, and a code hash with no labels left goes with it. */
export function setSlotLabel(
  labels: ContractLabels,
  codeHash: string,
  index: number,
  label: string,
): ContractLabels {
  const slots = { ...labels[codeHash] }
  const trimmed = label.trim()
  if (trimmed === '') delete slots[index]
  else slots[index] = trimmed

  const next = { ...labels }
  if (Object.keys(slots).length === 0) delete next[codeHash]
  else next[codeHash] = slots
  return next
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/lib/contractLabels.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the hook**

Create `src/hooks/useContractLabels.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import {
  parseContractLabels,
  serializeContractLabels,
  setSlotLabel,
  type ContractLabels,
} from '@/lib/contractLabels'

const STORAGE_KEY = 'signum-sandbox.contractLabels.v1'

/**
 * The labels for one contract's code. `codeHash` is null until the contract
 * has loaded, and nothing can be labelled before then.
 */
export function useContractLabels(codeHash: string | null) {
  const [all, setAll] = useState<ContractLabels>({})

  useEffect(() => {
    setAll(parseContractLabels(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const setLabel = useCallback(
    (index: number, label: string) => {
      if (codeHash === null) return
      setAll((previous) => {
        const next = setSlotLabel(previous, codeHash, index, label)
        window.localStorage.setItem(STORAGE_KEY, serializeContractLabels(next))
        return next
      })
    },
    [codeHash],
  )

  return { labels: (codeHash && all[codeHash]) || {}, setLabel }
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `bunx tsc -p tsconfig.json`
Expected: no errors.

```bash
git add src/lib/contractLabels.ts src/lib/contractLabels.test.ts src/hooks/useContractLabels.ts
git commit -m "feat: a contract's slots can be named, and the names follow its code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The route, the page shell and the words

**Files:**
- Modify: `src/lib/queryKeys.ts`
- Create: `src/lib/queryKeys.test.ts`
- Modify: `src/lib/glossary.ts`
- Modify: `src/i18n/locales/*.ts` (all ten)
- Create: `src/routes/contract.tsx`
- Modify: `src/router.tsx`
- Create: `src/components/contracts/ContractPage.tsx`
- Create: `src/components/contracts/InspectLink.tsx`

**Interfaces:**
- Produces: the route `/contracts/$contractId`, the component `InspectLink({ contractId })`, and the glossary terms `dataStack | contractMap | activation | codeHash`.

- [ ] **Step 1: Write the failing query-key test**

Create `src/lib/queryKeys.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STALE_ON_BLOCK } from './queryKeys'

describe('STALE_ON_BLOCK', () => {
  it('refreshes what the contract inspector shows', () => {
    for (const key of ['contractState', 'contractMap', 'account', 'sentBy', 'receivedBy']) {
      expect(STALE_ON_BLOCK).toContain(key)
    }
  })

  it('leaves the fixed activation amount alone', () => {
    expect(STALE_ON_BLOCK).not.toContain('contract')
  })
})
```

Run: `bun run test src/lib/queryKeys.test.ts`
Expected: FAIL on `contractState`.

- [ ] **Step 2: Add the keys**

In `src/lib/queryKeys.ts`, extend the doc comment's "Deliberately not everything" paragraph with one sentence: *"The contract inspector reads the same contract under `contractState`, which does change with every block it runs in."* Then add the two keys at the end of `STALE_ON_BLOCK`:

```ts
  // What the contract inspector shows: the whole contract (balance, flags,
  // data stack) and whichever map entries are open.
  'contractState',
  'contractMap',
```

Run: `bun run test src/lib/queryKeys.test.ts`
Expected: PASS.

- [ ] **Step 3: Glossary terms and strings**

In `src/lib/glossary.ts`, append to `GLOSSARY_TERMS` after `'contract'`:

```ts
  // The contract inspector's vocabulary.
  'dataStack',
  'contractMap',
  'activation',
  'codeHash',
```

In `src/i18n/locales/en.ts`, add inside `glossary` after `contract`:

```ts
    dataStack: {
      term: 'Data stack',
      help: 'A contract\'s variables: a row of 8-byte slots. Each holds one number, read little-endian. The same 8 bytes can be an id, an amount or a short text, depending on what the contract means by them.',
    },
    contractMap: {
      term: 'Contract map',
      help: 'Storage a contract keeps beside its data stack: values filed under two keys. You can look up everything under a first key, or one value under both.',
    },
    activation: {
      term: 'Activation amount',
      help: 'The SIGNA a contract needs to receive in one transaction before it runs. Less than that only adds to its balance.',
    },
    codeHash: {
      term: 'Code hash',
      help: 'A fingerprint of the contract\'s code. Contracts with the same code hash run the same program, so they lay out their data the same way.',
    },
```

Add to `console.note`:

```ts
      contract:
        'A smart contract, live: what it holds, whether it runs, and what has gone in and out. Everything here refreshes with each block.',
      contractData:
        'Every variable of the contract, one row per 8-byte slot. A row that changed in the last block that changed anything is marked. Name a slot to remember what it holds.',
      contractMaps:
        'Look up what the contract filed under a first key, or one value under both keys. Keys can be numbers or addresses.',
```

Add a new top-level section `inspector` after `console`:

```ts
  inspector: {
    title: 'Contract',
    back: 'Back to the console',
    notFound: 'There is no contract with this id on this chain.',
    inspect: 'Inspect',
    field: {
      address: 'Address',
      creator: 'Creator',
      description: 'Description',
      created: 'Created in block',
      version: 'AT version',
      balance: 'Balance',
      status: 'Status',
      nextBlock: 'Next run at block',
    },
    status: {
      dead: 'dead',
      frozen: 'frozen',
      finished: 'finished',
      stopped: 'waiting',
      running: 'running',
      idle: 'idle',
    },
    frozenHint: 'Its balance is below the activation amount, so it will not run until it receives more SIGNA.',
    data: {
      size: '{{bytes}} bytes · {{slots}} slots',
      index: '#',
      label: 'Label',
      raw: 'Stored',
      hex: 'Hex',
      decimal: 'Decimal',
      signed: 'Signed',
      text: 'Text',
      account: 'Account',
      changed: 'changed in block {{height}}',
      labelPlaceholder: 'name',
      empty: 'This contract keeps no data.',
    },
    maps: {
      key1: 'Key 1',
      key2: 'Key 2 (optional)',
      load: 'Look up',
      invalidKey: 'A key is a number or an address',
      none: 'Nothing is filed under this key.',
      value: 'Value',
      zeroNote: 'The node answers 0 for an entry that was never set, so 0 can also mean "not set".',
      recent: 'Recent',
    },
  },
```

In `src/i18n/locales/de.ts`, at the same places:

```ts
    dataStack: {
      term: 'Datenstack',
      help: 'Die Variablen eines Contracts: eine Reihe von 8-Byte-Slots. Jeder enthält eine Zahl, gelesen als Little-Endian. Dieselben 8 Bytes können eine ID, ein Betrag oder ein kurzer Text sein, je nachdem, was der Contract damit meint.',
    },
    contractMap: {
      term: 'Contract-Map',
      help: 'Speicher, den ein Contract neben seinem Datenstack führt: Werte, abgelegt unter zwei Schlüsseln. Du kannst alles unter einem ersten Schlüssel nachschlagen oder einen Wert unter beiden.',
    },
    activation: {
      term: 'Aktivierungsbetrag',
      help: 'Die SIGNA, die ein Contract in einer Transaktion bekommen muss, bevor er läuft. Weniger erhöht nur sein Guthaben.',
    },
    codeHash: {
      term: 'Code-Hash',
      help: 'Ein Fingerabdruck des Contract-Codes. Contracts mit demselben Code-Hash führen dasselbe Programm aus und legen ihre Daten gleich ab.',
    },
```

```ts
      contract:
        'Ein Smart Contract, live: was er hält, ob er läuft und was hinein- und hinausgegangen ist. Alles hier aktualisiert sich mit jedem Block.',
      contractData:
        'Jede Variable des Contracts, eine Zeile pro 8-Byte-Slot. Eine Zeile, die sich im letzten Block mit Änderungen geändert hat, ist markiert. Gib einem Slot einen Namen, um dir zu merken, was er enthält.',
      contractMaps:
        'Schlag nach, was der Contract unter einem ersten Schlüssel abgelegt hat, oder einen Wert unter beiden Schlüsseln. Schlüssel können Zahlen oder Adressen sein.',
```

```ts
  inspector: {
    title: 'Contract',
    back: 'Zurück zur Konsole',
    notFound: 'Auf dieser Chain gibt es keinen Contract mit dieser ID.',
    inspect: 'Ansehen',
    field: {
      address: 'Adresse',
      creator: 'Ersteller',
      description: 'Beschreibung',
      created: 'Erstellt in Block',
      version: 'AT-Version',
      balance: 'Guthaben',
      status: 'Status',
      nextBlock: 'Nächster Lauf in Block',
    },
    status: {
      dead: 'tot',
      frozen: 'eingefroren',
      finished: 'beendet',
      stopped: 'wartet',
      running: 'läuft',
      idle: 'untätig',
    },
    frozenHint: 'Sein Guthaben liegt unter dem Aktivierungsbetrag, deshalb läuft er erst wieder, wenn er mehr SIGNA bekommt.',
    data: {
      size: '{{bytes}} Bytes · {{slots}} Slots',
      index: '#',
      label: 'Name',
      raw: 'Gespeichert',
      hex: 'Hex',
      decimal: 'Dezimal',
      signed: 'Mit Vorzeichen',
      text: 'Text',
      account: 'Account',
      changed: 'geändert in Block {{height}}',
      labelPlaceholder: 'Name',
      empty: 'Dieser Contract hält keine Daten.',
    },
    maps: {
      key1: 'Schlüssel 1',
      key2: 'Schlüssel 2 (optional)',
      load: 'Nachschlagen',
      invalidKey: 'Ein Schlüssel ist eine Zahl oder eine Adresse',
      none: 'Unter diesem Schlüssel ist nichts abgelegt.',
      value: 'Wert',
      zeroNote: 'Die Node antwortet 0 für einen Eintrag, der nie gesetzt wurde. 0 kann also auch „nicht gesetzt“ heißen.',
      recent: 'Zuletzt',
    },
  },
```

Translate the same keys into `es hi ja ko pt ru uk zh`. Keep `{{bytes}}`, `{{slots}}` and `{{height}}` as they are.

Run: `bun run test src/i18n src/lib/glossary.test.ts`
Expected: PASS.

- [ ] **Step 4: The inspect link**

Create `src/components/contracts/InspectLink.tsx`:

```tsx
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

/** The one way into the contract inspector, so every entry point looks the same. */
export function InspectLink({ contractId }: { contractId: string }) {
  const { t } = useTranslation()
  return (
    <Link
      className="text-[13px] text-[var(--blue3)] underline"
      to="/contracts/$contractId"
      params={{ contractId }}
    >
      {t('inspector.inspect')}
    </Link>
  )
}
```

- [ ] **Step 5: Route and page shell**

Create `src/routes/contract.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ContractPage } from '@/components/contracts/ContractPage'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contracts/$contractId',
  component: function ContractRoute() {
    const { contractId } = Route.useParams()
    return <ContractPage param={contractId} />
  },
})
```

In `src/router.tsx`, import it as `contractRoute` and add it to `rootRoute.addChildren([...])`.

Create `src/components/contracts/ContractPage.tsx`. This is the shell only. The sections arrive in Tasks 5–7.

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AppHeader } from '@/components/AppHeader'
import { PAGE_WIDTH } from '@/components/pageShell'
import { Unreachable } from '@/components/startpage'
import { BeginnerMode } from '@/components/console/BeginnerMode'
import { useBeginner } from '@/hooks/useBeginner'
import { useNodeState } from '@/hooks/useNodeState'
import { toAccountId } from '@/lib/recipient'
import { cn } from '@/lib/utils'

/**
 * One contract, on a page of its own.
 *
 * A route rather than a console tab: the tabs are state inside the console,
 * and a contract is something worth a link. The page keeps its own eye on
 * the chain through useNodeState, so everything below refreshes on a block
 * the same way the console does.
 */
export function ContractPage({ param }: { param: string }) {
  const { t } = useTranslation()
  const { state, nodeAddress } = useNodeState()
  const beginner = useBeginner()

  let contractId: string | null
  try {
    contractId = toAccountId(param)
  } catch {
    contractId = null
  }

  if (state.kind === 'unreachable') {
    return (
      <div className={cn('mx-auto p-6', PAGE_WIDTH)}>
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <BeginnerMode on={beginner.beginner}>
      <div className={cn('mx-auto p-6', PAGE_WIDTH)}>
        <AppHeader
          networkName={state.networkName}
          version={state.version}
          connection={state.connection}
          scanning={state.scanning}
          homeLink
        />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] uppercase tracking-[1px] text-[var(--blue3)]">
            {t('inspector.title')}
          </span>
          <span className="flex items-center gap-3 text-[13px]">
            <span>
              <span className="text-[var(--muted)]">{t('console.chain.height')} </span>
              <span className="font-bold text-[var(--blue3)]">{state.height ?? '—'}</span>
            </span>
            <Link className="text-[var(--blue3)] underline" to="/console">
              {t('inspector.back')}
            </Link>
          </span>
        </div>
        {contractId === null ? (
          <p className="text-[13px] text-[var(--muted)]">{t('inspector.notFound')}</p>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">{contractId}</p>
        )}
      </div>
    </BeginnerMode>
  )
}
```

Check the field names of `state` against `src/hooks/useNodeState.ts` and `ScenarioPage`, and adjust if they differ.

- [ ] **Step 6: Typecheck, test, look**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS.

With `bun run dev`, open `http://localhost:5173/#/contracts/123` (shows `123`) and `#/contracts/nope` (shows the not-found sentence).

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/queryKeys.ts src/lib/queryKeys.test.ts src/lib/glossary.ts src/i18n/locales src/routes/contract.tsx src/router.tsx src/components/contracts
git commit -m "feat: a contract has a page of its own, refreshed with every block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The inspector hook, the header and the activity

**Files:**
- Create: `src/hooks/useContractInspector.ts`
- Create: `src/components/console/views/Direction.tsx` (moved out of `WatchView.tsx`)
- Modify: `src/components/console/views/WatchView.tsx`
- Create: `src/components/contracts/ContractHeader.tsx`
- Modify: `src/components/contracts/ContractPage.tsx`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  ```ts
  export function useContractInspector(contractId: string, height: number | null): {
    contract: Contract | undefined
    notFound: boolean
    account: Account | undefined          // for assetBalances
    incoming: Transaction[] | undefined
    outgoing: Transaction[] | undefined
    slots: DataSlot[]
    changed: { indices: Set<number>; height: number | null } | null
  }
  ```

- [ ] **Step 1: The hook**

Create `src/hooks/useContractInspector.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ledger } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { changedSlots, toDataSlots, type DataSlot } from '@/lib/contractData'

/** How much of each direction the page shows, the same as the watch view. */
const RECENT = 10

/**
 * Everything the inspector shows about one contract, and what changed.
 *
 * Every key here is in STALE_ON_BLOCK, so a new block refetches all of it.
 * Most refetches answer what is already on screen, so the marker is replaced
 * only when a slot actually differs. Otherwise "changed in block N" would be
 * wiped by the next quiet block, before anyone could read it.
 */
export function useContractInspector(contractId: string, height: number | null) {
  const state = useQuery({
    queryKey: ['contractState', contractId],
    queryFn: () => ledger.contract.getContract(contractId),
    retry: false,
  })

  const found = state.isSuccess
  const account = useQuery({
    queryKey: ['account', contractId],
    queryFn: () => ledger.account.getAccount({ accountId: contractId }),
    enabled: found,
    retry: false,
  })
  const incoming = useQuery({
    queryKey: ['receivedBy', contractId],
    queryFn: () =>
      ledger.account.getAccountTransactionsToRecipient({
        recipientId: contractId,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: found,
    retry: false,
  })
  const outgoing = useQuery({
    queryKey: ['sentBy', contractId],
    queryFn: () =>
      ledger.account.getAccountTransactionsFromSender({
        senderId: contractId,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: found,
    retry: false,
  })

  const machineData = state.data?.machineData ?? ''
  const slots = useMemo(() => toDataSlots(machineData), [machineData])

  const previous = useRef<DataSlot[] | null>(null)
  const [changed, setChanged] = useState<{ indices: Set<number>; height: number | null } | null>(
    null,
  )
  useEffect(() => {
    if (!state.data) return
    const indices = changedSlots(previous.current, slots)
    previous.current = slots
    if (indices.size > 0) setChanged({ indices, height })
    // height is read, not watched: a new height with the same data is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, state.data])

  return {
    contract: state.data,
    // "Unknown at" is error code 5, the same code isUnknownAccount checks.
    notFound: state.isError && isUnknownAccount(state.error),
    account: account.data,
    incoming: incoming.data?.transactions,
    outgoing: outgoing.data?.transactions,
    slots,
    changed,
  }
}
```

The same `['account', id]`, `['sentBy', id]` and `['receivedBy', id]` keys as `WatchView` mean watching a contract and inspecting it share one cache.

- [ ] **Step 2: Move `Direction` out of `WatchView`**

Move `Direction` from `src/components/console/views/WatchView.tsx`, unchanged, into a new `src/components/console/views/Direction.tsx`. Bring along the imports it needs (`useTranslation`, `Transaction`, `summarize`, `displayName`, `Contacts`, `SandboxAccount`, `RowButton`, `useArrivals`, `cn`), and export it. Make the click optional:

```tsx
  onSelectTransaction?: (transactionId: string) => void
```

Without it, render the same content in a `<div className="w-full py-1 text-left text-[13px]">` instead of the `RowButton`, so a row that cannot open does not pretend to. Add one line to the comment saying so. In `WatchView.tsx`, import `Direction` from `./Direction` and drop the imports only it used.

Run: `bunx tsc -p tsconfig.json`
Expected: no errors. The watch view looks and behaves as before.

- [ ] **Step 3: The header**

Create `src/components/contracts/ContractHeader.tsx`. Reuse `Row` and `Holding` from `@/components/console/views/AccountFields`, `Identicon`, `Term`, `useValueFlash` and `displayName`. Content, in this order:

1. A title line: `Identicon` (24px) of `contract.atRS`, the name (bold, `--blue3`), the address (muted), and a `CopyLink` (from `@/components/console/DidLink`) of `contract.at`.
2. `Row` lines:
   - `inspector.field.description`: only when non-empty.
   - `inspector.field.creator`: `displayName(contract.creatorRS, accounts, contacts)` and the address muted behind it.
   - `inspector.field.created`: `contract.creationBlock`.
   - `inspector.field.version`: `contract.atVersion`.
   - `<Term id="codeHash" />`: `contract.machineCodeHashId` in `font-mono`.
   - `inspector.field.balance`: `Amount.fromPlanck(contract.balanceNQT).getSigna()` + ` SIGNA`, flashing with `useValueFlash`.
   - `<Term id="token">`: the holdings from `account?.assetBalances` via `Holding`, or `console.accounts.noHoldings`. This is the same block `WatchView` uses, including its one-flash-for-all-holdings signature.
   - `<Term id="activation" />`: `Amount.fromPlanck(contract.minActivation).getSigna()` + ` SIGNA`.
   - `inspector.field.status`: `t(\`inspector.status.${contractStatus(contract)}\`)`, flashing. Colour `--green` for `running`/`stopped`/`idle`, `--amber` for `frozen`, `--mag` for `finished`/`dead`. When the status is `frozen`, add `inspector.frozenHint` muted underneath.
   - `inspector.field.nextBlock`: `contract.nextBlock`.
   - `console.tx.raw`: a `↗ getAT` link to `${nodeHost}/api?requestType=getAT&at=${contract.at}`, styled like `WatchView`'s `↗ getAccount`.

Props: `{ contract: Contract; account: Account | undefined; accounts: SandboxAccount[]; contacts: Contacts }`.

- [ ] **Step 4: Wire it into the page**

In `ContractPage`, replace the placeholder for a valid id with a `ContractBody` component (in the same file, so the hooks run only for a parseable id). It:
- calls `useAccounts()`, `useContacts()` and `useContractInspector(contractId, state.height)`;
- shows `inspector.notFound` when `notFound`, and `…` while `contract` is undefined;
- otherwise renders `<ViewNote id="contract" terms={['contract', 'activation', 'codeHash']} />`, `ContractHeader`, and below it the two `Direction` lists side by side, as in `WatchView` (`console.watch.incoming` / `console.watch.outgoing`), with no `onSelectTransaction`.

Pass `accounts.accounts` and `contacts.contacts` wherever a component wants the plain lists.

- [ ] **Step 5: Typecheck, test, commit**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS.

```bash
git add -A src/hooks/useContractInspector.ts src/components/console/views/Direction.tsx src/components/console/views/WatchView.tsx src/components/contracts
git commit -m "feat: the contract page shows who made it, what it holds and whether it runs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The data stack table

**Files:**
- Create: `src/components/contracts/DataStackTable.tsx`
- Modify: `src/components/contracts/ContractPage.tsx`

**Interfaces:**
- Consumes: `DataSlot`, `KnownId`, `knownIds` (Tasks 1–2), `useContractLabels` (Task 3), `changed` from `useContractInspector` (Task 5).
- Produces: `DataStackTable({ slots, changed, labels, onLabel, known, addressPrefix })`.

- [ ] **Step 1: The table**

Create `src/components/contracts/DataStackTable.tsx` with:

- A section heading `<Term id="dataStack" />`, and `inspector.data.size` with `bytes = slots.length * 8` and `slots = slots.length` on the right.
- `inspector.data.empty` when there are no slots.
- A `<table>` in a horizontally scrolling wrapper (`overflow-x-auto`), `font-mono text-[12px]`, with columns: `index`, `label`, `raw`, `hex`, `decimal`, `signed`, `text`, `account`. Header cells use `t('inspector.data.<column>')` and the muted uppercase style the console uses for section heads.
- One `SlotRow` per slot, a component so it can call `useValueFlash(slot.raw)` on its `<tr>`:
  - **label:** an `<input>` with `defaultValue={labels[slot.index] ?? ''}` and `placeholder={t('inspector.data.labelPlaceholder')}`. It saves through `onLabel(slot.index, value)` on blur and on Enter (Enter blurs). Give it a `key` of `${codeHash}-${index}` from the parent, so a different code resets it.
  - **signed:** empty when `slot.signed` is null.
  - **text:** empty when null, otherwise in quotes.
  - **account:** `known.get(slot.decimal)`. When found, show the identicon (14px) of `toAddress(id, addressPrefix)`, the name, and for `contract: true` an `InspectLink`. Otherwise leave it empty.
  - **changed marker:** when `changed?.indices.has(slot.index)`, the row gets a left border in `--amber`, and the index cell gets a small `Δ` with `title={t('inspector.data.changed', { height: changed.height ?? '—' })}`. Also show it as text when the table is wide enough, as the reviewer prefers. The `title` is the minimum.

The comment above `SlotRow` should say why a row both flashes and keeps a marker. The flash shows the moment of change, and the marker answers "what did my last call change?" after the moment has passed.

- [ ] **Step 2: Wire it in**

In `ContractBody`:

```ts
const { labels, setLabel } = useContractLabels(contract?.machineCodeHashId ?? null)
const known = useMemo(
  () =>
    contract
      ? knownIds(accounts.accounts, contacts.contacts, [
          { id: contract.at, name: contract.name, contract: true },
          { id: contract.creator, name: displayName(contract.creatorRS, accounts.accounts, contacts.contacts), contract: false },
        ])
      : new Map(),
  [contract, accounts.accounts, contacts.contacts],
)
```

Hooks go above the early returns. Render `<ViewNote id="contractData" terms={['dataStack']} />` and the table below the header and above the activity lists. Use `addressPrefixOf(accounts.accounts)` for `addressPrefix`.

- [ ] **Step 3: Typecheck, test, commit**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS.

```bash
git add src/components/contracts
git commit -m "feat: a contract's data stack shows every slot, and which ones just changed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Maps

**Files:**
- Create: `src/components/contracts/ContractMaps.tsx`
- Modify: `src/components/contracts/ContractPage.tsx`

**Interfaces:**
- Consumes: `toAccountId` (folds a number or any spelling of an address to an id, throws otherwise), `knownIds` result, `InspectLink`.
- Produces: `ContractMaps({ contractId, known, addressPrefix })`.

- [ ] **Step 1: The component**

Create `src/components/contracts/ContractMaps.tsx`:

- Two inputs (`inspector.maps.key1`, `inspector.maps.key2`) and a `ConsoleButton` `inspector.maps.load`. Submitting with Enter works too.
- On submit, fold both through `toAccountId` (key2 only when non-empty). If either throws, show `inspector.maps.invalidKey` in `--mag` under the fields and change nothing else. Otherwise set `submitted = { key1, key2: key2 | null }`, and put key1 at the front of a `recent` list (unique, at most 5) held in component state.
- `recent` renders as small buttons under the fields, labelled `inspector.maps.recent`. Clicking one fills key1, clears key2 and submits.
- Query, enabled only once `submitted` is set:

  ```ts
  useQuery({
    queryKey: ['contractMap', contractId, submitted?.key1, submitted?.key2 ?? null],
    queryFn: () =>
      submitted!.key2 === null
        ? ledger.contract
            .getContractMapValuesByFirstKey({ contractId, key1: submitted!.key1 })
            .then((r) => r.keyValues.map(({ key2, value }) => ({ key2, value })))
        : ledger.contract
            .getSingleContractMapValue({ contractId, key1: submitted!.key1, key2: submitted!.key2 })
            .then((r) => [{ key2: submitted!.key2!, value: r.value }]),
    enabled: submitted !== null,
    retry: false,
  })
  ```

  Check the field names of `ContractMapValueList` in `node_modules/@signumjs/core/out/typings/contractMapValueList.d.ts` and adjust if they differ.
- The result is a table with `key2` and `inspector.maps.value`. Both columns use the account matching from Task 6 (`known.get(value)`), so an id shows a name, plus an `InspectLink` for a contract. Each row flashes on change (`useValueFlash(value)` in a row component). An empty list shows `inspector.maps.none`. A single-value lookup always shows `inspector.maps.zeroNote` muted under the table.

- [ ] **Step 2: Wire it in**

In `ContractBody`, render `<ViewNote id="contractMaps" terms={['contractMap']} />` and `ContractMaps`, headed by `<Term id="contractMap" />`, between the data stack and the activity lists.

- [ ] **Step 3: Typecheck, test, commit**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS.

```bash
git add src/components/contracts
git commit -m "feat: a contract's maps can be looked up by one key or both

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The ways in

**Files:**
- Modify: `src/components/console/views/ContactList.tsx`
- Modify: `src/components/console/views/WatchView.tsx`
- Modify: `src/components/console/views/TransactionRow.tsx`

**Interfaces:**
- Consumes: `InspectLink` (Task 4), `contractPartyId` (Task 2).

- [ ] **Step 1: Contacts**

In `ContactList`, inside the `ml-auto` button group of each entry, put `{c.isContract && <InspectLink contractId={c.id} />}` before the watch button.

- [ ] **Step 2: Watch**

In `WatchView`'s title line, next to "Stop watching", add `{chain?.isAT && <InspectLink contractId={accountId} />}`.

- [ ] **Step 3: Transaction rows**

In `TransactionRow`:
- Give `Party` an optional `contractId?: string | null` prop. When set, render an `InspectLink` after the name.
- Pass `contractId={contractPartyId(summary.senderRS, 'sender', summary.kind, contacts)}` to the sender `Party`, and the same with `'recipient'` to the recipient.
- When `deployedContract` is set, add a `Detail` line labelled `console.tx.contract` with the identicon, the address and `<InspectLink contractId={item.tx.transaction ?? ''} />`. Put it right after the recipient `Party`. A deployment names no recipient, so this is where the contract's line belongs. The existing "save as contact" field for it stays.

Links go only into the opened detail, never into the summary line. That line is a `RowButton`, and a link inside a button is invalid and would toggle the row.

- [ ] **Step 4: Typecheck, test, commit**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS.

```bash
git add src/components/console/views
git commit -m "feat: contacts, the watch view and transactions lead to the contract inspector

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verify against the running node

**Files:** none change unless a check fails. A fix goes into the file that owns the behaviour, with a test where the behaviour is pure.

The sandbox node must be running (`curl -s "http://localhost:6876/api?requestType=getMiningInfo"` answers JSON). Start the UI with `bun run dev` (http://localhost:5173) and drive it in the browser. The `run` skill or Claude in Chrome both work.

The local chain may hold no contract (`getATIds` answered `[]` when this plan was written). Deploy one first. Use the `signum-smartc` skill to compile a small contract with:
- a `long` counter that each incoming transaction increments,
- a `long` holding the last sender,
- a short string constant, e.g. `"hi"`,
- a `setMapValue(1, sender, counter)`.

Publish it from a sandbox account with `signingLedger.contract.publishContract` (or a one-off script against `http://localhost:6876`) and forge a block.

- [ ] **Step 1: Ways in**
  - Transactions: open the deployment row. Expected: a "Contract" line with "Inspect", and the page opens.
  - Save the contract as a contact. Expected: "Inspect" in the contact list, and in the watch view when watching it.

- [ ] **Step 2: Header and data stack**
  - Expected: name, description, creator by name, code hash, activation amount, status `waiting` or `idle`, balance.
  - The string slot reads `hi` (not `ih`). Zero slots have no text.
  - Name a slot "counter", reload, and expect the name to still be there.

- [ ] **Step 3: Live changes**
  - From the console, send the contract its activation amount, then forge. Expected without reloading: the counter and last-sender slots flash and carry the change marker with the new height. The last-sender slot shows the sender's name. The balance updates, and the call appears under "Incoming".
  - Forge an empty block. Expected: no new flash, and the markers keep their height.
  - Send less than the activation amount and forge. Expected: the balance changes but the slots do not.

- [ ] **Step 4: Maps**
  - key1 `1`. Expected: one row per sender, key2 shown as the sender's name, value = counter.
  - key1 `1` with key2 = a sender's address in lowercase without the prefix. Expected: that one value, plus the zero note.
  - key1 `abc`. Expected: "A key is a number or an address".

- [ ] **Step 5: Not found**
  - `#/contracts/123` and `#/contracts/nope`. Expected: the not-found sentence and the back link, no error dump.
  - Rewind the chain past the deployment (Chain drawer) while the page is open. Expected: the page turns into the not-found state at the next refresh.

- [ ] **Step 6: Beginner mode and languages**
  - With beginner mode on, the notes and the four new glossary terms show their help. Switch to German and one more language. Expected: no raw keys anywhere.

- [ ] **Step 7: Final run**

Run: `bun run test && bunx tsc -p tsconfig.json && bun run build`
Expected: all green. Report any check from Steps 1–6 that did not behave as expected, with what happened instead, rather than marking this task done.
