# Smart Contracts as Recipients — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A contract can be saved as a contact (with an on-chain existence check for every contact), is recognised as a contract when picked as a recipient, and can be sent SIGNA or a token together with typed arguments that the sandbox packs into the 8-byte little-endian blocks a contract reads.

**Architecture:** All encoding and decision logic lives in pure, tested functions in `src/lib/` (`contractArgs.ts`, `contacts.ts`, `recipient.ts`). Contacts change from `id → name` to `id → { name, kind }`, with the kind learned once from `getAccount(...).isAT` when the contact is added. The forms use one hook (`useContract`) and two small components (`ContractNote`, `ContractAttachment`) and know nothing about bytes.

**Tech Stack:** TypeScript 5.8, React 19, TanStack Query 5, SignumJS 3.3.4 (`@signumjs/core`, `@signumjs/contracts`, `@signumjs/util`, `@signumjs/http`), i18next across ten locales, Vitest (`environment: 'node'`, no component tests), Bun.

**Spec:** `docs/superpowers/specs/2026-10-03-smart-contracts-design.md`. Read it before starting. It holds the verified ground truth this plan relies on.

## Global Constraints

- `@signumjs/contracts` is pinned to exactly `3.3.4`, like `@signumjs/crypto`, `@signumjs/http` and `@signumjs/standards`.
- `generateMethodCall` in 3.3.4 takes `{ methodId, methodArgs }`, **not** `methodHash`.
- Integer range is −2⁶³ … 2⁶⁴−1 inclusive. Anything outside is `outOfRange`, checked before encoding, because the reference silently emits 16 bytes for oversized values.
- Short strings are limited to 8 bytes of **UTF-8**, not 8 characters.
- Contacts stay in `localStorage` under `signum-sandbox.contacts.v1`. The old shape (bare string value) is read as `{ name, kind: 'account' }`.
- `minActivation` is never stored. It is fetched with `ledger.contract.getContract(id)`.
- A recipient public key of all zeros is never announced (contracts report `"0000…0000"`).
- An amount below the activation amount warns and never blocks the send.
- Every new i18n key lands in all ten locales (`de en es hi ja ko pt ru uk zh`) in the same commit, or `src/i18n/locales/locales.test.ts` fails.
- Nothing in `src/lib/` may import `src/lib/ledger.ts` in a file that has tests. `ledger.ts` reads `window` at import time, and tests run in `node`. Inject the lookup instead.
- Commit messages follow the repo style: lowercase conventional prefix and a subject that says what is now true (e.g. `feat: a contact has to exist before it gets a name`). Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verification commands: `bun run test` (vitest) and `bunx tsc -p tsconfig.json` (typecheck, `noEmit` is set).

## Review Focus

1. **A contract typed in another spelling.** A contract saved by numeric id, then entered in "To" as a lowercase, prefix-less RS address, must still be recognised as a contract. Pinned in Task 2 (`isContract` across spellings).
2. **Switching the recipient away from a contract while "Arguments" is selected.** The send must carry the text payload (or nothing), never stale binary arguments. Pinned in Task 1 (`pickAttachment` with `toContract: false`).
3. **An address book written by the previous version.** Bare-string values must load with names intact and `kind: 'account'`, and a mixed book must load both shapes. Pinned in Task 2.
4. **Integers that look like numbers but are not plain decimals.** `" 42 "` is accepted (trimmed), and `"+5"`, `"1e3"`, `"0x10"`, `"4.2"` are `notAnInteger`. Pinned in Task 1.
5. **The node down while saving a contact from a transaction row.** Nothing is saved, and the reason is shown. Pinned in Task 2 (`resolveContact` → `unreachable` for a non-HttpError and for an HttpError with another code).

---

### Task 1: Contract argument encoding

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/lib/contractArgs.ts`
- Test: `src/lib/contractArgs.test.ts`

**Interfaces:**
- Consumes: `toComparableId(value: string): string` from `src/lib/recipient.ts` (existing).
- Produces:
  ```ts
  export type ContractArgType = 'integer' | 'address' | 'boolean' | 'shortString'
  export interface ContractArg { type: ContractArgType; value: string }   // boolean value is 'true' | 'false'
  export type ContractArgError = 'empty' | 'notAnInteger' | 'outOfRange' | 'notAnAddress' | 'tooLong'
  export type EncodedArgs = { hex: string } | { errors: Record<number, ContractArgError> }
  export type AttachmentMode = 'args' | 'text'
  export interface Attachment { message?: string; binaryMessage?: string }
  export function toContractData(arg: ContractArg): { data: string } | { error: ContractArgError }
  export function encodeContractArgs(args: ContractArg[]): EncodedArgs
  export function activationSigna(minActivationPlanck: string): string
  export function isBelowActivation(signa: string, minActivationPlanck: string): boolean
  export function pickAttachment(options: {
    attach: boolean
    toContract: boolean
    mode: AttachmentMode
    encoded: EncodedArgs
    text: string | null
  }): Attachment | null
  ```

- [ ] **Step 1: Add the dependency**

Run: `bun add @signumjs/contracts@3.3.4 --exact`
Expected: `package.json` gains `"@signumjs/contracts": "3.3.4"` under `dependencies`, and `bun.lock` changes.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/contractArgs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  activationSigna,
  encodeContractArgs,
  isBelowActivation,
  pickAttachment,
  toContractData,
  type ContractArg,
} from './contractArgs'

const int = (value: string): ContractArg => ({ type: 'integer', value })
const addr = (value: string): ContractArg => ({ type: 'address', value })
const bool = (value: 'true' | 'false'): ContractArg => ({ type: 'boolean', value })
const str = (value: string): ContractArg => ({ type: 'shortString', value })

// The contract deployed on the local sandbox chain while the spec was written;
// any valid id would do, this one has a verified encoding.
const CONTRACT_ID = '13125641130491689178'
const CONTRACT_RS = 'TS-FG8U-4565-CMY2-D7XBE'

const hexOf = (args: ContractArg[]) => {
  const result = encodeContractArgs(args)
  if (!('hex' in result)) throw new Error(`expected hex, got ${JSON.stringify(result)}`)
  return result.hex
}

describe('encodeContractArgs — one little-endian long per argument', () => {
  it('packs integers', () => {
    expect(hexOf([int('1')])).toBe('0100000000000000')
    expect(hexOf([int('42')])).toBe('2a00000000000000')
    expect(hexOf([int('-1')])).toBe('ffffffffffffffff')
    expect(hexOf([int('-9223372036854775808')])).toBe('0000000000000080')
    expect(hexOf([int('9223372036854775807')])).toBe('ffffffffffffff7f')
    expect(hexOf([int('18446744073709551615')])).toBe('ffffffffffffffff')
  })

  it('accepts surrounding whitespace on an integer', () => {
    expect(hexOf([int(' 42 ')])).toBe('2a00000000000000')
  })

  it('packs an address the same in every spelling', () => {
    const expected = 'dab836c810a527b6'
    expect(hexOf([addr(CONTRACT_ID)])).toBe(expected)
    expect(hexOf([addr(CONTRACT_RS)])).toBe(expected)
    expect(hexOf([addr('fg8u-4565-cmy2-d7xbe')])).toBe(expected)
  })

  it('packs booleans as 1 and 0', () => {
    expect(hexOf([bool('true')])).toBe('0100000000000000')
    expect(hexOf([bool('false')])).toBe('0000000000000000')
  })

  it('packs short strings as UTF-8 bytes', () => {
    expect(hexOf([str('abc')])).toBe('6162630000000000')
    expect(hexOf([str('12345678')])).toBe('3132333435363738')
    expect(hexOf([str('äöü')])).toBe('c3a4c3b6c3bc0000')
  })

  it('concatenates arguments in order', () => {
    const hex = hexOf([int('1'), bool('true'), str('abc')])
    expect(hex).toHaveLength(48)
    expect(hex).toBe('0100000000000000' + '0100000000000000' + '6162630000000000')
  })

  it('encodes nothing for no arguments', () => {
    expect(encodeContractArgs([])).toEqual({ hex: '' })
  })

  it('reports every bad row by index and encodes nothing', () => {
    expect(encodeContractArgs([int('1'), int('x'), str('123456789')])).toEqual({
      errors: { 1: 'notAnInteger', 2: 'tooLong' },
    })
  })
})

describe('toContractData — what cannot be one long', () => {
  it('rejects integers outside -2^63 … 2^64-1', () => {
    expect(toContractData(int('18446744073709551616'))).toEqual({ error: 'outOfRange' })
    expect(toContractData(int('-9223372036854775809'))).toEqual({ error: 'outOfRange' })
  })

  it('rejects anything that is not a plain decimal integer', () => {
    for (const value of ['+5', '1e3', '0x10', '4.2', '--1', 'abc']) {
      expect(toContractData(int(value)), value).toEqual({ error: 'notAnInteger' })
    }
  })

  it('rejects empty values, except for booleans', () => {
    expect(toContractData(int('  '))).toEqual({ error: 'empty' })
    expect(toContractData(addr(''))).toEqual({ error: 'empty' })
    expect(toContractData(str(''))).toEqual({ error: 'empty' })
  })

  it('rejects what is not an address', () => {
    expect(toContractData(addr('TS-NOPE'))).toEqual({ error: 'notAnAddress' })
    expect(toContractData(addr('-5'))).toEqual({ error: 'notAnAddress' })
    expect(toContractData(addr('18446744073709551616'))).toEqual({ error: 'notAnAddress' })
  })

  it('counts short-string length in UTF-8 bytes, not characters', () => {
    expect(toContractData(str('123456789'))).toEqual({ error: 'tooLong' })
    // five characters, ten bytes
    expect(toContractData(str('äöüäö'))).toEqual({ error: 'tooLong' })
  })

  it('keeps spaces inside a short string', () => {
    expect(hexOf([str(' a ')])).toBe('2061200000000000')
  })
})

describe('activation amount', () => {
  it('converts planck to SIGNA', () => {
    expect(activationSigna('40000000')).toBe('0.4')
  })

  it('warns only below the minimum', () => {
    expect(isBelowActivation('0.3', '40000000')).toBe(true)
    expect(isBelowActivation('0.4', '40000000')).toBe(false)
    expect(isBelowActivation('5', '40000000')).toBe(false)
  })

  it('does not warn about an amount that is not a number yet', () => {
    expect(isBelowActivation('', '40000000')).toBe(false)
    expect(isBelowActivation('abc', '40000000')).toBe(false)
  })
})

describe('pickAttachment', () => {
  const base = {
    attach: true,
    toContract: true,
    mode: 'args' as const,
    encoded: { hex: '0100000000000000' },
    text: 'hello',
  }

  it('attaches nothing when the toggle is off', () => {
    expect(pickAttachment({ ...base, attach: false })).toEqual({})
  })

  it('sends arguments as binary for a contract', () => {
    expect(pickAttachment(base)).toEqual({ binaryMessage: '0100000000000000' })
  })

  it('sends no attachment for an empty argument list', () => {
    expect(pickAttachment({ ...base, encoded: { hex: '' } })).toEqual({})
  })

  it('blocks the send while arguments are invalid', () => {
    expect(pickAttachment({ ...base, encoded: { errors: { 0: 'empty' } } })).toBeNull()
  })

  it('sends text for a contract in text mode', () => {
    expect(pickAttachment({ ...base, mode: 'text' })).toEqual({ message: 'hello' })
  })

  it('ignores argument mode once the recipient is no longer a contract', () => {
    expect(pickAttachment({ ...base, toContract: false })).toEqual({ message: 'hello' })
  })

  it('blocks the send while the text payload is invalid', () => {
    expect(pickAttachment({ ...base, mode: 'text', text: null })).toBeNull()
  })

  it('attaches nothing for empty text', () => {
    expect(pickAttachment({ ...base, mode: 'text', text: '' })).toEqual({})
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test src/lib/contractArgs.test.ts`
Expected: FAIL, `Failed to resolve import "./contractArgs"`.

- [ ] **Step 4: Implement**

Create `src/lib/contractArgs.ts`:

```ts
import { convertShortStringToContractData, generateMethodCall } from '@signumjs/contracts'
import { Amount } from '@signumjs/util'
import { toComparableId } from './recipient'

/**
 * What a person can type into one argument row. Each one becomes exactly one
 * 8-byte block, the unit a contract reads its message in.
 */
export type ContractArgType = 'integer' | 'address' | 'boolean' | 'shortString'

/** A boolean's value is the string 'true' or 'false', so every row is text. */
export interface ContractArg {
  type: ContractArgType
  value: string
}

export type ContractArgError = 'empty' | 'notAnInteger' | 'outOfRange' | 'notAnAddress' | 'tooLong'

export type EncodedArgs = { hex: string } | { errors: Record<number, ContractArgError> }

/**
 * A long is read signed or unsigned depending on the contract, so both
 * halves of the range are accepted: -2^63 for the signed floor, 2^64-1 for an
 * unsigned id. The reference encoder checks neither — 2^64 comes out as 16
 * bytes and shifts every argument after it — so the check has to be here.
 */
const MIN_LONG = -(2n ** 63n)
const MAX_ULONG = 2n ** 64n - 1n

const SHORT_STRING_BYTES = 8

/**
 * One argument as the decimal string generateMethodCall expects, or why it
 * cannot be one. A short string is not trimmed — a space is a byte a
 * contract may well compare against — but every other kind is.
 */
export function toContractData(arg: ContractArg): { data: string } | { error: ContractArgError } {
  if (arg.type === 'boolean') return { data: arg.value === 'true' ? '1' : '0' }

  if (arg.type === 'shortString') {
    if (arg.value === '') return { error: 'empty' }
    // convertShortStringToContractData counts characters; a contract counts bytes.
    if (new TextEncoder().encode(arg.value).length > SHORT_STRING_BYTES) return { error: 'tooLong' }
    return { data: convertShortStringToContractData(arg.value) as string }
  }

  const value = arg.value.trim()
  if (value === '') return { error: 'empty' }

  if (arg.type === 'integer') {
    if (!/^-?\d+$/.test(value)) return { error: 'notAnInteger' }
    const n = BigInt(value)
    if (n < MIN_LONG || n > MAX_ULONG) return { error: 'outOfRange' }
    return { data: n.toString() }
  }

  // toComparableId hands back its input when it cannot parse it, so anything
  // that is still not a plain non-negative number afterwards was no address.
  const id = toComparableId(value)
  if (!/^\d+$/.test(id) || BigInt(id) > MAX_ULONG) return { error: 'notAnAddress' }
  return { data: id }
}

/**
 * The whole argument list as the hex a contract reads, or one error per bad
 * row. Packing goes through generateMethodCall, the ecosystem's reference for
 * byte order: it is nothing but "each value to 8 little-endian bytes,
 * concatenated", so the first argument rides in as methodId.
 */
export function encodeContractArgs(args: ContractArg[]): EncodedArgs {
  const errors: Record<number, ContractArgError> = {}
  const data: string[] = []
  args.forEach((arg, index) => {
    const result = toContractData(arg)
    if ('error' in result) errors[index] = result.error
    else data.push(result.data)
  })
  if (Object.keys(errors).length > 0) return { errors }
  if (data.length === 0) return { hex: '' }
  return { hex: generateMethodCall({ methodId: data[0], methodArgs: data.slice(1) }) }
}

export function activationSigna(minActivationPlanck: string): string {
  return Amount.fromPlanck(minActivationPlanck).getSigna()
}

/**
 * Whether an amount would reach the contract without running it. An amount
 * that is not a number yet is not "below" anything — the field is still
 * being typed, and the form says nothing until it means something.
 */
export function isBelowActivation(signa: string, minActivationPlanck: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(signa.trim())) return false
  try {
    return BigInt(Amount.fromSigna(signa.trim()).getPlanck()) < BigInt(minActivationPlanck)
  } catch {
    return false
  }
}

export type AttachmentMode = 'args' | 'text'

export interface Attachment {
  message?: string
  binaryMessage?: string
}

/**
 * What a form puts on chain beside its amount, or null while the chosen
 * payload is invalid and the send has to wait. Argument mode only counts for
 * a contract: a person who picked a contract, chose arguments, then picked
 * an ordinary account must not send the contract's bytes to it.
 */
export function pickAttachment({
  attach,
  toContract,
  mode,
  encoded,
  text,
}: {
  attach: boolean
  toContract: boolean
  mode: AttachmentMode
  encoded: EncodedArgs
  text: string | null
}): Attachment | null {
  if (!attach) return {}
  if (toContract && mode === 'args') {
    if ('errors' in encoded) return null
    return encoded.hex === '' ? {} : { binaryMessage: encoded.hex }
  }
  if (text === null) return null
  return text === '' ? {} : { message: text }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/lib/contractArgs.test.ts`
Expected: PASS, all tests.

If `' a '` does not produce `2061200000000000`, print the actual value with a one-off `console.log` and check by hand: `0x20 0x61 0x20` followed by five zero bytes is the correct little-endian packing. Fix the test only if the printed bytes are exactly that.

- [ ] **Step 6: Typecheck and commit**

Run: `bunx tsc -p tsconfig.json`
Expected: no output.

```bash
git add package.json bun.lock src/lib/contractArgs.ts src/lib/contractArgs.test.ts
git commit -m "feat: ordinary values become the longs a contract reads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Contacts know what they are, and have to exist

**Files:**
- Modify: `src/lib/contacts.ts`
- Modify: `src/lib/contacts.test.ts`
- Modify: `src/lib/search.ts:55-66` (`localNameMatches`)
- Modify: `src/hooks/useContacts.ts`
- Modify: `src/components/console/drawers/forms/fields.tsx:20-46` (`KnownRecipient`, `knownRecipients`) and `RecipientPicker`
- Modify: `src/components/console/views/ContactList.tsx`
- Modify: `src/components/console/views/TransactionRow.tsx:32-65` (`SaveContactField`) and the `onAddContact` prop type at `:172`
- Modify: `src/components/console/views/TransactionsView.tsx:24` (`onAddContact` prop type)
- Modify: all ten `src/i18n/locales/*.ts` (`console.accounts`)

**Interfaces:**
- Consumes: `toComparableId` (`src/lib/recipient.ts`), `isUnknownAccount(error: unknown): boolean` (`src/lib/accountStatus.ts`, existing), `ledger.account.getAccount({ accountId })` (`src/lib/ledger.ts`, only from the hook).
- Produces:
  ```ts
  // src/lib/contacts.ts
  export type ContactKind = 'account' | 'contract'
  export interface Contact { name: string; kind: ContactKind }
  export type Contacts = Record<string, Contact>
  export function addContact(contacts: Contacts, accountIdOrAddress: string, contact: Contact): Contacts
  export function removeContact(contacts: Contacts, accountIdOrAddress: string): Contacts   // unchanged
  export function isContract(contacts: Contacts, accountIdOrAddress: string): boolean
  export type ResolveContactError = 'invalidAddress' | 'unknownAccount' | 'unreachable'
  export type AccountLookup = (accountId: string) => Promise<{ isAT?: boolean }>
  export function resolveContact(accountIdOrAddress: string, lookup: AccountLookup):
    Promise<{ id: string; kind: ContactKind } | { error: ResolveContactError }>
  // src/hooks/useContacts.ts
  export interface ContactStore {
    contacts: Contacts
    add: (accountIdOrAddress: string, name: string) => Promise<ResolveContactError | null>
    remove: (accountIdOrAddress: string) => void
  }
  // src/components/console/drawers/forms/fields.tsx
  export interface KnownRecipient { id: string; address: string; name: string; isContract: boolean }
  ```
- i18n keys added under `console.accounts`: `contractTag`, `checking`, `contactError.invalidAddress`, `contactError.unknownAccount`, `contactError.unreachable`.

- [ ] **Step 1: Rewrite the contact tests for the new shape and add the new cases**

In `src/lib/contacts.test.ts`:

1. Change the import block to:

```ts
import { HttpError } from '@signumjs/http'
import {
  addContact,
  displayName,
  isContract,
  parseContacts,
  removeContact,
  resolveContact,
  serializeContacts,
  type Contact,
  type Contacts,
} from './contacts'
```

2. Below `const bob = …` add:

```ts
const named = (name: string, kind: Contact['kind'] = 'account'): Contact => ({ name, kind })
```

3. Mechanically update the existing tests to the new shape:
   - every `addContact(x, y, 'Name')` → `addContact(x, y, named('Name'))`
   - every `expect(contacts[bob.id]).toBe('Name')` → `expect(contacts[bob.id]).toEqual(named('Name'))` (same for `second`, `byAddress`)
   - `toEqual({ [alice.id]: 'Alice' })` → `toEqual({ [alice.id]: named('Alice') })`
   - in the `parseContacts` tests at lines ~90 and ~95, `toEqual({ [bob.id]: 'Bob' })` → `toEqual({ [bob.id]: named('Bob') })`. Their raw input strings stay as they are: they are old-format books and are now the migration tests.

4. Append:

```ts
describe('parseContacts — both shapes', () => {
  it('reads a book written by the previous version as accounts', () => {
    const raw = JSON.stringify({ [bob.id]: 'Bob', [alice.id]: 'Alice' })
    expect(parseContacts(raw)).toEqual({ [bob.id]: named('Bob'), [alice.id]: named('Alice') })
  })

  it('reads the new shape, contracts included', () => {
    const raw = JSON.stringify({ [bob.id]: { name: 'Vault', kind: 'contract' } })
    expect(parseContacts(raw)).toEqual({ [bob.id]: named('Vault', 'contract') })
  })

  it('reads a book that mixes both shapes', () => {
    const raw = JSON.stringify({ [bob.id]: 'Bob', [alice.id]: { name: 'Vault', kind: 'contract' } })
    expect(parseContacts(raw)).toEqual({
      [bob.id]: named('Bob'),
      [alice.id]: named('Vault', 'contract'),
    })
  })

  it('drops entries that are neither shape', () => {
    const raw = JSON.stringify({
      [bob.id]: { name: 'Bob', kind: 'robot' },
      [alice.id]: { name: '', kind: 'account' },
      '42': { kind: 'account' },
      '43': 7,
    })
    expect(parseContacts(raw)).toEqual({})
  })
})

describe('isContract', () => {
  const book = addContact(addContact({}, bob.id, named('Vault', 'contract')), alice.id, named('Alice'))
  const [, ...groups] = bob.address.split('-')

  it('recognises a contract in every spelling', () => {
    expect(isContract(book, bob.id)).toBe(true)
    expect(isContract(book, bob.address)).toBe(true)
    expect(isContract(book, bob.address.toLowerCase())).toBe(true)
    expect(isContract(book, groups.join('-').toLowerCase())).toBe(true)
    expect(isContract(book, ` ${bob.address} `)).toBe(true)
  })

  it('is false for accounts, strangers and junk', () => {
    expect(isContract(book, alice.id)).toBe(false)
    expect(isContract(book, '123')).toBe(false)
    expect(isContract(book, '')).toBe(false)
  })
})

describe('displayName — with the new shape', () => {
  it('uses the contact name of a contract', () => {
    const book = addContact({}, bob.id, named('Vault', 'contract'))
    expect(displayName(bob.id, [], book)).toBe('Vault')
  })
})

describe('resolveContact', () => {
  const unknown = () =>
    Promise.reject(new HttpError('http://node/api', 400, 'Unknown account', { errorCode: 5 }))

  it('finds an ordinary account', async () => {
    const result = await resolveContact(bob.address, async () => ({ isAT: false }))
    expect(result).toEqual({ id: bob.id, kind: 'account' })
  })

  it('finds a contract', async () => {
    const result = await resolveContact(bob.id, async () => ({ isAT: true }))
    expect(result).toEqual({ id: bob.id, kind: 'contract' })
  })

  it('asks the node with the numeric id, whatever was typed', async () => {
    let asked = ''
    await resolveContact(` ${bob.address.toLowerCase()} `, async (id) => {
      asked = id
      return {}
    })
    expect(asked).toBe(bob.id)
  })

  it('treats a missing isAT as an ordinary account', async () => {
    expect(await resolveContact(bob.id, async () => ({}))).toEqual({ id: bob.id, kind: 'account' })
  })

  it('refuses what is not an address without asking the node', async () => {
    let asked = false
    const result = await resolveContact('TS-NOPE', async () => {
      asked = true
      return {}
    })
    expect(result).toEqual({ error: 'invalidAddress' })
    expect(asked).toBe(false)
  })

  it('refuses an address the chain has never seen', async () => {
    expect(await resolveContact(bob.id, unknown)).toEqual({ error: 'unknownAccount' })
  })

  it('says the node could not be asked when the request itself failed', async () => {
    expect(
      await resolveContact(bob.id, () => Promise.reject(new TypeError('Failed to fetch'))),
    ).toEqual({ error: 'unreachable' })
    expect(
      await resolveContact(bob.id, () =>
        Promise.reject(new HttpError('http://node/api', 500, 'boom', { errorCode: 1 })),
      ),
    ).toEqual({ error: 'unreachable' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/contacts.test.ts`
Expected: FAIL. `isContract` and `resolveContact` are not exported, and the `toEqual(named(…))` assertions fail against strings.

- [ ] **Step 3: Implement the model in `src/lib/contacts.ts`**

Replace the top of the file down to and including `parseContacts` with:

```ts
import { toComparableId } from './recipient'
import { isUnknownAccount } from './accountStatus'
import type { SandboxAccount } from './accounts'

export type ContactKind = 'account' | 'contract'

/**
 * A name for an account the sandbox does not own, and what kind of account
 * it is. The kind is learned once, when the contact is added, from the
 * node's own `isAT` — an id that is a contract stays one — so it is safe to
 * keep rather than ask for on every send.
 */
export interface Contact {
  name: string
  kind: ContactKind
}

/**
 * A local address book, keyed by numeric account id — the same id
 * SandboxAccount.id and every on-chain reference use. A map rather than a
 * list because the only thing every consumer does with it is "what's the
 * name for this id?" on every row of a transaction stream; a list would make
 * that a linear scan per row.
 */
export type Contacts = Record<string, Contact>

/** Adding a contact for an id that already has one replaces it rather than duplicating it. */
export function addContact(
  contacts: Contacts,
  accountIdOrAddress: string,
  contact: Contact,
): Contacts {
  return { ...contacts, [toComparableId(accountIdOrAddress)]: contact }
}

export function removeContact(contacts: Contacts, accountIdOrAddress: string): Contacts {
  const next = { ...contacts }
  delete next[toComparableId(accountIdOrAddress)]
  return next
}

/**
 * Whether a "To" field holds a contract from the book, in whichever spelling
 * it was typed — the same folding knownPublicKey uses.
 */
export function isContract(contacts: Contacts, accountIdOrAddress: string): boolean {
  const value = accountIdOrAddress.trim()
  if (value === '') return false
  return contacts[toComparableId(value)]?.kind === 'contract'
}

export type ResolveContactError = 'invalidAddress' | 'unknownAccount' | 'unreachable'

/** `getAccount`, injected so this file stays free of the browser-only ledger. */
export type AccountLookup = (accountId: string) => Promise<{ isAT?: boolean }>

/**
 * What an address is, before it gets a name: a contact has to be something
 * the chain knows. One getAccount answers both questions — an unknown id is
 * error code 5, a contract comes back with `isAT: true` — so no separate
 * contract lookup is needed here. Anything other than "unknown" is the node
 * failing to answer, and nothing is saved on a guess.
 */
export async function resolveContact(
  accountIdOrAddress: string,
  lookup: AccountLookup,
): Promise<{ id: string; kind: ContactKind } | { error: ResolveContactError }> {
  const id = toComparableId(accountIdOrAddress.trim())
  if (!/^\d+$/.test(id)) return { error: 'invalidAddress' }
  try {
    const account = await lookup(id)
    return { id, kind: account.isAT ? 'contract' : 'account' }
  } catch (error) {
    return { error: isUnknownAccount(error) ? 'unknownAccount' : 'unreachable' }
  }
}

export function serializeContacts(contacts: Contacts): string {
  return JSON.stringify(contacts)
}

const isKind = (v: unknown): v is ContactKind => v === 'account' || v === 'contract'

/**
 * Storage written by an older version, by hand, or by another app must never
 * crash the console. A malformed document yields an empty book; a malformed
 * entry within an otherwise-good document is dropped rather than sinking the
 * rest, the same tolerance parseAccounts gives its own entries. Keys are
 * re-normalised on the way in too, so a book saved under an older key shape
 * (or edited by hand as a Reed-Solomon address) still resolves by numeric id.
 *
 * Two value shapes are read. The previous version stored a bare name; that
 * is an account, since the sandbox had no notion of contracts then. The
 * storage key did not change, because a reader that understands both is
 * cheaper than a key bump that orphans every existing book.
 */
export function parseContacts(raw: string | null): Contacts {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

    const contacts: Contacts = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        if (value.length > 0) contacts[toComparableId(key)] = { name: value, kind: 'account' }
        continue
      }
      if (typeof value !== 'object' || value === null) continue
      const { name, kind } = value as Record<string, unknown>
      if (typeof name !== 'string' || name.length === 0 || !isKind(kind)) continue
      contacts[toComparableId(key)] = { name, kind }
    }
    return contacts
  } catch {
    return {}
  }
}
```

In `displayName`, replace:

```ts
  const contactName = contacts[id]
  if (contactName) return contactName
```

with:

```ts
  const contactName = contacts[id]?.name
  if (contactName) return contactName
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/contacts.test.ts`
Expected: PASS.

- [ ] **Step 5: Follow the shape change through the consumers**

`src/lib/search.ts`, in `localNameMatches`:

```ts
      ...Object.entries(contacts)
        .filter(([, contact]) => contact.name.toLowerCase().includes(needle))
        .map(([id]) => id),
```

`src/components/console/drawers/forms/fields.tsx`. Change `KnownRecipient` and `knownRecipients`:

```ts
export interface KnownRecipient {
  id: string
  address: string
  name: string
  isContract: boolean
}
```

```ts
  const owned = accounts.map((a) => ({ id: a.id, address: a.address, name: a.name, isContract: false }))
  const fromContacts = Object.entries(contacts)
    .filter(([id]) => !seen.has(id))
    .map(([id, contact]) => ({
      id,
      address: toAddress(id, prefix),
      name: contact.name,
      isContract: contact.kind === 'contract',
    }))
```

In `RecipientPicker`, add `const { t } = useTranslation()` as the first line of the body (`useTranslation` is already imported in this file), and change the suggestion mapping to:

```tsx
      suggestions={knownRecipients(accounts, contacts).map((p) => ({
        value: p.address,
        label: p.name,
        sublabel: p.isContract ? `${p.address} · ${t('console.accounts.contractTag')}` : p.address,
        icon: <Identicon value={p.address} size={14} />,
      }))}
```

`src/hooks/useContacts.ts`. Replace the whole file with:

```ts
import { useCallback, useEffect, useState } from 'react'
import {
  addContact,
  parseContacts,
  removeContact,
  resolveContact,
  serializeContacts,
  type Contacts,
  type ResolveContactError,
} from '@/lib/contacts'
import { ledger } from '@/lib/ledger'

const STORAGE_KEY = 'signum-sandbox.contacts.v1'

export interface ContactStore {
  contacts: Contacts
  /** Resolves to null once saved, or to why it was not. */
  add: (accountIdOrAddress: string, name: string) => Promise<ResolveContactError | null>
  remove: (accountIdOrAddress: string) => void
}

const lookupAccount = (accountId: string) => ledger.account.getAccount({ accountId })

/**
 * Unlike useAccounts, this does not gate on isMockNetwork. That check exists
 * because accounts carry a passphrase that is only safe to hold in plain
 * localStorage while the chain behind it is throwaway. A contact is just a
 * name for a numeric id, which is the same id on every network — so the
 * book stays useful (and harmless) however the node is connected, and there
 * is nothing here worth refusing to load.
 *
 * Adding asks the node first, so a write lands after an await. It goes
 * through a functional update for that reason: the book captured when the
 * button was pressed may no longer be the book by the time the node answers.
 */
export function useContacts(): ContactStore {
  const [contacts, setContacts] = useState<Contacts>({})

  useEffect(() => {
    setContacts(parseContacts(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const update = useCallback((change: (previous: Contacts) => Contacts) => {
    setContacts((previous) => {
      const next = change(previous)
      window.localStorage.setItem(STORAGE_KEY, serializeContacts(next))
      return next
    })
  }, [])

  return {
    contacts,
    add: async (accountIdOrAddress, name) => {
      const resolved = await resolveContact(accountIdOrAddress, lookupAccount)
      if ('error' in resolved) return resolved.error
      update((previous) => addContact(previous, resolved.id, { name, kind: resolved.kind }))
      return null
    },
    remove: (accountIdOrAddress) => update((previous) => removeContact(previous, accountIdOrAddress)),
  }
}
```

- [ ] **Step 6: The add flows show progress and refusals**

`src/components/console/views/ContactList.tsx`:

- Add imports: `import type { ResolveContactError } from '@/lib/contacts'` (merge into the existing `Contacts` type import).
- Change the prop type: `onAdd: (accountIdOrAddress: string, name: string) => Promise<ResolveContactError | null>`.
- Add state below `name`:

```ts
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ResolveContactError | null>(null)
```

- Change `entries` to carry the contact:

```ts
  const entries = Object.entries(contacts)
    .map(([id, contact]) => ({
      id,
      name: contact.name,
      isContract: contact.kind === 'contract',
      address: toAddress(id, addressPrefix),
    }))
    .filter((c) => matchesAccountQuery(c.name, c.address, query))
```

- Replace the add button and add an error line directly after the closing `</div>` of the input row:

```tsx
        <ConsoleButton
          disabled={busy}
          onClick={async () => {
            if (!address.trim() || !name.trim()) return
            setBusy(true)
            setError(null)
            const refused = await onAdd(address.trim(), name.trim())
            setBusy(false)
            if (refused) {
              setError(refused)
              return
            }
            setAddress('')
            setName('')
          }}
        >
          {busy ? t('console.accounts.checking') : t('console.accounts.addContact')}
        </ConsoleButton>
      </div>
      {error && (
        <p className="-mt-2 mb-3 text-[12px]" style={{ color: 'var(--mag)' }}>
          ✕ {t(`console.accounts.contactError.${error}`)}
        </p>
      )}
```

- After `<span className="font-bold text-[var(--fg)]">{c.name}</span>` add:

```tsx
            {c.isContract && (
              <span
                className="border px-1 text-[10px] uppercase tracking-[1px]"
                style={{ borderColor: 'var(--blue3)', color: 'var(--blue3)' }}
              >
                {t('console.accounts.contractTag')}
              </span>
            )}
```

  The tag gets its glossary popover in Task 4, Step 5. `<Term id="contract">` does not type-check until Task 4 adds `'contract'` to `GLOSSARY_TERMS`.

`src/components/console/views/TransactionRow.tsx`, in `SaveContactField`:

- Prop type: `onSave: (accountIdOrAddress: string, name: string) => Promise<ResolveContactError | null>`, and import `type ResolveContactError` from `@/lib/contacts` alongside the existing `displayName, type Contacts`.
- State: add `const [busy, setBusy] = useState(false)` and `const [error, setError] = useState<ResolveContactError | null>(null)`.
- Button:

```tsx
      <ConsoleButton
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          const refused = await onSave(address, name.trim())
          setBusy(false)
          if (refused) {
            setError(refused)
            return
          }
          setName('')
        }}
      >
        {busy ? t('console.accounts.checking') : t('console.tx.saveContact')}
      </ConsoleButton>
      {error && (
        <span className="text-[12px]" style={{ color: 'var(--mag)' }}>
          ✕ {t(`console.accounts.contactError.${error}`)}
        </span>
      )}
```

- The `onAddContact` prop type at `TransactionRow.tsx:172` and `TransactionsView.tsx:24` becomes `(accountIdOrAddress: string, name: string) => Promise<ResolveContactError | null>`. Import the type in `TransactionsView.tsx` from `@/lib/contacts`.

- [ ] **Step 7: Add the strings to all ten locales**

In each `src/i18n/locales/<lang>.ts`, inside `console.accounts` directly after `noContacts`, add the block for that language:

```ts
// en
      contractTag: 'contract',
      checking: 'Checking…',
      contactError: {
        invalidAddress: 'Not a valid address or account id',
        unknownAccount: 'This address does not exist on the chain yet',
        unreachable: 'Could not ask the node — nothing was saved',
      },
// de
      contractTag: 'Kontrakt',
      checking: 'Prüfe…',
      contactError: {
        invalidAddress: 'Keine gültige Adresse oder Account-ID',
        unknownAccount: 'Diese Adresse existiert noch nicht auf der Chain',
        unreachable: 'Der Node war nicht erreichbar — nichts gespeichert',
      },
// es
      contractTag: 'contrato',
      checking: 'Comprobando…',
      contactError: {
        invalidAddress: 'No es una dirección ni un id de cuenta válidos',
        unknownAccount: 'Esta dirección aún no existe en la cadena',
        unreachable: 'No se pudo consultar al nodo — no se guardó nada',
      },
// pt
      contractTag: 'contrato',
      checking: 'A verificar…',
      contactError: {
        invalidAddress: 'Não é um endereço nem um id de conta válido',
        unknownAccount: 'Este endereço ainda não existe na cadeia',
        unreachable: 'Não foi possível consultar o nó — nada foi guardado',
      },
// ru
      contractTag: 'контракт',
      checking: 'Проверка…',
      contactError: {
        invalidAddress: 'Это не адрес и не id аккаунта',
        unknownAccount: 'Этого адреса ещё нет в цепочке',
        unreachable: 'Не удалось обратиться к узлу — ничего не сохранено',
      },
// uk
      contractTag: 'контракт',
      checking: 'Перевірка…',
      contactError: {
        invalidAddress: 'Це не адреса і не id акаунта',
        unknownAccount: 'Цієї адреси ще немає в ланцюжку',
        unreachable: 'Не вдалося звернутися до вузла — нічого не збережено',
      },
// ja
      contractTag: 'コントラクト',
      checking: '確認中…',
      contactError: {
        invalidAddress: '有効なアドレスまたはアカウント ID ではありません',
        unknownAccount: 'このアドレスはまだチェーン上に存在しません',
        unreachable: 'ノードに問い合わせできませんでした — 何も保存していません',
      },
// ko
      contractTag: '컨트랙트',
      checking: '확인 중…',
      contactError: {
        invalidAddress: '유효한 주소나 계정 ID가 아닙니다',
        unknownAccount: '이 주소는 아직 체인에 없습니다',
        unreachable: '노드에 물어볼 수 없었습니다 — 아무것도 저장하지 않았습니다',
      },
// zh
      contractTag: '合约',
      checking: '检查中…',
      contactError: {
        invalidAddress: '不是有效的地址或账户 ID',
        unknownAccount: '该地址尚未出现在链上',
        unreachable: '无法询问节点——未保存任何内容',
      },
// hi
      contractTag: 'कॉन्ट्रैक्ट',
      checking: 'जाँच हो रही है…',
      contactError: {
        invalidAddress: 'यह मान्य पता या खाता आईडी नहीं है',
        unknownAccount: 'यह पता अभी चेन पर मौजूद नहीं है',
        unreachable: 'नोड से पूछा नहीं जा सका — कुछ भी सहेजा नहीं गया',
      },
```

- [ ] **Step 8: Run everything**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: all tests pass, including `locales.test.ts`. No type errors. If `tsc` reports another place that reads a contact as a string, apply the same change there (`contact.name`). `TransactionRow.isKnownParty`'s `Boolean(contacts[id])` stays correct as it is.

- [ ] **Step 9: Commit**

```bash
git add src/lib/contacts.ts src/lib/contacts.test.ts src/lib/search.ts src/hooks/useContacts.ts \
  src/components/console/drawers/forms/fields.tsx src/components/console/views/ContactList.tsx \
  src/components/console/views/TransactionRow.tsx src/components/console/views/TransactionsView.tsx \
  src/i18n/locales
git commit -m "feat: a contact has to exist before it gets a name, and knows if it is a contract

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sending binary arguments, SIGNA with tokens, and no zero keys

**Files:**
- Modify: `src/lib/recipient.ts` (new `isAnnounceableKey`)
- Modify: `src/lib/recipient.test.ts`
- Modify: `src/lib/send.ts` (`resolveRecipientPublicKey`, `PaymentArgs`/`sendPayment`, `TransferTokenArgs`/`transferToken`)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  // src/lib/recipient.ts
  export function isAnnounceableKey(publicKey: string | undefined): publicKey is string
  // src/lib/send.ts
  export interface PaymentArgs extends Fee {
    from: SandboxAccount; to: string; signa: string; recipientPublicKey: string | undefined
    message?: string
    /** Hex, sent with messageIsText: false. Mutually exclusive with message. */
    binaryMessage?: string
  }
  export interface TransferTokenArgs extends Fee {
    from: SandboxAccount; to: string; assetId: string; quantity: string
    recipientPublicKey: string | undefined
    message?: string
    binaryMessage?: string
    /** SIGNA sent alongside the token, e.g. a contract's activation amount. */
    signa?: string
  }
  ```

- [ ] **Step 1: Write the failing test**

Append to `src/lib/recipient.test.ts` (and add `isAnnounceableKey` to its import from `./recipient`):

```ts
describe('isAnnounceableKey', () => {
  it('accepts a real public key', () => {
    expect(isAnnounceableKey(generateSignKeys('sandbox-bob').publicKey)).toBe(true)
  })

  it('refuses the all-zero key a contract reports', () => {
    expect(isAnnounceableKey('0'.repeat(64))).toBe(false)
  })

  it('refuses nothing at all', () => {
    expect(isAnnounceableKey(undefined)).toBe(false)
    expect(isAnnounceableKey('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/lib/recipient.test.ts`
Expected: FAIL, `isAnnounceableKey is not a function` (or an import error).

- [ ] **Step 3: Implement**

Append to `src/lib/recipient.ts`:

```ts
/**
 * Whether a public key is one a sender can announce. The node answers a
 * contract's getAccount with a key of 64 zeros — a contract has no key pair —
 * and announcing that as the recipient's key would be claiming one it does
 * not have.
 */
export function isAnnounceableKey(publicKey: string | undefined): publicKey is string {
  return Boolean(publicKey) && !/^0+$/.test(publicKey as string)
}
```

In `src/lib/send.ts`, import it (`import { isAnnounceableKey, knownPublicKey } from './recipient'`). In `resolveRecipientPublicKey`, replace `return account.publicKey || undefined` with:

```ts
    return isAnnounceableKey(account.publicKey) ? account.publicKey : undefined
```

Add a helper above `PaymentArgs`:

```ts
/**
 * A message beside an amount: text a person wrote, or the hex a contract
 * reads as 8-byte blocks. Never both — a transaction carries one message.
 */
const attachmentOf = (message?: string, binaryMessage?: string) =>
  binaryMessage
    ? new AttachmentMessage({ message: binaryMessage, messageIsText: false })
    : message
      ? new AttachmentMessage({ message, messageIsText: true })
      : undefined
```

Change `PaymentArgs` and `sendPayment`:

```ts
export interface PaymentArgs extends Fee {
  from: SandboxAccount
  to: string
  signa: string
  recipientPublicKey: string | undefined
  message?: string
  /** Hex, sent with messageIsText: false. Mutually exclusive with message. */
  binaryMessage?: string
}

export async function sendPayment({
  from,
  to,
  signa,
  recipientPublicKey,
  message,
  binaryMessage,
  fee,
}: PaymentArgs) {
  return asId(
    await signingLedger.transaction.sendAmountToSingleRecipient({
      ...base(from, 'payment', fee),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      recipientPublicKey,
      attachment: attachmentOf(message, binaryMessage),
    }),
  )
}
```

Change `TransferTokenArgs` and `transferToken`:

```ts
export interface TransferTokenArgs extends Fee {
  from: SandboxAccount
  to: string
  assetId: string
  quantity: string
  recipientPublicKey: string | undefined
  message?: string
  binaryMessage?: string
  /** SIGNA sent alongside the token — what wakes a contract that receives it. */
  signa?: string
}

export async function transferToken({
  from,
  to,
  assetId,
  quantity,
  recipientPublicKey,
  message,
  binaryMessage,
  signa,
  fee,
}: TransferTokenArgs) {
  return asId(
    await signingLedger.asset.transferAsset({
      ...base(from, 'transferAsset', fee),
      assetId,
      quantity,
      amountPlanck: signa ? Amount.fromSigna(signa).getPlanck() : undefined,
      recipientId: toNumericId(to),
      recipientPublicKey,
      attachment: attachmentOf(message, binaryMessage),
    }),
  )
}
```

Extend the doc comment above `TransferTokenArgs` with one more paragraph:

```ts
 *
 * It can carry SIGNA as well (`amountPlanck`), which is what makes a token
 * transfer able to run a contract: a contract only runs for at least its
 * activation amount, whatever else arrives with it.
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recipient.ts src/lib/recipient.test.ts src/lib/send.ts
git commit -m "feat: a payment or token transfer can carry binary arguments and SIGNA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The contract hook, the argument editor and the glossary entry

**Files:**
- Create: `src/hooks/useContract.ts`
- Create: `src/components/console/drawers/forms/ContractArgsEditor.tsx`
- Create: `src/components/console/drawers/forms/ContractNote.tsx`
- Modify: `src/lib/queryKeys.ts` (doc comment only)
- Modify: `src/lib/glossary.ts` (`GLOSSARY_TERMS`)
- Modify: `src/components/console/views/ContactList.tsx` (wrap the tag in `<Term>`)
- Modify: all ten `src/i18n/locales/*.ts` (`glossary.contract`, `console.send.contract`)

**Interfaces:**
- Consumes: `isContract(contacts, to)`, `Contacts` (Task 2). `encodeContractArgs`, `activationSigna`, `isBelowActivation`, `ContractArg`, `ContractArgType`, `EncodedArgs`, `AttachmentMode` (Task 1). `PayloadEditor`, `PayloadState` (`./payload`, existing). `Select`, `Toggle`, `ConsoleButton`, `Term` (existing).
- Produces:
  ```ts
  // src/hooks/useContract.ts
  export function useContract(to: string, contacts: Contacts): { isContract: boolean; contract: Contract | null }
  // ContractArgsEditor.tsx
  export interface ContractArgsState {
    args: ContractArg[]; encoded: EncodedArgs
    add: () => void; change: (index: number, arg: ContractArg) => void
    remove: (index: number) => void; reset: () => void
  }
  export function useContractArgs(): ContractArgsState
  export function ContractAttachment(props: {
    mode: AttachmentMode; onModeChange: (mode: AttachmentMode) => void
    args: ContractArgsState; payload: PayloadState; textLabel: string
  }): JSX.Element
  // ContractNote.tsx
  export function ContractNote(props: { contract: Contract | null; signa: string }): JSX.Element
  export function useActivationPrefill(contract: Contract | null, value: string, setValue: (v: string) => void): void
  ```
- i18n keys: `glossary.contract.{term,help}`, `console.send.contract.{activation, belowActivation, signa, args, text, addArg, removeArg, noArgs, bytes, types.{integer,address,boolean,shortString}, errors.{empty,notAnInteger,outOfRange,notAnAddress,tooLong}, noEncryption}`.

- [ ] **Step 1: Add the glossary term and the strings (so `locales.test.ts` and `glossary.test.ts` guide the work)**

In `src/lib/glossary.ts`, add `'contract'` to `GLOSSARY_TERMS` directly after `'contact'`.

Run: `bun run test src/lib/glossary.test.ts`
Expected: FAIL, `contract.term` is missing.

In each locale file, add `contract` inside `glossary` directly after the `contact` entry, and add `contract` inside `console.send` directly after `encrypt`:

```ts
// en — glossary
    contract: {
      term: 'Smart contract',
      help: 'A program living at an account: it runs when it receives at least its activation amount, and reads its arguments from the attachment in blocks of 8 bytes. Its account id is the id of the transaction that deployed it.',
    },
// en — console.send
      contract: {
        activation: 'runs at {{amount}} SIGNA or more',
        belowActivation: 'Below {{amount}} SIGNA the contract keeps the money but does not run',
        signa: 'SIGNA for the contract',
        args: 'Arguments',
        text: 'Text',
        addArg: 'Add argument',
        removeArg: 'Remove',
        noArgs: 'No arguments — nothing is attached',
        bytes: '{{count}} bytes',
        types: { integer: 'Integer', address: 'Address', boolean: 'Yes/No', shortString: 'Short text (≤ 8 bytes)' },
        errors: {
          empty: 'Enter a value',
          notAnInteger: 'Not a whole number',
          outOfRange: 'Does not fit in 8 bytes',
          notAnAddress: 'Not a valid address or account id',
          tooLong: 'More than 8 bytes',
        },
        noEncryption: 'A contract has no keys, so it cannot read an encrypted message',
      },

// de — glossary
    contract: {
      term: 'Smart Contract',
      help: 'Ein Programm, das unter einem Account lebt: Es läuft, sobald es mindestens seine Aktivierungsgebühr erhält, und liest seine Argumente in 8-Byte-Blöcken aus dem Anhang. Seine Account-ID ist die ID der Transaktion, die ihn deployt hat.',
    },
// de — console.send
      contract: {
        activation: 'läuft ab {{amount}} SIGNA',
        belowActivation: 'Unter {{amount}} SIGNA behält der Kontrakt das Geld, läuft aber nicht',
        signa: 'SIGNA für den Kontrakt',
        args: 'Argumente',
        text: 'Text',
        addArg: 'Argument hinzufügen',
        removeArg: 'Entfernen',
        noArgs: 'Keine Argumente — es wird nichts angehängt',
        bytes: '{{count}} Bytes',
        types: { integer: 'Ganzzahl', address: 'Adresse', boolean: 'Ja/Nein', shortString: 'Kurztext (≤ 8 Bytes)' },
        errors: {
          empty: 'Wert eingeben',
          notAnInteger: 'Keine ganze Zahl',
          outOfRange: 'Passt nicht in 8 Bytes',
          notAnAddress: 'Keine gültige Adresse oder Account-ID',
          tooLong: 'Mehr als 8 Bytes',
        },
        noEncryption: 'Ein Kontrakt hat keine Schlüssel und kann verschlüsselte Nachrichten nicht lesen',
      },

// es — glossary
    contract: {
      term: 'Contrato inteligente',
      help: 'Un programa que vive en una cuenta: se ejecuta cuando recibe al menos su importe de activación y lee sus argumentos del adjunto en bloques de 8 bytes. Su id de cuenta es el id de la transacción que lo desplegó.',
    },
// es — console.send
      contract: {
        activation: 'se ejecuta con {{amount}} SIGNA o más',
        belowActivation: 'Por debajo de {{amount}} SIGNA el contrato se queda el dinero pero no se ejecuta',
        signa: 'SIGNA para el contrato',
        args: 'Argumentos',
        text: 'Texto',
        addArg: 'Añadir argumento',
        removeArg: 'Quitar',
        noArgs: 'Sin argumentos — no se adjunta nada',
        bytes: '{{count}} bytes',
        types: { integer: 'Entero', address: 'Dirección', boolean: 'Sí/No', shortString: 'Texto corto (≤ 8 bytes)' },
        errors: {
          empty: 'Introduce un valor',
          notAnInteger: 'No es un número entero',
          outOfRange: 'No cabe en 8 bytes',
          notAnAddress: 'No es una dirección ni un id de cuenta válidos',
          tooLong: 'Más de 8 bytes',
        },
        noEncryption: 'Un contrato no tiene claves, así que no puede leer un mensaje cifrado',
      },

// pt — glossary
    contract: {
      term: 'Contrato inteligente',
      help: 'Um programa que vive numa conta: executa quando recebe pelo menos o seu valor de ativação e lê os argumentos do anexo em blocos de 8 bytes. O seu id de conta é o id da transação que o implementou.',
    },
// pt — console.send
      contract: {
        activation: 'executa com {{amount}} SIGNA ou mais',
        belowActivation: 'Abaixo de {{amount}} SIGNA o contrato fica com o dinheiro mas não executa',
        signa: 'SIGNA para o contrato',
        args: 'Argumentos',
        text: 'Texto',
        addArg: 'Adicionar argumento',
        removeArg: 'Remover',
        noArgs: 'Sem argumentos — nada é anexado',
        bytes: '{{count}} bytes',
        types: { integer: 'Inteiro', address: 'Endereço', boolean: 'Sim/Não', shortString: 'Texto curto (≤ 8 bytes)' },
        errors: {
          empty: 'Introduza um valor',
          notAnInteger: 'Não é um número inteiro',
          outOfRange: 'Não cabe em 8 bytes',
          notAnAddress: 'Não é um endereço nem um id de conta válido',
          tooLong: 'Mais de 8 bytes',
        },
        noEncryption: 'Um contrato não tem chaves, por isso não consegue ler uma mensagem cifrada',
      },

// ru — glossary
    contract: {
      term: 'Смарт-контракт',
      help: 'Программа, живущая на аккаунте: она запускается, получив хотя бы сумму активации, и читает аргументы из вложения блоками по 8 байт. Id её аккаунта — это id транзакции, которая её развернула.',
    },
// ru — console.send
      contract: {
        activation: 'запускается от {{amount}} SIGNA',
        belowActivation: 'Меньше {{amount}} SIGNA контракт оставит себе, но не запустится',
        signa: 'SIGNA для контракта',
        args: 'Аргументы',
        text: 'Текст',
        addArg: 'Добавить аргумент',
        removeArg: 'Удалить',
        noArgs: 'Без аргументов — ничего не прикрепляется',
        bytes: '{{count}} байт',
        types: { integer: 'Целое число', address: 'Адрес', boolean: 'Да/Нет', shortString: 'Короткий текст (≤ 8 байт)' },
        errors: {
          empty: 'Введите значение',
          notAnInteger: 'Не целое число',
          outOfRange: 'Не помещается в 8 байт',
          notAnAddress: 'Это не адрес и не id аккаунта',
          tooLong: 'Больше 8 байт',
        },
        noEncryption: 'У контракта нет ключей, поэтому он не может прочитать зашифрованное сообщение',
      },

// uk — glossary
    contract: {
      term: 'Смарт-контракт',
      help: 'Програма, що живе на акаунті: вона запускається, отримавши щонайменше суму активації, і читає аргументи з вкладення блоками по 8 байт. Id її акаунта — це id транзакції, яка її розгорнула.',
    },
// uk — console.send
      contract: {
        activation: 'запускається від {{amount}} SIGNA',
        belowActivation: 'Менше {{amount}} SIGNA контракт залишить собі, але не запуститься',
        signa: 'SIGNA для контракту',
        args: 'Аргументи',
        text: 'Текст',
        addArg: 'Додати аргумент',
        removeArg: 'Видалити',
        noArgs: 'Без аргументів — нічого не додається',
        bytes: '{{count}} байт',
        types: { integer: 'Ціле число', address: 'Адреса', boolean: 'Так/Ні', shortString: 'Короткий текст (≤ 8 байт)' },
        errors: {
          empty: 'Введіть значення',
          notAnInteger: 'Не ціле число',
          outOfRange: 'Не вміщується у 8 байт',
          notAnAddress: 'Це не адреса і не id акаунта',
          tooLong: 'Більше 8 байт',
        },
        noEncryption: 'Контракт не має ключів, тому не може прочитати зашифроване повідомлення',
      },

// ja — glossary
    contract: {
      term: 'スマートコントラクト',
      help: 'アカウント上で動くプログラムです。少なくともアクティベーション額を受け取ると実行され、添付データから 8 バイト単位で引数を読み取ります。そのアカウント ID は、デプロイしたトランザクションの ID です。',
    },
// ja — console.send
      contract: {
        activation: '{{amount}} SIGNA 以上で実行されます',
        belowActivation: '{{amount}} SIGNA 未満ではコントラクトはお金を受け取りますが実行されません',
        signa: 'コントラクトへの SIGNA',
        args: '引数',
        text: 'テキスト',
        addArg: '引数を追加',
        removeArg: '削除',
        noArgs: '引数なし — 何も添付されません',
        bytes: '{{count}} バイト',
        types: { integer: '整数', address: 'アドレス', boolean: 'はい/いいえ', shortString: '短いテキスト（8 バイト以内）' },
        errors: {
          empty: '値を入力してください',
          notAnInteger: '整数ではありません',
          outOfRange: '8 バイトに収まりません',
          notAnAddress: '有効なアドレスまたはアカウント ID ではありません',
          tooLong: '8 バイトを超えています',
        },
        noEncryption: 'コントラクトには鍵がないため、暗号化されたメッセージを読めません',
      },

// ko — glossary
    contract: {
      term: '스마트 컨트랙트',
      help: '계정에 사는 프로그램입니다. 최소 활성화 금액을 받으면 실행되고, 첨부 데이터에서 8바이트 단위로 인수를 읽습니다. 계정 ID는 이를 배포한 트랜잭션의 ID입니다.',
    },
// ko — console.send
      contract: {
        activation: '{{amount}} SIGNA 이상이면 실행됩니다',
        belowActivation: '{{amount}} SIGNA 미만이면 컨트랙트가 돈은 받지만 실행되지 않습니다',
        signa: '컨트랙트에 보낼 SIGNA',
        args: '인수',
        text: '텍스트',
        addArg: '인수 추가',
        removeArg: '삭제',
        noArgs: '인수 없음 — 아무것도 첨부되지 않습니다',
        bytes: '{{count}}바이트',
        types: { integer: '정수', address: '주소', boolean: '예/아니요', shortString: '짧은 텍스트(8바이트 이하)' },
        errors: {
          empty: '값을 입력하세요',
          notAnInteger: '정수가 아닙니다',
          outOfRange: '8바이트에 들어가지 않습니다',
          notAnAddress: '유효한 주소나 계정 ID가 아닙니다',
          tooLong: '8바이트를 넘습니다',
        },
        noEncryption: '컨트랙트에는 키가 없어 암호화된 메시지를 읽을 수 없습니다',
      },

// zh — glossary
    contract: {
      term: '智能合约',
      help: '驻留在账户上的程序：收到至少激活金额时运行，并以 8 字节为一块从附件中读取参数。它的账户 ID 就是部署它的交易 ID。',
    },
// zh — console.send
      contract: {
        activation: '{{amount}} SIGNA 及以上时运行',
        belowActivation: '低于 {{amount}} SIGNA 时，合约会收下资金但不会运行',
        signa: '发送给合约的 SIGNA',
        args: '参数',
        text: '文本',
        addArg: '添加参数',
        removeArg: '移除',
        noArgs: '没有参数——不附加任何内容',
        bytes: '{{count}} 字节',
        types: { integer: '整数', address: '地址', boolean: '是/否', shortString: '短文本（≤ 8 字节）' },
        errors: {
          empty: '请输入一个值',
          notAnInteger: '不是整数',
          outOfRange: '超出 8 字节范围',
          notAnAddress: '不是有效的地址或账户 ID',
          tooLong: '超过 8 字节',
        },
        noEncryption: '合约没有密钥，因此无法读取加密消息',
      },

// hi — glossary
    contract: {
      term: 'स्मार्ट कॉन्ट्रैक्ट',
      help: 'किसी खाते पर रहने वाला प्रोग्राम: कम से कम अपनी एक्टिवेशन राशि मिलने पर यह चलता है और संलग्नक से 8 बाइट के खंडों में आर्ग्युमेंट पढ़ता है। इसकी खाता आईडी उस लेनदेन की आईडी है जिसने इसे डिप्लॉय किया।',
    },
// hi — console.send
      contract: {
        activation: '{{amount}} SIGNA या उससे अधिक पर चलता है',
        belowActivation: '{{amount}} SIGNA से कम पर कॉन्ट्रैक्ट पैसा रख लेता है पर चलता नहीं',
        signa: 'कॉन्ट्रैक्ट के लिए SIGNA',
        args: 'आर्ग्युमेंट',
        text: 'टेक्स्ट',
        addArg: 'आर्ग्युमेंट जोड़ें',
        removeArg: 'हटाएँ',
        noArgs: 'कोई आर्ग्युमेंट नहीं — कुछ भी संलग्न नहीं होगा',
        bytes: '{{count}} बाइट',
        types: { integer: 'पूर्णांक', address: 'पता', boolean: 'हाँ/नहीं', shortString: 'छोटा टेक्स्ट (≤ 8 बाइट)' },
        errors: {
          empty: 'कोई मान दर्ज करें',
          notAnInteger: 'पूर्ण संख्या नहीं है',
          outOfRange: '8 बाइट में नहीं समाता',
          notAnAddress: 'यह मान्य पता या खाता आईडी नहीं है',
          tooLong: '8 बाइट से अधिक',
        },
        noEncryption: 'कॉन्ट्रैक्ट के पास कोई कुंजी नहीं होती, इसलिए वह एन्क्रिप्टेड संदेश नहीं पढ़ सकता',
      },
```

Run: `bun run test src/lib/glossary.test.ts src/i18n/locales/locales.test.ts`
Expected: PASS.

- [ ] **Step 2: The contract hook**

Create `src/hooks/useContract.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { Contract } from '@signumjs/core'
import { isContract, type Contacts } from '@/lib/contacts'
import { ledger } from '@/lib/ledger'
import { toComparableId } from '@/lib/recipient'

/**
 * Whether a "To" field holds a contract from the address book, and — once
 * the node answers — the contract itself, for its activation amount and name.
 *
 * Only contacts marked as contracts are looked up; anything else is an
 * account as far as the forms are concerned. The answer never goes stale:
 * a contract's activation amount is fixed when it is deployed.
 */
export function useContract(to: string, contacts: Contacts) {
  const toContract = isContract(contacts, to)
  const id = toContract ? toComparableId(to.trim()) : ''
  const query = useQuery({
    queryKey: ['contract', id],
    queryFn: () => ledger.contract.getContract(id),
    enabled: toContract,
    retry: false,
    staleTime: Infinity,
  })
  return { isContract: toContract, contract: toContract ? (query.data ?? null) : null }
}
```

In `src/lib/queryKeys.ts`, extend the "Deliberately not everything" sentence of the doc comment to also name the contract: replace `an \`asset\`'s name and decimals never change,` with `an \`asset\`'s name and decimals never change, a \`contract\`'s activation amount is fixed at deployment,`.

If `tsc` reports that `Contract` is not exported from `@signumjs/core`, import it from `@signumjs/contracts` instead. Both packages declare it, and the spec verified the core re-export.

- [ ] **Step 3: The note under "To" and the prefill**

Create `src/components/console/drawers/forms/ContractNote.tsx`:

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Contract } from '@signumjs/core'
import { activationSigna, isBelowActivation } from '@/lib/contractArgs'
import { Term } from '@/components/console/Term'

/**
 * One line under "To" when the recipient is a contract: that it is one, and
 * what it takes to run it. Below that amount it warns rather than refuses —
 * watching a contract keep the money and do nothing is a lesson too.
 */
export function ContractNote({ contract, signa }: { contract: Contract | null; signa: string }) {
  const { t } = useTranslation()
  const amount = contract ? activationSigna(contract.minActivation) : null
  return (
    <div className="mb-2 -mt-1 text-[11px] leading-relaxed">
      <p className="text-[var(--blue3)]">
        <Term id="contract">{contract?.name || t('console.accounts.contractTag')}</Term>
        {amount && ` · ${t('console.send.contract.activation', { amount })}`}
      </p>
      {contract && amount && isBelowActivation(signa, contract.minActivation) && (
        <p style={{ color: 'var(--mag)' }}>{t('console.send.contract.belowActivation', { amount })}</p>
      )}
    </div>
  )
}

/**
 * Puts the activation amount into an amount field the moment a contract is
 * picked — but only into an empty one. What a person typed is theirs.
 */
export function useActivationPrefill(
  contract: Contract | null,
  value: string,
  setValue: (value: string) => void,
) {
  useEffect(() => {
    if (contract && value === '') setValue(activationSigna(contract.minActivation))
    // Keyed on the contract alone: re-running on every keystroke would refill
    // a field the person just cleared on purpose.
  }, [contract?.at])
}
```

- [ ] **Step 4: The argument editor**

Create `src/components/console/drawers/forms/ContractArgsEditor.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  encodeContractArgs,
  type AttachmentMode,
  type ContractArg,
  type ContractArgType,
  type EncodedArgs,
} from '@/lib/contractArgs'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { Select } from '@/components/console/Select'
import { Toggle } from '@/components/console/Toggle'
import { TextInput } from './fields'
import { PayloadEditor, type PayloadState } from './payload'

const TYPES: ContractArgType[] = ['integer', 'address', 'boolean', 'shortString']

const emptyArg = (type: ContractArgType): ContractArg => ({
  type,
  value: type === 'boolean' ? 'false' : '',
})

export interface ContractArgsState {
  args: ContractArg[]
  encoded: EncodedArgs
  add: () => void
  change: (index: number, arg: ContractArg) => void
  remove: (index: number) => void
  reset: () => void
}

/** The rows, and what they come to — kept beside the editor the way usePayload is. */
export function useContractArgs(): ContractArgsState {
  const [args, setArgs] = useState<ContractArg[]>([])
  return {
    args,
    encoded: encodeContractArgs(args),
    add: () => setArgs((previous) => [...previous, emptyArg('integer')]),
    change: (index, arg) =>
      setArgs((previous) => previous.map((existing, i) => (i === index ? arg : existing))),
    remove: (index) => setArgs((previous) => previous.filter((_, i) => i !== index)),
    reset: () => setArgs([]),
  }
}

/**
 * One row per 8-byte block, in the order the contract reads them. The bytes
 * themselves are shown underneath, because a contract author debugging a
 * call wants to see exactly what went out.
 */
function ContractArgsEditor({ state }: { state: ContractArgsState }) {
  const { t } = useTranslation()
  const errors = 'errors' in state.encoded ? state.encoded.errors : {}

  return (
    <div className="mb-2">
      {state.args.length === 0 && (
        <p className="mb-2 text-[12px] text-[var(--muted)]">{t('console.send.contract.noArgs')}</p>
      )}
      {state.args.map((arg, index) => (
        <div key={index} className="mb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[11px] text-[var(--muted)]">{index}</span>
            <div className="w-40 shrink-0">
              <Select
                value={arg.type}
                placeholder="—"
                onChange={(type) => state.change(index, emptyArg(type as ContractArgType))}
                options={TYPES.map((type) => ({
                  value: type,
                  label: t(`console.send.contract.types.${type}`),
                }))}
              />
            </div>
            <div className="min-w-0 flex-1">
              {arg.type === 'boolean' ? (
                <Toggle
                  checked={arg.value === 'true'}
                  onChange={(checked) => state.change(index, { ...arg, value: String(checked) })}
                  label={arg.value === 'true' ? 'true · 1' : 'false · 0'}
                />
              ) : (
                <TextInput
                  value={arg.value}
                  onChange={(value) => state.change(index, { ...arg, value })}
                  placeholder={arg.type === 'address' ? 'TS-…' : arg.type === 'integer' ? '0' : 'abc'}
                />
              )}
            </div>
            <ConsoleButton onClick={() => state.remove(index)}>
              {t('console.send.contract.removeArg')}
            </ConsoleButton>
          </div>
          {errors[index] && (
            <p className="ml-7 mt-1 text-[11px]" style={{ color: 'var(--mag)' }}>
              {t(`console.send.contract.errors.${errors[index]}`)}
            </p>
          )}
        </div>
      ))}
      <ConsoleButton onClick={state.add}>{t('console.send.contract.addArg')}</ConsoleButton>
      {'hex' in state.encoded && state.encoded.hex !== '' && (
        <p className="mt-2 break-all font-mono text-[11px] text-[var(--blue3)]">
          {state.encoded.hex}
          <span className="ml-2 text-[var(--muted)]">
            {t('console.send.contract.bytes', { count: state.encoded.hex.length / 2 })}
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * What a contract recipient gets as its attachment: arguments, or text for a
 * contract that reads text. Both halves keep their state while switching, as
 * usePayload does for its own two.
 */
export function ContractAttachment({
  mode,
  onModeChange,
  args,
  payload,
  textLabel,
}: {
  mode: AttachmentMode
  onModeChange: (mode: AttachmentMode) => void
  args: ContractArgsState
  payload: PayloadState
  textLabel: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="mb-2 flex gap-2">
        <ConsoleButton active={mode === 'args'} onClick={() => onModeChange('args')}>
          {t('console.send.contract.args')}
        </ConsoleButton>
        <ConsoleButton active={mode === 'text'} onClick={() => onModeChange('text')}>
          {t('console.send.contract.text')}
        </ConsoleButton>
      </div>
      {mode === 'args' ? (
        <ContractArgsEditor state={args} />
      ) : (
        <PayloadEditor state={payload} label={textLabel} variant="attachment" />
      )}
    </>
  )
}
```

Before relying on them, check the `ConsoleButton` and `Select` prop names against `src/components/console/ConsoleButton.tsx` and `src/components/console/Select.tsx`. `ConsoleButton` takes `active?: boolean`, `disabled?`, `onClick`, `children`, and `Select` takes `value`, `options`, `placeholder`, `onChange`. If a prop differs, adapt the call, not the component.

- [ ] **Step 5: Wrap the contact tag in the glossary term**

In `src/components/console/views/ContactList.tsx`, change the tag content from Task 2 to `<Term id="contract">{t('console.accounts.contractTag')}</Term>` (`Term` is already imported there).

- [ ] **Step 6: Run tests and typecheck, then commit**

Run: `bun run test && bunx tsc -p tsconfig.json`
Expected: PASS, no type errors. `noUnusedLocals` is on, but every new export is used in Task 5. Unused *exports* are fine for `tsc`.

```bash
git add src/hooks/useContract.ts src/components/console/drawers/forms/ContractArgsEditor.tsx \
  src/components/console/drawers/forms/ContractNote.tsx src/lib/queryKeys.ts src/lib/glossary.ts \
  src/components/console/views/ContactList.tsx src/i18n/locales
git commit -m "feat: arguments for a contract are typed as values, and shown as the bytes they become

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The forms speak to contracts

**Files:**
- Modify: `src/components/console/drawers/forms/PaymentForm.tsx`
- Modify: `src/components/console/drawers/forms/TokenTransferForm.tsx`
- Modify: `src/components/console/drawers/forms/MessageForm.tsx`

**Interfaces:**
- Consumes: `useContract` (Task 4), `ContractNote`, `useActivationPrefill` (Task 4), `ContractAttachment`, `useContractArgs` (Task 4), `pickAttachment`, `AttachmentMode` (Task 1), `sendPayment({ …, message?, binaryMessage? })`, `transferToken({ …, message?, binaryMessage?, signa? })` (Task 3).
- Produces: nothing new for other tasks.

- [ ] **Step 1: PaymentForm**

Add imports:

```ts
import { pickAttachment, type AttachmentMode } from '@/lib/contractArgs'
import { useContract } from '@/hooks/useContract'
import { ContractNote, useActivationPrefill } from './ContractNote'
import { ContractAttachment, useContractArgs } from './ContractArgsEditor'
```

After `const payload = usePayload()` add:

```ts
  const { isContract: toContract, contract } = useContract(to, contacts)
  const args = useContractArgs()
  const [mode, setMode] = useState<AttachmentMode>('args')
  useActivationPrefill(contract, amount, setAmount)
```

Replace the body of `submit` up to `setBusy(true)` with:

```ts
    const from = accounts.find((a) => a.id === fromId)
    if (!from || !to || !amount) return
    const attachment = pickAttachment({
      attach,
      toContract,
      mode,
      encoded: args.encoded,
      text: payload.value,
    })
    if (attachment === null) return
    setBusy(true)
```

and the `sendPayment` call with:

```ts
      await sendPayment({
        from,
        to,
        signa: amount,
        recipientPublicKey,
        ...attachment,
        fee: Amount.fromSigna(fee),
      })
```

After `payload.reset()` add `args.reset()`.

In the JSX, directly after the "To" `<Field>` add:

```tsx
      {toContract && <ContractNote contract={contract} signa={amount} />}
```

and replace the `{attach && (<PayloadEditor … />)}` block with:

```tsx
      {attach &&
        (toContract ? (
          <ContractAttachment
            mode={mode}
            onModeChange={setMode}
            args={args}
            payload={payload}
            textLabel={t('console.send.message')}
          />
        ) : (
          <PayloadEditor state={payload} label={t('console.send.message')} variant="attachment" />
        ))}
```

- [ ] **Step 2: TokenTransferForm**

Same imports as Step 1. After `const payload = usePayload()` add:

```ts
  const [signa, setSigna] = useState('')
  const { isContract: toContract, contract } = useContract(to, contacts)
  const args = useContractArgs()
  const [mode, setMode] = useState<AttachmentMode>('args')
  useActivationPrefill(contract, signa, setSigna)
```

In `submit`, replace the lines from `const attached = …` through `if (attach && attached === undefined) return` with:

```ts
    if (!from || !to || !assetId || !quantity) return
    const attachment = pickAttachment({
      attach,
      toContract,
      mode,
      encoded: args.encoded,
      text: payload.value,
    })
    if (attachment === null) return
```

(keep `const from = …` as the first line). Change the `transferToken` call to:

```ts
      await transferToken({
        from,
        to,
        assetId,
        quantity,
        recipientPublicKey,
        ...attachment,
        // Only a contract has a use for SIGNA beside a token, and a field the
        // person cannot see must not send anything.
        signa: toContract && signa.trim() !== '' ? signa.trim() : undefined,
        fee: Amount.fromSigna(fee),
      })
```

After `payload.reset()` add `args.reset()` and `setSigna('')`.

In the JSX, after the "To" `<Field>` add:

```tsx
      {toContract && <ContractNote contract={contract} signa={signa} />}
```

After the `<QuantityHint … />` add:

```tsx
      {toContract && (
        <Field label={t('console.send.contract.signa')}>
          <TextInput value={signa} onChange={setSigna} placeholder="0.4" />
        </Field>
      )}
```

Replace the `{attach && (<PayloadEditor … />)}` block exactly as in Step 1.

- [ ] **Step 3: MessageForm**

Add the import `import { useContract } from '@/hooks/useContract'`. After `const [encrypt, setEncrypt] = useState(false)` add:

```ts
  // A contract has no key pair, so there is nothing to encrypt for. The
  // choice is switched off rather than hidden, so the reason can be read.
  const { isContract: toContract } = useContract(to, contacts)
  const encrypting = encrypt && !toContract
```

In `submit`, change `if (encrypt) {` to `if (encrypting) {`. Replace the encrypt toggle block with:

```tsx
      <div className="mb-2">
        <Toggle
          checked={encrypting}
          onChange={setEncrypt}
          disabled={toContract}
          label={t('console.send.encrypt')}
        />
        {toContract && (
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            {t('console.send.contract.noEncryption')}
          </p>
        )}
      </div>
```

- [ ] **Step 4: Tests, typecheck, build**

Run: `bun run test && bunx tsc -p tsconfig.json && bun run build`
Expected: all pass, and the build writes `html/sandbox` without errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/console/drawers/forms/PaymentForm.tsx \
  src/components/console/drawers/forms/TokenTransferForm.tsx \
  src/components/console/drawers/forms/MessageForm.tsx
git commit -m "feat: picking a contract as recipient offers its activation amount and an argument form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verify against the running node

**Files:** none changed unless a check fails. A fix goes into the file that owns the behaviour, with a test where the behaviour is pure.

The sandbox node must be running (`curl -s "http://localhost:6876/api?requestType=getMiningInfo"` answers JSON). Start the UI with `bun run dev` (http://localhost:5173) and drive it in the browser. The `run` skill or Claude in Chrome both work.

- [ ] **Step 1: Contact checks**
  - Accounts → Contacts: add `TS-FG8U-4565-CMY2-D7XBE` as "Registry". Expected: it is saved with a "contract" tag, and the tag's glossary popover opens.
  - Add `123456789` as "Nobody". Expected: "This address does not exist on the chain yet", and nothing is saved.
  - Add `TS-NOPE` as "Junk". Expected: "Not a valid address or account id".
  - Add one of your own accounts' addresses as a contact. Expected: saved without a tag.
  - Reload the page. Expected: all saved contacts are still there, the contract still tagged.

- [ ] **Step 2: Payment with arguments**
  - Send → Payment. In "To", type the registry address in lowercase and without the `TS-` prefix. Expected: the note shows "SRankCharReg · runs at 0.4 SIGNA or more", and the amount is prefilled with `0.4`.
  - Change the amount to `0.1`. Expected: the below-activation warning appears. Set it back to `0.4`.
  - Turn on "Attach a message". Expected: the "Arguments | Text" switch, with "Arguments" active.
  - Add rows: integer `42`, address = one of your own accounts, short text `hello`, boolean on. Expected: the preview shows 64 hex characters starting `2a00000000000000`, and "32 bytes".
  - Add a short text `123456789`. Expected: "More than 8 bytes" under that row, and Send does nothing. Remove the row.
  - Send, forge a block, and open the transaction. Expected: the message is shown as non-text, and its hex equals the preview.

- [ ] **Step 3: Switching away from the contract**
  - With arguments still filled in, change "To" to one of your own accounts. Expected: the note disappears, the plain message editor is back, and a send carries the text (or no message), never the argument bytes.

- [ ] **Step 4: Token transfer and message**
  - Issue a token if none exists, then Send → Token transfer to the registry contact. Expected: a "SIGNA for the contract" field prefilled with `0.4`. After sending and forging, the transaction shows both the token quantity and 0.4 SIGNA.
  - Send → Message to the registry contact. Expected: "Encrypt" is disabled, with the explanation underneath. A plain message is sent without a "recipient public key" error.

- [ ] **Step 5: Final run and branch review**

Run: `bun run test && bunx tsc -p tsconfig.json && bun run build`
Expected: all green. Report any check from Steps 1–4 that did not behave as expected, with what happened instead, rather than marking this task done.
