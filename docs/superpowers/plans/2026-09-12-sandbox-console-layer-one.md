# Sandbox Console — Layer One (Developer Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the sandbox console — a route at `#/console` where a developer manages accounts, drives the chain, sends every supported transaction type and inspects what happened.

**Architecture:** A stage-with-tabs layout: one persistent header (chain status, forge controls, drawer triggers), one surface that switches between Transactions, Blocks and Accounts, and drawers for Send, Chain and Help. Every decision worth testing lives in a pure function in `src/lib/`; React components take data as props and hold no logic. Chain reads go through TanStack Query invalidated by the existing WebSocket; chain writes go through a signing SignumJS client using passphrases from a `localStorage` account store.

**Tech Stack:** React 19, TanStack Router (hash history) + Query, SignumJS 3.3.4 (`core`, `util`, `crypto`, `standards`), `hashicon@0.3.0`, Tailwind 4, i18next, Vitest (`environment: 'node'`).

**Source spec:** `docs/superpowers/specs/2026-09-12-sandbox-console-design.md`

**Scope note:** This plan covers layer one of that spec, plus chain reset. Reset is listed under chain control rather than in the spec's layer-one summary sentence; it is included here because the developer loop the layer promises ("break it, reset it, start over") does not close without it. Everything explicitly assigned to layer two — scenarios, the scenario runner, `scripts/seed.sh`, beginner mode, the tour, and the advanced section with `popOff` controls — is **out of scope**. `popOff` is implemented as a library function in Task 8 because the staged reset uses it, but it gets no UI here.

**Three phases, each ending in something that runs:**

| Phase | Tasks | Ends with |
|---|---|---|
| A — Frame and identity | 1–7 | A console route with a header, tabs, and working account management |
| B — Chain control and inspection | 8–15 | Forging, reset, and all three views with search and inline detail |
| C — The composer | 16–20 | Every supported transaction sendable from the UI |

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/network.ts` | The mock-network identity check. Nothing else. |
| `src/lib/accounts.ts` | Pure account model: derive from a passphrase, add, remove, parse, serialize. |
| `src/lib/chainAdmin.ts` | Admin calls: forge, popOff, fullReset, and the staged reset plan. |
| `src/lib/chainFeed.ts` | Merge unconfirmed and confirmed transactions into one ordered feed. |
| `src/lib/txSummary.ts` | Transaction → one-line summary data (kind, parties, amount). |
| `src/lib/payload.ts` | Decode attachments: message, SRC44, token, multi-out, subscription. |
| `src/lib/search.ts` | Interpret one search input per view. |
| `src/lib/send.ts` | One typed function per composer action, over the signing client. |
| `src/hooks/useAccounts.ts` | The account store: `localStorage` + the network rail. |
| `src/hooks/useChainFeed.ts` | Feed queries and their invalidation. |
| `src/hooks/useForge.ts` | Forge action, auto-forge interval, forger selection. |
| `src/routes/console.tsx` | The console route. |
| `src/components/console/ConsoleShell.tsx` | Header + tabs + stage + drawer host. |
| `src/components/console/Header.tsx` | Status, forge controls, drawer triggers. |
| `src/components/console/Identicon.tsx` | `hashicon` wrapper. |
| `src/components/console/views/TransactionsView.tsx` | The stream. |
| `src/components/console/views/TransactionRow.tsx` | One row plus its inline detail. |
| `src/components/console/views/BlocksView.tsx` | Block list. |
| `src/components/console/views/AccountsView.tsx` | Account list, create and import. |
| `src/components/console/views/SearchField.tsx` | The one input. |
| `src/components/console/drawers/Drawer.tsx` | The drawer frame. |
| `src/components/console/drawers/SendDrawer.tsx` | Composer frame and action picker. |
| `src/components/console/drawers/forms/*.tsx` | One form per action. |
| `src/components/console/drawers/ChainDrawer.tsx` | Reset. |
| `src/components/console/drawers/HelpDrawer.tsx` | Theme, sound, language, API-doc link. |

**Modified:** `src/router.tsx`, `src/main.tsx`, `src/lib/ledger.ts`, `src/components/startpage/EntryList.tsx`, `src/i18n/locales/*.ts` (all ten), `conf/node.properties`, `scripts/smoke.sh`, `package.json`, `README.md`.

**Testing convention:** the repository runs Vitest with `environment: 'node'` and has no jsdom or testing library. Pure modules in `src/lib/` get real tests. Components are verified by `bun run build` (which runs `tsc -b` first) plus a named manual check in the browser. Do not add a render-test stack — that is a separate decision.

---

# Phase A — Frame and identity

## Task 1: Dependencies and the crypto adapter

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: Add the three dependencies**

```bash
bun add @signumjs/crypto@3.3.4 @signumjs/standards@3.3.4 hashicon@0.3.0
```

Then open `package.json` and **remove the caret from `hashicon`** so the entry reads exactly `"hashicon": "0.3.0"`. The identicon must not change across installs — the same address has to produce the same picture here as in the Signum wallets.

`@signumjs/crypto` is already present as a transitive dependency of `@signumjs/core`; adding it explicitly is what makes importing it directly legitimate.

- [ ] **Step 2: Initialise the crypto adapter at startup**

`@signumjs/crypto` requires `Crypto.init()` before any signing or encryption call. Read `src/main.tsx`, then add the import and the call above the `createRoot` call:

```tsx
import { Crypto } from '@signumjs/crypto'
import { WebCryptoAdapter } from '@signumjs/crypto/adapters'

// Signing and message encryption go through this adapter; it must be set once,
// before any crypto function runs.
Crypto.init(new WebCryptoAdapter())
```

- [ ] **Step 3: Verify the build**

Run: `bun run build`
Expected: exits 0, `html/sandbox/index.html` written.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock src/main.tsx
git commit -m "feat: crypto adapter and the console's dependencies"
```

---

## Task 2: The mock-network guard

**Files:**
- Create: `src/lib/network.ts`
- Test: `src/lib/network.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/network.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isMockNetwork, MOCK_NETWORK_NAME } from './network'

describe('isMockNetwork', () => {
  it('accepts the mock network', () => {
    expect(isMockNetwork(MOCK_NETWORK_NAME)).toBe(true)
  })

  it('rejects mainnet, testnet and anything else', () => {
    expect(isMockNetwork('Signum')).toBe(false)
    expect(isMockNetwork('Signum-TESTNET')).toBe(false)
    expect(isMockNetwork('signum-local-mock')).toBe(false)
  })

  it('rejects an unknown network rather than assuming the best', () => {
    expect(isMockNetwork(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/lib/network.test.ts`
Expected: FAIL — `Failed to resolve import "./network"`.

- [ ] **Step 3: Implement**

Create `src/lib/network.ts`:

```ts
/**
 * The network name our mock node reports, verified against the node running
 * with `node.network = signum.net.MockNetwork`.
 */
export const MOCK_NETWORK_NAME = 'Signum-LOCAL-MOCK'

/**
 * The sandbox keeps passphrases in plain localStorage because they are worthless
 * on a mock chain. That is only true while the node actually is the mock chain,
 * so every passphrase-touching feature asks this first. An unknown network is
 * treated as foreign: the failure mode of refusing on a mock node is a confused
 * user, the failure mode of accepting on mainnet is a stolen account.
 */
export function isMockNetwork(networkName: string | undefined): boolean {
  return networkName === MOCK_NETWORK_NAME
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `bun run test src/lib/network.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/network.ts src/lib/network.test.ts
git commit -m "feat: the mock-network guard"
```

---

## Task 3: The account model

**Files:**
- Create: `src/lib/accounts.ts`
- Test: `src/lib/accounts.test.ts`

`deriveAccount` turns a passphrase into everything else: the sign keys come from `generateSignKeys`, and `Address.fromPublicKey` gives both the numeric id and the Reed-Solomon address in the network's own prefix. The prefix is passed in rather than hardcoded — the mock network uses `TS`, and the foundation spec forbids assuming `S`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/accounts.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { Crypto } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import {
  addAccount,
  deriveAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
  type SandboxAccount,
} from './accounts'

// The browser adapter needs window.crypto; under vitest's node environment the
// Node adapter is the equivalent. Crypto.init must run before generateSignKeys.
beforeAll(() => Crypto.init(new NodeJSCryptoAdapter()))

const alice = () => deriveAccount('Alice', 'sandbox-alice', 'TS')

describe('deriveAccount', () => {
  it('derives the same id and address every time from the same passphrase', () => {
    const a = alice()
    const b = alice()
    expect(a.id).toBe(b.id)
    expect(a.address).toBe(b.address)
  })

  it('formats the address with the network prefix rather than assuming S', () => {
    expect(alice().address.startsWith('TS-')).toBe(true)
  })

  it('keeps the name and passphrase it was given', () => {
    expect(alice()).toMatchObject({ name: 'Alice', passphrase: 'sandbox-alice' })
  })

  it('gives different passphrases different accounts', () => {
    expect(deriveAccount('Bob', 'sandbox-bob', 'TS').id).not.toBe(alice().id)
  })
})

describe('addAccount', () => {
  it('appends an account', () => {
    const list = addAccount([], alice())
    expect(list).toHaveLength(1)
  })

  it('replaces instead of duplicating when the same account is added again', () => {
    const list = addAccount(addAccount([], alice()), deriveAccount('Alice 2', 'sandbox-alice', 'TS'))
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Alice 2')
  })
})

describe('removeAccount', () => {
  it('removes by id and leaves the rest alone', () => {
    const list = addAccount(addAccount([], alice()), deriveAccount('Bob', 'sandbox-bob', 'TS'))
    const rest = removeAccount(list, alice().id)
    expect(rest).toHaveLength(1)
    expect(rest[0].name).toBe('Bob')
  })
})

describe('parseAccounts', () => {
  it('round-trips through serialization', () => {
    const list: SandboxAccount[] = [alice()]
    expect(parseAccounts(serializeAccounts(list))).toEqual(list)
  })

  it('returns an empty list for missing, malformed or foreign storage', () => {
    expect(parseAccounts(null)).toEqual([])
    expect(parseAccounts('not json')).toEqual([])
    expect(parseAccounts('{"nope":1}')).toEqual([])
    expect(parseAccounts('[{"id":"1"}]')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/lib/accounts.test.ts`
Expected: FAIL — `Failed to resolve import "./accounts"`.

- [ ] **Step 3: Implement**

Create `src/lib/accounts.ts`:

```ts
import { Address } from '@signumjs/core'
import { generateSignKeys } from '@signumjs/crypto'

export interface SandboxAccount {
  /** Numeric account id, the form the API expects as recipient. */
  id: string
  /** Reed-Solomon address including the network prefix, the form people read. */
  address: string
  name: string
  /**
   * Stored in plain text. Legitimate only on the mock chain — see isMockNetwork,
   * which every consumer of this store checks first.
   */
  passphrase: string
}

export function deriveAccount(
  name: string,
  passphrase: string,
  addressPrefix: string,
): SandboxAccount {
  const { publicKey } = generateSignKeys(passphrase)
  const address = Address.fromPublicKey(publicKey, addressPrefix)
  return {
    id: address.getNumericId(),
    address: address.getReedSolomonAddress(true),
    name,
    passphrase,
  }
}

/** Adding a passphrase that is already stored renames it rather than duplicating it. */
export function addAccount(
  list: SandboxAccount[],
  account: SandboxAccount,
): SandboxAccount[] {
  const without = list.filter((a) => a.id !== account.id)
  return [...without, account]
}

export function removeAccount(list: SandboxAccount[], id: string): SandboxAccount[] {
  return list.filter((a) => a.id !== id)
}

export function serializeAccounts(list: SandboxAccount[]): string {
  return JSON.stringify(list)
}

const isAccount = (v: unknown): v is SandboxAccount =>
  typeof v === 'object' &&
  v !== null &&
  ['id', 'address', 'name', 'passphrase'].every(
    (k) => typeof (v as Record<string, unknown>)[k] === 'string',
  )

/**
 * Storage written by an older version, by hand, or by another app must never
 * crash the console. Anything that is not a complete account is dropped.
 */
export function parseAccounts(raw: string | null): SandboxAccount[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isAccount) : []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `bun run test src/lib/accounts.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accounts.ts src/lib/accounts.test.ts
git commit -m "feat: the pure account model"
```

---

## Task 4: The signing client

**Files:**
- Modify: `src/lib/ledger.ts`

The existing `ledger` stays exactly as it is — read paths keep using the read-only client and its smaller bundle. The signing client is a second export used only by write paths.

- [ ] **Step 1: Add the signing client**

Read `src/lib/ledger.ts`, then append:

```ts
import { LedgerClientFactory } from '@signumjs/core'

/**
 * The full client, for everything that writes. Kept separate from `ledger` so
 * that read paths keep pulling in only the read-only surface, and so that
 * "does this code sign something?" is answerable by looking at the import.
 */
export const signingLedger = LedgerClientFactory.createClient({ nodeHost })
```

- [ ] **Step 2: Verify it type-checks**

Run: `bun run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ledger.ts
git commit -m "feat: a signing ledger client alongside the read-only one"
```

---

## Task 5: The console string catalogue

**Files:**
- Modify: `src/i18n/locales/en.ts`, `de.ts`, `es.ts`, `pt.ts`, `uk.ts`, `ru.ts`, `zh.ts`, `ja.ts`, `ko.ts`, `hi.ts`

`src/i18n/locales/locales.test.ts` fails whenever the ten locales do not share exactly one key set, so all ten change together. Adding the whole catalogue once, up front, keeps every later task to editing components.

- [ ] **Step 1: Add the catalogue to English**

In `src/i18n/locales/en.ts`, change the `entry.dashboard` entry and add a `console` section. The full new object:

```ts
export default {
  tagline: 'A throwaway Signum chain to build against. Break it, reset it, start over.',
  status: {
    live: 'live',
    polling: 'polling',
    offline: 'offline',
    scanning: 'scanning',
  },
  panel: { nodeState: 'Node State' },
  tile: {
    height: 'Block Height',
    lastBlock: 'Last Block',
  },
  entry: {
    apiDocs: { title: 'API Docs', description: 'Try the full JSON API interactively' },
    dashboard: { title: 'Sandbox', description: 'Forge blocks, send transactions, inspect the chain' },
    comingSoon: 'coming next',
  },
  unreachable: {
    title: 'No node at {{host}}',
    description: 'Start it with ./scripts/start.sh',
  },
  console: {
    back: 'Start page',
    tab: { transactions: 'Transactions', blocks: 'Blocks', accounts: 'Accounts' },
    search: { placeholder: 'Id, address or name' },
    forge: { action: 'Forge', requested: 'Block requested', auto: 'auto', forger: 'Forger' },
    empty: {
      title: 'Nothing has happened yet',
      description: 'Create an account, then forge a block to give it funds.',
    },
    drawer: { send: 'Send', chain: 'Chain', help: 'Help', close: 'Close' },
    tx: {
      unconfirmed: 'unconfirmed',
      block: 'Block {{height}}',
      raw: 'raw response',
      fee: 'Fee',
      undecryptable: 'Encrypted — the sandbox holds neither key',
      none: 'No transactions yet',
    },
    kind: {
      payment: 'Payment',
      multiOut: 'Multi-out',
      message: 'Message',
      encryptedMessage: 'Encrypted message',
      accountInfo: 'Account info',
      tokenIssue: 'Token issued',
      tokenTransfer: 'Token transfer',
      alias: 'Alias',
      subscription: 'Subscription',
      reward: 'Block reward',
      other: 'Transaction',
    },
    blocks: { count: '{{count}} transactions', empty: 'Empty', forger: 'Forger' },
    accounts: {
      create: 'Create account',
      import: 'Import passphrase',
      name: 'Name',
      passphrase: 'Passphrase',
      balance: 'Balance',
      remove: 'Remove',
      forger: 'Forger',
      notOnChain: 'Not on chain yet — it appears once it receives something',
      fake: 'Deliberately fake — never use outside the sandbox',
      none: 'No accounts yet',
    },
    send: {
      from: 'From',
      to: 'To',
      amount: 'Amount',
      fee: 'Fee',
      message: 'Message',
      attach: 'Attach a message',
      encrypt: 'Encrypt',
      submit: 'Send',
      sent: 'Sent — it appears as unconfirmed',
      recipients: 'Recipients',
      recipientHint: 'One per line: address, amount',
      tokenName: 'Token name',
      tokenQuantity: 'Quantity',
      tokenDecimals: 'Decimals',
      tokenDescription: 'Description',
      token: 'Token',
      aliasName: 'Alias name',
      aliasContent: 'Content',
      infoName: 'Name',
      infoDescription: 'Description',
      frequency: 'Every (seconds)',
      needsPublicKey: 'The recipient must be on chain or known to the sandbox',
    },
    chain: {
      reset: 'Reset the chain',
      resetConfirm: 'This deletes every block, account and transaction. Continue?',
      resetDone: 'The chain is back at the start',
      resetManual: 'Neither reset call worked. Run ./scripts/reset.sh',
      height: 'Height',
    },
    guard: {
      title: 'This is not the sandbox network',
      description:
        'The node reports {{network}}. The sandbox keeps passphrases in plain text and only does that on its own mock chain, so accounts and sending are switched off.',
    },
  },
} as const
```

- [ ] **Step 2: Add the same catalogue to German**

Replace `src/i18n/locales/de.ts` with the same structure, translated:

```ts
export default {
  tagline: 'Eine Signum-Chain zum Wegwerfen. Kaputtmachen, zurücksetzen, von vorn.',
  status: { live: 'live', polling: 'Abfrage', offline: 'offline', scanning: 'Scan läuft' },
  panel: { nodeState: 'Node-Zustand' },
  tile: { height: 'Blockhöhe', lastBlock: 'Letzter Block' },
  entry: {
    apiDocs: { title: 'API-Doku', description: 'Die komplette JSON-API interaktiv ausprobieren' },
    dashboard: { title: 'Sandbox', description: 'Blöcke forgen, Transaktionen senden, die Chain inspizieren' },
    comingSoon: 'kommt als Nächstes',
  },
  unreachable: { title: 'Kein Node auf {{host}}', description: 'Starte ihn mit ./scripts/start.sh' },
  console: {
    back: 'Startseite',
    tab: { transactions: 'Transaktionen', blocks: 'Blöcke', accounts: 'Accounts' },
    search: { placeholder: 'ID, Adresse oder Name' },
    forge: { action: 'Forgen', requested: 'Block angefordert', auto: 'auto', forger: 'Forger' },
    empty: {
      title: 'Noch ist nichts passiert',
      description: 'Lege einen Account an und forge einen Block, um ihn zu füllen.',
    },
    drawer: { send: 'Senden', chain: 'Chain', help: 'Hilfe', close: 'Schließen' },
    tx: {
      unconfirmed: 'unbestätigt',
      block: 'Block {{height}}',
      raw: 'Rohantwort',
      fee: 'Gebühr',
      undecryptable: 'Verschlüsselt — die Sandbox hat keinen der beiden Schlüssel',
      none: 'Noch keine Transaktionen',
    },
    kind: {
      payment: 'Zahlung',
      multiOut: 'Multi-Out',
      message: 'Nachricht',
      encryptedMessage: 'Verschlüsselte Nachricht',
      accountInfo: 'Account-Info',
      tokenIssue: 'Token ausgegeben',
      tokenTransfer: 'Token-Transfer',
      alias: 'Alias',
      subscription: 'Subscription',
      reward: 'Blockprämie',
      other: 'Transaktion',
    },
    blocks: { count: '{{count}} Transaktionen', empty: 'Leer', forger: 'Forger' },
    accounts: {
      create: 'Account anlegen',
      import: 'Passphrase importieren',
      name: 'Name',
      passphrase: 'Passphrase',
      balance: 'Guthaben',
      remove: 'Entfernen',
      forger: 'Forger',
      notOnChain: 'Noch nicht auf der Chain — erscheint, sobald er etwas empfängt',
      fake: 'Bewusst unecht — niemals außerhalb der Sandbox verwenden',
      none: 'Noch keine Accounts',
    },
    send: {
      from: 'Von',
      to: 'An',
      amount: 'Betrag',
      fee: 'Gebühr',
      message: 'Nachricht',
      attach: 'Nachricht anhängen',
      encrypt: 'Verschlüsseln',
      submit: 'Absenden',
      sent: 'Gesendet — erscheint als unbestätigt',
      recipients: 'Empfänger',
      recipientHint: 'Einer pro Zeile: Adresse, Betrag',
      tokenName: 'Token-Name',
      tokenQuantity: 'Menge',
      tokenDecimals: 'Nachkommastellen',
      tokenDescription: 'Beschreibung',
      token: 'Token',
      aliasName: 'Alias-Name',
      aliasContent: 'Inhalt',
      infoName: 'Name',
      infoDescription: 'Beschreibung',
      frequency: 'Alle (Sekunden)',
      needsPublicKey: 'Der Empfänger muss auf der Chain oder der Sandbox bekannt sein',
    },
    chain: {
      reset: 'Chain zurücksetzen',
      resetConfirm: 'Das löscht jeden Block, Account und jede Transaktion. Fortfahren?',
      resetDone: 'Die Chain steht wieder am Anfang',
      resetManual: 'Keiner der beiden Reset-Aufrufe hat funktioniert. Führe ./scripts/reset.sh aus',
      height: 'Höhe',
    },
    guard: {
      title: 'Das ist nicht das Sandbox-Netz',
      description:
        'Der Node meldet {{network}}. Die Sandbox hält Passphrases im Klartext und tut das nur auf ihrer eigenen Mock-Chain — Accounts und Senden sind deshalb abgeschaltet.',
    },
  },
} as const
```

- [ ] **Step 3: Add the same key set to the remaining eight locales**

Give `es.ts`, `pt.ts`, `uk.ts`, `ru.ts`, `zh.ts`, `ja.ts`, `ko.ts` and `hi.ts` the identical structure with translated values, using the English above as the source text. Keep the existing style of each file. Do not leave English strings in place as a stand-in — the parity test only checks keys, so it cannot catch that, and an untranslated locale is worse than an obviously missing one.

- [ ] **Step 4: Run the parity test**

Run: `bun run test src/i18n/locales/locales.test.ts`
Expected: PASS, 9 tests — one per non-English locale.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "i18n: the console string catalogue in ten locales"
```

> **For every later task:** if you need a string that is not in this catalogue, add it to all ten locales in the same commit. The parity test will fail otherwise.

---

## Task 6: The console route and shell

**Files:**
- Create: `src/routes/console.tsx`
- Create: `src/components/console/ConsoleShell.tsx`
- Create: `src/components/console/index.ts`
- Modify: `src/router.tsx`
- Modify: `src/components/startpage/EntryList.tsx`

- [ ] **Step 1: Create the shell**

Create `src/components/console/ConsoleShell.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'

export type ConsoleTab = 'transactions' | 'blocks' | 'accounts'

const TABS: ConsoleTab[] = ['transactions', 'blocks', 'accounts']

export function ConsoleShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConsoleTab>('transactions')

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="text-[10px] tracking-[2px] text-[var(--muted)] hover:text-[var(--blue3)]">
          ← {t('console.back')}
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className="border px-3 py-1 text-[10px] font-bold uppercase tracking-[1px]"
            style={{
              borderColor: tab === name ? 'var(--blue2)' : 'var(--border2)',
              background: tab === name ? 'rgba(0,102,255,.18)' : 'transparent',
              color: tab === name ? 'var(--blue3)' : 'var(--muted)',
            }}
          >
            {t(`console.tab.${name}`)}
          </button>
        ))}
      </div>

      <div className="min-h-[320px] border p-3" style={{ borderColor: 'var(--border2)' }}>
        {tab}
      </div>
    </div>
  )
}
```

The stage currently renders the tab name. Tasks 12, 13 and 14 replace that with the three views; keeping it a visible placeholder rather than an empty box makes it obvious in the browser that switching works.

- [ ] **Step 2: Create the barrel and the route**

Create `src/components/console/index.ts`:

```ts
export { ConsoleShell, type ConsoleTab } from './ConsoleShell'
```

Create `src/routes/console.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ConsoleShell } from '@/components/console'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/console',
  component: ConsoleShell,
})
```

- [ ] **Step 3: Register the route**

In `src/router.tsx`, add the import and put the route into the tree:

```tsx
import { Route as consoleRoute } from './routes/console'

const routeTree = rootRoute.addChildren([indexRoute, consoleRoute])
```

- [ ] **Step 4: Activate the start page entry**

In `src/components/startpage/EntryList.tsx`, the second `Entry` is disabled and badged. Replace it with a live link:

```tsx
      <Entry
        title={t('entry.dashboard.title')}
        description={t('entry.dashboard.description')}
        href="#/console"
      />
```

The `badge` and `disabled` props stay on the `Entry` component — the next placeholder entry will want them.

- [ ] **Step 5: Verify**

Run: `bun run build`
Expected: exits 0.

Then, with the node running, run `bun run dev` and open `http://localhost:5173`. Click the Sandbox entry. Expected: the URL becomes `#/console`, three tab buttons appear, clicking each changes the highlighted button and the text in the box, and "← Start page" navigates back.

- [ ] **Step 6: Commit**

```bash
git add src/routes/console.tsx src/components/console src/router.tsx src/components/startpage/EntryList.tsx
git commit -m "feat: the console route and its shell"
```

---

## Task 7: The account store hook and the Accounts view

**Files:**
- Create: `src/hooks/useAccounts.ts`
- Create: `src/components/console/Identicon.tsx`
- Create: `src/components/console/views/AccountsView.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`
- Modify: `src/components/console/index.ts`

- [ ] **Step 1: Write the store hook**

Create `src/hooks/useAccounts.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { generateMnemonic } from '@signumjs/crypto'
import { ledger } from '@/lib/ledger'
import { isMockNetwork } from '@/lib/network'
import {
  addAccount,
  deriveAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
  type SandboxAccount,
} from '@/lib/accounts'

const STORAGE_KEY = 'signum-sandbox.accounts.v1'
const FORGER_KEY = 'signum-sandbox.forger.v1'

export interface AccountStore {
  /** False when the node is not the mock network; then nothing else may be used. */
  available: boolean
  /** The network the node reported, for the message shown when unavailable. */
  networkName: string | undefined
  accounts: SandboxAccount[]
  forgerId: string | null
  forger: SandboxAccount | undefined
  create: (name: string) => SandboxAccount
  importPassphrase: (name: string, passphrase: string) => SandboxAccount
  remove: (id: string) => void
  setForger: (id: string) => void
}

export function useAccounts(): AccountStore {
  const network = useQuery({
    queryKey: ['networkInfo'],
    queryFn: () => ledger.network.getNetworkInfo(),
    staleTime: Infinity,
    retry: false,
  })

  const available = isMockNetwork(network.data?.networkName)
  const prefix = network.data?.addressPrefix ?? 'TS'

  const [accounts, setAccounts] = useState<SandboxAccount[]>([])
  const [forgerId, setForgerId] = useState<string | null>(null)

  // Reading storage is deferred until the network is known: on a foreign node
  // the passphrases must not even be loaded into memory.
  useEffect(() => {
    if (!available) {
      setAccounts([])
      setForgerId(null)
      return
    }
    setAccounts(parseAccounts(window.localStorage.getItem(STORAGE_KEY)))
    setForgerId(window.localStorage.getItem(FORGER_KEY))
  }, [available])

  const persist = useCallback((list: SandboxAccount[]) => {
    setAccounts(list)
    window.localStorage.setItem(STORAGE_KEY, serializeAccounts(list))
  }, [])

  const store = useCallback(
    (name: string, passphrase: string) => {
      const account = deriveAccount(name, passphrase, prefix)
      persist(addAccount(accounts, account))
      return account
    },
    [accounts, persist, prefix],
  )

  return {
    available,
    networkName: network.data?.networkName,
    accounts,
    forgerId,
    forger: accounts.find((a) => a.id === forgerId),
    // A real mnemonic, not a toy passphrase: this is the one a person might
    // later meet outside the sandbox, and it should look like what it is.
    create: (name) => store(name, generateMnemonic()),
    importPassphrase: (name, passphrase) => store(name, passphrase),
    remove: (id) => persist(removeAccount(accounts, id)),
    setForger: (id) => {
      setForgerId(id)
      window.localStorage.setItem(FORGER_KEY, id)
    },
  }
}
```

- [ ] **Step 2: Write the identicon**

Create `src/components/console/Identicon.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { hashicon } from 'hashicon'

/**
 * hashicon renders into a canvas element. Pinned at 0.3.0 so the same address
 * produces the same picture here as in the Signum wallets.
 */
export function Identicon({ value, size = 20 }: { value: string; size?: number }) {
  const host = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    node.replaceChildren(hashicon(value, { size }))
  }, [value, size])

  return <span ref={host} style={{ width: size, height: size, display: 'inline-block' }} />
}
```

- [ ] **Step 3: Write the Accounts view**

Create `src/components/console/views/AccountsView.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountStore } from '@/hooks/useAccounts'
import { Identicon } from '../Identicon'

export function AccountsView({ store }: { store: AccountStore }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')

  if (!store.available) {
    return (
      <div className="p-4">
        <p className="text-[12px] font-bold text-[var(--blue3)]">{t('console.guard.title')}</p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          {t('console.guard.description', { network: store.networkName ?? '—' })}
        </p>
      </div>
    )
  }

  const field = 'border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]'
  const button = 'border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]'
  const border = { borderColor: 'var(--border2)' }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={field}
          style={border}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('console.accounts.name')}
        />
        <button
          className={button}
          style={border}
          onClick={() => {
            if (!name.trim()) return
            store.create(name.trim())
            setName('')
          }}
        >
          {t('console.accounts.create')}
        </button>
        <input
          className={field}
          style={border}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={t('console.accounts.passphrase')}
        />
        <button
          className={button}
          style={border}
          onClick={() => {
            if (!name.trim() || !passphrase.trim()) return
            store.importPassphrase(name.trim(), passphrase.trim())
            setName('')
            setPassphrase('')
          }}
        >
          {t('console.accounts.import')}
        </button>
      </div>

      {store.accounts.length === 0 && (
        <p className="text-[11px] text-[var(--muted)]">{t('console.accounts.none')}</p>
      )}

      <ul>
        {store.accounts.map((account) => (
          <li
            key={account.id}
            className="flex items-center gap-3 border-b py-2 text-[11px]"
            style={{ borderColor: 'var(--border2)' }}
          >
            <Identicon value={account.address} />
            <span className="font-bold text-[var(--blue3)]">{account.name}</span>
            <span className="text-[var(--muted)]">{account.address}</span>
            <span className="ml-auto flex items-center gap-2">
              <button
                className={button}
                style={border}
                onClick={() => store.setForger(account.id)}
              >
                {store.forgerId === account.id ? `★ ${t('console.accounts.forger')}` : t('console.accounts.forger')}
              </button>
              <button className={button} style={border} onClick={() => store.remove(account.id)}>
                {t('console.accounts.remove')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Balances and on-chain state join this view in Task 14, once the chain queries exist.

- [ ] **Step 4: Wire it into the shell**

In `src/components/console/ConsoleShell.tsx`, import the hook and the view, call the hook in the component, and replace `{tab}` inside the stage with:

```tsx
        {tab === 'accounts' ? <AccountsView store={accounts} /> : tab}
```

Add at the top of the component body:

```tsx
  const accounts = useAccounts()
```

and the imports:

```tsx
import { useAccounts } from '@/hooks/useAccounts'
import { AccountsView } from './views/AccountsView'
```

- [ ] **Step 5: Verify**

Run: `bun run build`
Expected: exits 0.

Then in the browser on `#/console`, Accounts tab: type a name, press Create. Expected: a row appears with an identicon and a `TS-…` address. Reload the page — the row is still there. Press Forger on it — the button shows a star. Press Remove — the row disappears and stays gone after a reload.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAccounts.ts src/components/console
git commit -m "feat: the account store and the accounts view"
```

**Phase A checkpoint:** the console exists, has tabs, and manages accounts that survive a reload and refuse to load on a foreign network.

---

# Phase B — Chain control and inspection

## Task 8: Chain admin — the staged reset

**Files:**
- Modify: `conf/node.properties`
- Create: `src/lib/chainAdmin.ts`
- Test: `src/lib/chainAdmin.test.ts`

- [ ] **Step 1: Pin the admin key in the node configuration**

Append to `conf/node.properties`:

```properties
# The admin API (fullReset, popOff, clearUnconfirmedTransactions) is gated by a
# key. On an offline mock node there is nothing to protect, and a known key is
# what lets the sandbox offer reset as a button.
API.adminKeyList = sandbox
```

- [ ] **Step 2: Write the failing test for the reset plan**

The only genuinely decidable part is which stages to attempt. `popOff` reaches at most 1440 blocks back, so on a longer chain it cannot reach the start and must be skipped.

Create `src/lib/chainAdmin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resetPlan } from './chainAdmin'

describe('resetPlan', () => {
  it('rewinds with popOff on a short chain, and keeps fullReset behind it', () => {
    expect(resetPlan(200)).toEqual(['popOff', 'fullReset'])
  })

  it('still uses popOff exactly at the 1440-block reach', () => {
    expect(resetPlan(1441)).toEqual(['popOff', 'fullReset'])
  })

  it('skips popOff when it cannot reach the start', () => {
    expect(resetPlan(1442)).toEqual(['fullReset'])
  })

  it('has nothing to do on an empty chain', () => {
    expect(resetPlan(1)).toEqual([])
    expect(resetPlan(0)).toEqual([])
  })
})
```

The boundary: rewinding to height 1 from height `h` removes `h - 1` blocks, so `popOff` reaches when `h - 1 <= 1440`, that is `h <= 1441`.

- [ ] **Step 3: Run it and watch it fail**

Run: `bun run test src/lib/chainAdmin.test.ts`
Expected: FAIL — `Failed to resolve import "./chainAdmin"`.

- [ ] **Step 4: Implement**

Create `src/lib/chainAdmin.ts`:

```ts
import { ledger } from './ledger'

/** Matches API.adminKeyList in conf/node.properties. */
const ADMIN_KEY = 'sandbox'

/** popOff reaches at most 1440 blocks back. */
const POP_OFF_REACH = 1440

export type ResetStage = 'popOff' | 'fullReset'

/**
 * Reset walks these stages in order and stops at the first that works. popOff
 * is preferred because it needs no restart; on a chain too long for its reach
 * it cannot get back to the start, so it is not attempted at all.
 */
export function resetPlan(height: number): ResetStage[] {
  if (height <= 1) return []
  return height - 1 <= POP_OFF_REACH ? ['popOff', 'fullReset'] : ['fullReset']
}

/**
 * These requests have no typed SignumJS method, so they go through the generic
 * escape hatch the foundation spec reserved for exactly this. `send` is the
 * POST variant — `query` issues a GET, and the admin endpoints are POST-only.
 */
const admin = (requestType: string, params: Record<string, string> = {}) =>
  ledger.service.send(requestType, { ...params, apiKey: ADMIN_KEY })

/**
 * Forging deliberately omits accountId: passing it sends the node down its
 * passthrough-mining path, which fails once the passphrase's account exists.
 * The mock network accepts any nonce.
 */
export const forge = (secretPhrase: string) =>
  ledger.service.send('submitNonce', { secretPhrase, nonce: '0' })

export const popOffTo = (height: number) => admin('popOff', { height: String(height) })

export const fullReset = () => admin('fullReset')

export const clearUnconfirmed = () => admin('clearUnconfirmedTransactions')

export type ResetOutcome = { succeeded: ResetStage } | { succeeded: null }

/**
 * Attempts each stage of the plan and reports which one worked. A null result
 * means the caller has to tell the user to run scripts/reset.sh — silently
 * doing nothing after a confirmed destructive action is the worst outcome here.
 */
export async function resetChain(height: number): Promise<ResetOutcome> {
  for (const stage of resetPlan(height)) {
    try {
      if (stage === 'popOff') await popOffTo(1)
      else await fullReset()
      return { succeeded: stage }
    } catch {
      // Fall through to the next stage.
    }
  }
  return { succeeded: null }
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `bun run test src/lib/chainAdmin.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify the admin key against the running node**

Restart the node so it picks up the new property, then:

```bash
curl -s -X POST "http://localhost:6876/api?requestType=clearUnconfirmedTransactions&apiKey=sandbox"
```

Expected: an empty JSON object or a success response — **not** an "incorrect adminPassword" error. If it fails, the property name or value is wrong and nothing downstream will work; fix it before continuing.

- [ ] **Step 7: Commit**

```bash
git add conf/node.properties src/lib/chainAdmin.ts src/lib/chainAdmin.test.ts
git commit -m "feat: admin calls and the staged chain reset"
```

---

## Task 9: The reset script

**Files:**
- Create: `scripts/reset.sh`
- Modify: `README.md`

- [ ] **Step 1: Write the script**

Create `scripts/reset.sh`:

```bash
#!/usr/bin/env bash
# Last-resort chain reset: stop the node, drop its database, start it again.
# The console tries popOff and fullReset first; this is what it names when
# neither worked.
set -euo pipefail

cd "$(dirname "$0")/.."

if pgrep -f signum-node.jar >/dev/null; then
  echo "Stopping the node…"
  pkill -f signum-node.jar
  while pgrep -f signum-node.jar >/dev/null; do sleep 0.5; done
fi

echo "Removing db/…"
rm -rf db

echo "Starting the node…"
exec ./scripts/start.sh
```

- [ ] **Step 2: Make it executable and check the other scripts' conventions**

```bash
chmod +x scripts/reset.sh
head -5 scripts/start.sh
```

Expected: `start.sh` begins with the same `#!/usr/bin/env bash` and `set -euo pipefail`. If it does not, match whatever it actually does.

- [ ] **Step 3: Add it to the README command table**

In the table under "For developers", add a row after the `start.sh` row:

```markdown
| `./scripts/reset.sh` | stops the node, drops the chain, starts it again |
```

- [ ] **Step 4: Verify**

Run: `./scripts/reset.sh`
Expected: the node stops, `db/` disappears, the node starts, and `curl -s "http://localhost:6876/api?requestType=getBlockchainStatus"` reports `numberOfBlocks` of 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/reset.sh README.md
git commit -m "feat: the last-resort reset script"
```

---

## Task 10: Forging and auto-forge

**Files:**
- Create: `src/hooks/useForge.ts`
- Create: `src/components/console/Header.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`

- [ ] **Step 1: Write the forge hook**

Create `src/hooks/useForge.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { forge } from '@/lib/chainAdmin'
import type { SandboxAccount } from '@/lib/accounts'

/**
 * Roughly five seconds apart, each submitNonce yields exactly one block; faster
 * calls all report success but collapse into one, since they compete for the
 * same height. The auto interval respects that.
 */
const AUTO_INTERVAL_MS = 5000

export function useForge(forger: SandboxAccount | undefined) {
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)

  const forgeOnce = useCallback(async () => {
    if (!forger) return
    setBusy(true)
    try {
      await forge(forger.passphrase)
    } finally {
      setBusy(false)
    }
  }, [forger])

  useEffect(() => {
    if (!auto || !forger) return
    const id = setInterval(() => void forgeOnce(), AUTO_INTERVAL_MS)
    return () => clearInterval(id)
  }, [auto, forger, forgeOnce])

  return { forgeOnce, busy, auto, setAuto, canForge: forger !== undefined }
}
```

- [ ] **Step 2: Write the header**

Create `src/components/console/Header.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeState } from '@/lib/nodeState'
import type { AccountStore } from '@/hooks/useAccounts'
import { useForge } from '@/hooks/useForge'

export function Header({
  state,
  accounts,
  onOpenDrawer,
}: {
  state: Extract<NodeState, { kind: 'ready' }>
  accounts: AccountStore
  onOpenDrawer: (drawer: 'send' | 'chain' | 'help') => void
}) {
  const { t } = useTranslation()
  const { forgeOnce, busy, auto, setAuto, canForge } = useForge(accounts.forger)
  const [requested, setRequested] = useState(false)

  // submitNonce reports success even when several calls collapse into a single
  // block, so the button promises a request, not a block. The height beside it
  // is what actually answers whether one appeared.
  const forgeClicked = async () => {
    await forgeOnce()
    setRequested(true)
    setTimeout(() => setRequested(false), 3000)
  }

  const button = 'border px-3 py-1 text-[10px] uppercase tracking-[1px]'
  const border = { borderColor: 'var(--border2)' }

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-2 border p-3"
      style={border}
    >
      <span className="text-[11px]">
        <span className="font-bold text-[var(--blue3)]">{state.networkName ?? '—'}</span>
        <span className="text-[var(--muted)]">
          {' '}· {state.version ?? '—'} · {t(`status.${state.connection}`)} ·{' '}
          {t('console.chain.height')} {state.height ?? '—'}
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-2">
        <button
          className={button}
          style={{ ...border, color: canForge ? 'var(--blue3)' : 'var(--muted)' }}
          disabled={!canForge || busy}
          onClick={() => void forgeClicked()}
        >
          ⛏ {t('console.forge.action')}
        </button>

        {requested && (
          <span className="text-[10px] text-[var(--muted)]">{t('console.forge.requested')}</span>
        )}

        <select
          className="border bg-transparent px-2 py-1 text-[10px] text-[var(--fg)]"
          style={border}
          value={accounts.forgerId ?? ''}
          onChange={(e) => accounts.setForger(e.target.value)}
        >
          <option value="">{t('console.forge.forger')}</option>
          {accounts.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          {t('console.forge.auto')}
        </label>

        {(['send', 'chain', 'help'] as const).map((name) => (
          <button
            key={name}
            className={button}
            style={{ ...border, color: 'var(--blue3)' }}
            onClick={() => onOpenDrawer(name)}
          >
            {t(`console.drawer.${name}`)}
          </button>
        ))}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Wire the header into the shell**

In `ConsoleShell.tsx`: call `useNodeState`, hold the open drawer in state, render `Unreachable` when the node is not there, and put `Header` above the tabs. The component becomes:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { Unreachable } from '@/components/startpage'
import { Header } from './Header'
import { AccountsView } from './views/AccountsView'

export type ConsoleTab = 'transactions' | 'blocks' | 'accounts'
export type DrawerName = 'send' | 'chain' | 'help' | null

const TABS: ConsoleTab[] = ['transactions', 'blocks', 'accounts']

export function ConsoleShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConsoleTab>('transactions')
  const [drawer, setDrawer] = useState<DrawerName>(null)
  const { state, nodeAddress } = useNodeState()
  const accounts = useAccounts()

  if (state.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-3">
        <Link to="/" className="text-[10px] tracking-[2px] text-[var(--muted)] hover:text-[var(--blue3)]">
          ← {t('console.back')}
        </Link>
      </div>

      <Header state={state} accounts={accounts} onOpenDrawer={setDrawer} />

      <div className="mb-3 flex items-center gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className="border px-3 py-1 text-[10px] font-bold uppercase tracking-[1px]"
            style={{
              borderColor: tab === name ? 'var(--blue2)' : 'var(--border2)',
              background: tab === name ? 'rgba(0,102,255,.18)' : 'transparent',
              color: tab === name ? 'var(--blue3)' : 'var(--muted)',
            }}
          >
            {t(`console.tab.${name}`)}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="min-h-[320px] flex-1 border p-3" style={{ borderColor: 'var(--border2)' }}>
          {tab === 'accounts' ? <AccountsView store={accounts} /> : tab}
        </div>
        {drawer && (
          <div className="w-[34%] border p-3" style={{ borderColor: 'var(--blue2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[1px] text-[var(--blue3)]">
                {t(`console.drawer.${drawer}`)}
              </span>
              <button className="text-[11px] text-[var(--muted)]" onClick={() => setDrawer(null)}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

`src/components/startpage/index.ts` currently exports only `StartPage`, so add the second export there rather than importing the file directly:

```ts
export { StartPage } from './StartPage'
export { Unreachable } from './Unreachable'
```

- [ ] **Step 4: Verify**

Run: `bun run build`
Expected: exits 0.

In the browser: the header shows the network name, version and height. Create an account, pick it as forger in the dropdown, press Forge. Expected: within a second or two the height in the header increases by one. Tick `auto` and watch the height climb roughly every five seconds; untick it and it stops. Each drawer button opens an empty panel on the right that closes with ✕.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useForge.ts src/components/console
git commit -m "feat: forging, auto-forge and the console header"
```

---

## Task 11: The chain feed

**Files:**
- Create: `src/lib/chainFeed.ts`
- Test: `src/lib/chainFeed.test.ts`
- Create: `src/hooks/useChainFeed.ts`
- Modify: `src/hooks/useNodeSocket.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/chainFeed.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeFeed, type FeedTransaction } from './chainFeed'

const tx = (id: string, timestamp: number, confirmations?: number): FeedTransaction =>
  ({ transaction: id, timestamp, confirmations }) as FeedTransaction

describe('mergeFeed', () => {
  it('puts unconfirmed transactions above confirmed ones regardless of time', () => {
    const feed = mergeFeed([tx('u1', 10)], [tx('c1', 999)])
    expect(feed.map((f) => f.id)).toEqual(['u1', 'c1'])
  })

  it('orders each group newest first', () => {
    const feed = mergeFeed([tx('u1', 5), tx('u2', 9)], [tx('c1', 1), tx('c2', 3)])
    expect(feed.map((f) => f.id)).toEqual(['u2', 'u1', 'c2', 'c1'])
  })

  it('marks which group each item came from', () => {
    const feed = mergeFeed([tx('u1', 5)], [tx('c1', 1)])
    expect(feed[0].confirmed).toBe(false)
    expect(feed[1].confirmed).toBe(true)
  })

  it('drops a transaction that appears in both, keeping the confirmed one', () => {
    const feed = mergeFeed([tx('x', 5)], [tx('x', 5, 1)])
    expect(feed).toHaveLength(1)
    expect(feed[0].confirmed).toBe(true)
  })

  it('survives a chain reset, where the confirmed set is suddenly empty', () => {
    expect(mergeFeed([], [])).toEqual([])
  })
})
```

The double-appearance case is real: a transaction stays in the unconfirmed list until the node has processed the block, so for a moment both calls return it.

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/lib/chainFeed.test.ts`
Expected: FAIL — `Failed to resolve import "./chainFeed"`.

- [ ] **Step 3: Implement**

Create `src/lib/chainFeed.ts`:

```ts
import type { Transaction } from '@signumjs/core'

export type FeedTransaction = Transaction

export interface FeedItem {
  id: string
  confirmed: boolean
  tx: FeedTransaction
}

const newestFirst = (a: FeedTransaction, b: FeedTransaction) => b.timestamp - a.timestamp

/**
 * A transaction lives in the unconfirmed list until the node has digested the
 * block containing it, so during that window both sources return it. The
 * confirmed copy wins: it is the one carrying a block height.
 */
export function mergeFeed(
  unconfirmed: FeedTransaction[],
  confirmed: FeedTransaction[],
): FeedItem[] {
  const confirmedIds = new Set(confirmed.map((t) => t.transaction))
  return [
    ...[...unconfirmed]
      .filter((t) => !confirmedIds.has(t.transaction))
      .sort(newestFirst)
      .map((tx) => ({ id: tx.transaction, confirmed: false, tx })),
    ...[...confirmed].sort(newestFirst).map((tx) => ({ id: tx.transaction, confirmed: true, tx })),
  ]
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `bun run test src/lib/chainFeed.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the feed hook**

Create `src/hooks/useChainFeed.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { Block, Transaction } from '@signumjs/core'
import { ledger } from '@/lib/ledger'
import { mergeFeed, type FeedItem } from '@/lib/chainFeed'

/** How far back the console looks. A sandbox chain is short; this is generous. */
const RECENT_BLOCKS = 25

export function useBlocks(height: number | null) {
  return useQuery({
    queryKey: ['blocks', height],
    queryFn: async () => {
      const firstIndex = 0
      const lastIndex = RECENT_BLOCKS - 1
      const { blocks } = await ledger.block.getBlocks(firstIndex, lastIndex, true)
      return blocks
    },
    enabled: height !== null,
    retry: false,
  })
}

export function useChainFeed(height: number | null): {
  items: FeedItem[]
  blocks: Block[]
} {
  const blocks = useBlocks(height)

  const unconfirmed = useQuery({
    queryKey: ['unconfirmed'],
    queryFn: async () => {
      const { unconfirmedTransactions } = await ledger.transaction.getUnconfirmedTransactions()
      return unconfirmedTransactions
    },
    retry: false,
  })

  // Block.transactions is typed as string[] | Transaction[]: ids unless the
  // request asked for the whole objects, which ours does. The guard is what
  // makes that assumption explicit instead of a cast.
  const isTransaction = (t: string | Transaction): t is Transaction => typeof t !== 'string'
  const confirmed: Transaction[] = (blocks.data ?? []).flatMap((b) =>
    (b.transactions ?? []).filter(isTransaction),
  )

  return {
    items: mergeFeed(unconfirmed.data ?? [], confirmed),
    blocks: blocks.data ?? [],
  }
}
```

`getBlocks` with `includeTransactions = true` returns the transactions inline, which is why the feed needs no per-transaction fetch.

- [ ] **Step 6: Extend the socket invalidation**

`useNodeSocket` currently invalidates only `blockchainStatus`. Replace the `onmessage` body so both new query keys refresh:

```ts
      socket.onmessage = (event) => {
        const name = parseEvent(String(event.data))
        if (!isRefetchTrigger(name)) return
        void queryClient.invalidateQueries({ queryKey: ['blockchainStatus'] })
        void queryClient.invalidateQueries({ queryKey: ['unconfirmed'] })
        // Only a new block changes the block list; a pending transaction does not.
        if (name === 'BLOCK_PUSHED') {
          void queryClient.invalidateQueries({ queryKey: ['blocks'] })
        }
      }
```

- [ ] **Step 7: Verify**

Run: `bun run test && bun run build`
Expected: all tests pass, build exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/chainFeed.ts src/lib/chainFeed.test.ts src/hooks/useChainFeed.ts src/hooks/useNodeSocket.ts
git commit -m "feat: the merged chain feed and its invalidation"
```

---

## Task 12: Transaction summaries

**Files:**
- Create: `src/lib/txSummary.ts`
- Test: `src/lib/txSummary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/txSummary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Transaction } from '@signumjs/core'
import { summarize } from './txSummary'

const tx = (type: number, subtype: number, extra: Partial<Transaction> = {}) =>
  ({
    transaction: '1',
    type,
    subtype,
    timestamp: 1,
    amountNQT: '10000000000',
    feeNQT: '1000000',
    senderRS: 'TS-AAAA',
    recipientRS: 'TS-BBBB',
    ...extra,
  }) as Transaction

describe('summarize', () => {
  it('recognises an ordinary payment', () => {
    expect(summarize(tx(0, 0)).kind).toBe('payment')
  })

  it('recognises both multi-out flavours', () => {
    expect(summarize(tx(0, 1)).kind).toBe('multiOut')
    expect(summarize(tx(0, 2)).kind).toBe('multiOut')
  })

  it('separates a plain message from an encrypted one', () => {
    expect(summarize(tx(1, 0, { attachment: { message: 'hi' } })).kind).toBe('message')
    expect(
      summarize(tx(1, 0, { attachment: { encryptedMessage: { data: 'ab', nonce: 'cd' } } })).kind,
    ).toBe('encryptedMessage')
  })

  it('recognises alias, account info, token issuance, token transfer and subscription', () => {
    expect(summarize(tx(1, 1)).kind).toBe('alias')
    expect(summarize(tx(1, 5)).kind).toBe('accountInfo')
    expect(summarize(tx(2, 0)).kind).toBe('tokenIssue')
    expect(summarize(tx(2, 1)).kind).toBe('tokenTransfer')
    expect(summarize(tx(21, 3)).kind).toBe('subscription')
  })

  it('calls a transaction without a sender a block reward', () => {
    expect(summarize(tx(0, 0, { senderRS: undefined })).kind).toBe('reward')
  })

  it('falls back to other rather than throwing on an unknown type', () => {
    expect(summarize(tx(3, 0)).kind).toBe('other')
  })

  it('reports the amount in SIGNA, not planck', () => {
    expect(summarize(tx(0, 0)).amountSigna).toBe('100')
  })

  it('reports no amount for a transaction that moves nothing', () => {
    expect(summarize(tx(1, 1, { amountNQT: '0' })).amountSigna).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/lib/txSummary.test.ts`
Expected: FAIL — `Failed to resolve import "./txSummary"`.

- [ ] **Step 3: Implement**

Create `src/lib/txSummary.ts`:

```ts
import {
  TransactionType,
  TransactionPaymentSubtype,
  TransactionArbitrarySubtype,
  TransactionAssetSubtype,
  TransactionAdvancedPaymentSubtype,
  type Transaction,
} from '@signumjs/core'
import { Amount } from '@signumjs/util'

export type TxKind =
  | 'payment'
  | 'multiOut'
  | 'message'
  | 'encryptedMessage'
  | 'accountInfo'
  | 'tokenIssue'
  | 'tokenTransfer'
  | 'alias'
  | 'subscription'
  | 'reward'
  | 'other'

export interface TxSummary {
  kind: TxKind
  senderRS: string | null
  recipientRS: string | null
  /** Null when the transaction moves no SIGNA, so the row stays quiet about it. */
  amountSigna: string | null
}

const attachment = (tx: Transaction) => (tx.attachment ?? {}) as Record<string, unknown>

function kindOf(tx: Transaction): TxKind {
  // A block reward has no sender: the chain itself credited the forger.
  if (!tx.senderRS) return 'reward'

  switch (tx.type) {
    case TransactionType.Payment:
      return tx.subtype === TransactionPaymentSubtype.Ordinary ? 'payment' : 'multiOut'
    case TransactionType.Arbitrary:
      if (tx.subtype === TransactionArbitrarySubtype.AliasAssignment) return 'alias'
      if (tx.subtype === TransactionArbitrarySubtype.AccountInfo) return 'accountInfo'
      if (tx.subtype === TransactionArbitrarySubtype.Message) {
        return attachment(tx).encryptedMessage ? 'encryptedMessage' : 'message'
      }
      return 'other'
    case TransactionType.Asset:
      if (tx.subtype === TransactionAssetSubtype.AssetIssuance) return 'tokenIssue'
      if (tx.subtype === TransactionAssetSubtype.AssetTransfer) return 'tokenTransfer'
      return 'other'
    case TransactionType.AdvancedPayment:
      return tx.subtype === TransactionAdvancedPaymentSubtype.SubscriptionSubscribe
        ? 'subscription'
        : 'other'
    default:
      return 'other'
  }
}

export function summarize(tx: Transaction): TxSummary {
  const planck = tx.amountNQT ?? '0'
  return {
    kind: kindOf(tx),
    senderRS: tx.senderRS ?? null,
    recipientRS: tx.recipientRS ?? null,
    amountSigna: planck === '0' ? null : Amount.fromPlanck(planck).getSigna(),
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `bun run test src/lib/txSummary.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/txSummary.ts src/lib/txSummary.test.ts
git commit -m "feat: transaction summaries for the feed rows"
```

---

## Task 13: Payload decoding

**Files:**
- Create: `src/lib/payload.ts`
- Test: `src/lib/payload.test.ts`

The detail view exists to open the payload. This module turns an attachment into labelled fields, and says so plainly when it cannot.

- [ ] **Step 1: Write the failing test**

Create `src/lib/payload.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Transaction } from '@signumjs/core'
import { decodePayload } from './payload'

const tx = (attachment: Record<string, unknown>) =>
  ({ transaction: '1', type: 1, subtype: 0, attachment }) as unknown as Transaction

describe('decodePayload', () => {
  it('returns the plain text of a message', () => {
    expect(decodePayload(tx({ message: 'shall we meet at six?' }))).toEqual([
      { label: 'message', value: 'shall we meet at six?' },
    ])
  })

  it('says an encrypted message is unreadable rather than showing ciphertext', () => {
    expect(decodePayload(tx({ encryptedMessage: { data: 'ab', nonce: 'cd' } }))).toEqual([
      { label: 'encrypted', value: null },
    ])
  })

  it('unfolds an SRC44 description into its fields', () => {
    const fields = decodePayload(tx({ description: '{"vs":1,"nm":"Pizza Coin","ds":"cheesy"}' }))
    expect(fields).toEqual([
      { label: 'name', value: 'Pizza Coin' },
      { label: 'description', value: 'cheesy' },
    ])
  })

  it('keeps a non-SRC44 description as plain text', () => {
    expect(decodePayload(tx({ description: 'just a sentence' }))).toEqual([
      { label: 'description', value: 'just a sentence' },
    ])
  })

  it('lists multi-out recipients', () => {
    const fields = decodePayload(
      tx({ recipients: [['123', '100000000'], ['456', '200000000']] }),
    )
    expect(fields).toEqual([
      { label: 'recipients', value: '123: 1 SIGNA, 456: 2 SIGNA' },
    ])
  })

  it('describes a subscription by its interval', () => {
    expect(decodePayload(tx({ frequency: 3600 }))).toEqual([
      { label: 'frequency', value: 'every 3600 s' },
    ])
  })

  it('returns nothing for an empty attachment', () => {
    expect(decodePayload(tx({}))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/lib/payload.test.ts`
Expected: FAIL — `Failed to resolve import "./payload"`.

- [ ] **Step 3: Implement**

Create `src/lib/payload.ts`:

```ts
import type { Transaction } from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { DescriptorData } from '@signumjs/standards'

export interface PayloadField {
  label: string
  /** Null means "present but not readable" — the detail view says so in words. */
  value: string | null
}

const asRecord = (tx: Transaction) => (tx.attachment ?? {}) as Record<string, unknown>

/**
 * SRC44 travels inside the ordinary description field as JSON. Parsing through
 * the reference implementation rather than JSON.parse is what makes "is this
 * SRC44?" the same question here as everywhere else in the ecosystem.
 */
function src44Fields(description: string): PayloadField[] | null {
  try {
    const data = DescriptorData.parse(description, false)
    const fields: PayloadField[] = []
    if (data.name) fields.push({ label: 'name', value: data.name })
    if (data.description) fields.push({ label: 'description', value: data.description })
    return fields.length > 0 ? fields : null
  } catch {
    return null
  }
}

export function decodePayload(tx: Transaction): PayloadField[] {
  const a = asRecord(tx)
  const fields: PayloadField[] = []

  if (typeof a.message === 'string') {
    fields.push({ label: 'message', value: a.message })
  }

  if (a.encryptedMessage) {
    // Decryption needs one of the two agreement keys plus the counterpart's
    // public key. The console only has that for its own accounts, and the
    // caller has not offered them here, so the honest answer is "not readable".
    fields.push({ label: 'encrypted', value: null })
  }

  if (typeof a.description === 'string') {
    fields.push(...(src44Fields(a.description) ?? [{ label: 'description', value: a.description }]))
  }

  if (Array.isArray(a.recipients)) {
    const list = (a.recipients as [string, string][])
      .map(([id, planck]) => `${id}: ${Amount.fromPlanck(planck).getSigna()} SIGNA`)
      .join(', ')
    fields.push({ label: 'recipients', value: list })
  }

  if (typeof a.frequency === 'number') {
    fields.push({ label: 'frequency', value: `every ${a.frequency} s` })
  }

  return fields
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `bun run test src/lib/payload.test.ts`
Expected: PASS, 7 tests. If `DescriptorData.parse` rejects the two-field JSON in the test, check its signature in `node_modules/@signumjs/standards/out/src44/DescriptorData.d.ts` and adjust the call — not the expectation.

- [ ] **Step 5: Write the failing test for decryption**

The spec asks for an encrypted message to be shown in clear text when the sandbox holds one of the two keys. Decryption is symmetric over the shared secret: either side can do it with their own agreement key and the other side's public key. Append to `src/lib/payload.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { Crypto, encryptMessage, generateSignKeys } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import { Address } from '@signumjs/core'
import { decryptFor } from './payload'
import type { SandboxAccount } from './accounts'

beforeAll(() => Crypto.init(new NodeJSCryptoAdapter()))

const account = (name: string, passphrase: string): SandboxAccount => {
  const { publicKey } = generateSignKeys(passphrase)
  const address = Address.fromPublicKey(publicKey, 'TS')
  return { id: address.getNumericId(), address: address.getReedSolomonAddress(true), name, passphrase }
}

describe('decryptFor', () => {
  const alice = account('Alice', 'sandbox-alice')
  const bob = account('Bob', 'sandbox-bob')

  const encryptedTx = async () => {
    const message = await encryptMessage(
      'shall we meet at six?',
      generateSignKeys(bob.passphrase).publicKey,
      generateSignKeys(alice.passphrase).agreementPrivateKey,
    )
    return {
      transaction: '1',
      type: 1,
      subtype: 0,
      sender: alice.id,
      senderPublicKey: generateSignKeys(alice.passphrase).publicKey,
      recipient: bob.id,
      attachment: { encryptedMessage: message },
    } as unknown as Transaction
  }

  it('reads the message when the sandbox owns the recipient', async () => {
    expect(await decryptFor(await encryptedTx(), [bob])).toBe('shall we meet at six?')
  })

  it('reads its own outgoing message when it owns both ends', async () => {
    expect(await decryptFor(await encryptedTx(), [alice, bob])).toBe('shall we meet at six?')
  })

  it('returns null when it owns neither side', async () => {
    expect(await decryptFor(await encryptedTx(), [])).toBeNull()
  })

  it('returns null for a transaction that carries no encrypted message', async () => {
    expect(await decryptFor(tx({ message: 'plain' }), [alice, bob])).toBeNull()
  })
})
```

Add `import type { Transaction } from '@signumjs/core'` at the top of the file if the existing import does not already cover it.

- [ ] **Step 6: Implement decryption**

Append to `src/lib/payload.ts`:

```ts
import { decryptMessage, generateSignKeys } from '@signumjs/crypto'
import type { SandboxAccount } from './accounts'

interface EncryptedRef {
  data: string
  nonce: string
  isText: boolean
}

function encryptedMessageOf(tx: Transaction): EncryptedRef | null {
  const raw = asRecord(tx).encryptedMessage
  if (!raw || typeof raw !== 'object') return null
  const { data, nonce, isText } = raw as Record<string, unknown>
  if (typeof data !== 'string' || typeof nonce !== 'string') return null
  return { data, nonce, isText: isText !== false }
}

/**
 * Tries both ends: the sandbox may own the recipient, the sender, both, or
 * neither. Null means "we genuinely cannot read this", which the detail view
 * says in words rather than showing ciphertext.
 */
export async function decryptFor(
  tx: Transaction,
  accounts: SandboxAccount[],
): Promise<string | null> {
  const message = encryptedMessageOf(tx)
  if (!message) return null

  const owned = (id: string | undefined) => accounts.find((a) => a.id === id)
  const recipient = owned(tx.recipient)
  const sender = owned(tx.sender)

  const attempt = async (own: SandboxAccount, counterpartPublicKey: string | undefined) => {
    if (!counterpartPublicKey) return null
    try {
      return await decryptMessage(
        message,
        counterpartPublicKey,
        generateSignKeys(own.passphrase).agreementPrivateKey,
      )
    } catch {
      return null
    }
  }

  if (recipient) {
    const text = await attempt(recipient, tx.senderPublicKey)
    if (text !== null) return text
  }
  if (sender && recipient) {
    return attempt(sender, generateSignKeys(recipient.passphrase).publicKey)
  }
  return null
}
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `bun run test src/lib/payload.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/payload.ts src/lib/payload.test.ts
git commit -m "feat: payload decoding and message decryption"
```

---

## Task 14: The three views

**Files:**
- Create: `src/components/console/views/TransactionRow.tsx`
- Create: `src/components/console/views/TransactionsView.tsx`
- Create: `src/components/console/views/BlocksView.tsx`
- Modify: `src/components/console/views/AccountsView.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`

- [ ] **Step 1: The transaction row with its inline detail**

Create `src/components/console/views/TransactionRow.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nodeHost } from '@/lib/ledger'
import { useQuery } from '@tanstack/react-query'
import { decodePayload, decryptFor } from '@/lib/payload'
import type { SandboxAccount } from '@/lib/accounts'
import { summarize } from '@/lib/txSummary'
import type { FeedItem } from '@/lib/chainFeed'

export function TransactionRow({
  item,
  accounts,
}: {
  item: FeedItem
  accounts: SandboxAccount[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const summary = summarize(item.tx)
  const fields = decodePayload(item.tx)

  // Decryption is asynchronous and only attempted once the row is open, so a
  // long stream does not do crypto work for rows nobody looked at.
  const decrypted = useQuery({
    queryKey: ['decrypt', item.id, accounts.length],
    queryFn: () => decryptFor(item.tx, accounts),
    enabled: open,
    retry: false,
  })

  return (
    <li className="border-b" style={{ borderColor: 'var(--border2)' }}>
      <button
        className="flex w-full items-center justify-between py-2 text-left text-[11px]"
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className="text-[var(--muted)]">{open ? '▾' : '▸'} </span>
          <span className="font-bold text-[var(--blue3)]">{t(`console.kind.${summary.kind}`)}</span>
          <span className="text-[var(--muted)]">
            {' '}{summary.senderRS ?? '—'}
            {summary.recipientRS ? ` → ${summary.recipientRS}` : ''}
            {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
          </span>
        </span>
        <span className={item.confirmed ? 'text-[var(--muted)]' : 'text-[var(--blue3)]'}>
          {item.confirmed
            ? t('console.tx.block', { height: item.tx.height ?? '—' })
            : t('console.tx.unconfirmed')}
        </span>
      </button>

      {open && (
        <div
          className="mb-2 border-l-2 py-2 pl-3 text-[11px]"
          style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
        >
          {fields.map((field) => (
            <div key={field.label} className="flex gap-3">
              <span className="min-w-[100px] text-[var(--muted)]">{field.label}</span>
              <span>
                {field.value ??
                  (field.label === 'encrypted' && decrypted.data
                    ? decrypted.data
                    : t('console.tx.undecryptable'))}
              </span>
            </div>
          ))}
          <div className="flex gap-3">
            <span className="min-w-[100px] text-[var(--muted)]">{t('console.tx.raw')}</span>
            <a
              className="text-[var(--blue3)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getTransaction&transaction=${item.tx.transaction}`}
            >
              ↗ getTransaction
            </a>
          </div>
        </div>
      )}
    </li>
  )
}
```

- [ ] **Step 2: The transactions view**

Create `src/components/console/views/TransactionsView.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { FeedItem } from '@/lib/chainFeed'
import type { SandboxAccount } from '@/lib/accounts'
import { TransactionRow } from './TransactionRow'

export function TransactionsView({
  items,
  accounts,
}: {
  items: FeedItem[]
  accounts: SandboxAccount[]
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[12px] font-bold text-[var(--blue3)]">{t('console.empty.title')}</p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">{t('console.empty.description')}</p>
      </div>
    )
  }

  return (
    <ul>
      {items.map((item) => (
        <TransactionRow key={item.id} item={item} accounts={accounts} />
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: The blocks view**

Create `src/components/console/views/BlocksView.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { Block } from '@signumjs/core'
import { nodeHost } from '@/lib/ledger'

export function BlocksView({
  blocks,
  onSelect,
}: {
  blocks: Block[]
  onSelect: (height: number) => void
}) {
  const { t } = useTranslation()

  return (
    <ul>
      {blocks.map((block) => {
        const count = block.numberOfTransactions
        return (
          <li
            key={block.block}
            className="flex items-center justify-between border-b py-2 text-[11px]"
            style={{ borderColor: 'var(--border2)' }}
          >
            <button className="text-left" onClick={() => onSelect(block.height)}>
              <span className="font-bold text-[var(--blue3)]">#{block.height}</span>
              <span className="text-[var(--muted)]">
                {' '}· {count === 0 ? t('console.blocks.empty') : t('console.blocks.count', { count })}
                {' '}· {t('console.blocks.forger')} {block.generatorRS}
              </span>
            </button>
            <a
              className="text-[var(--muted)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getBlock&height=${block.height}`}
            >
              ↗
            </a>
          </li>
        )
      })}
    </ul>
  )
}
```

Selecting a block hands its height to the shell, which is what Task 15 turns into a filter.

- [ ] **Step 4: Show balances in the accounts view**

`AccountsView` currently shows only stored data. Add a balance query. At the top of the file:

```tsx
import { useQuery } from '@tanstack/react-query'
import { Amount } from '@signumjs/util'
import { ledger } from '@/lib/ledger'
```

Add this component below `AccountsView`:

```tsx
function Balance({ id }: { id: string }) {
  const { t } = useTranslation()
  const balance = useQuery({
    queryKey: ['balance', id],
    queryFn: () => ledger.account.getAccountBalance(id),
    retry: false,
  })

  // An account that has never received anything does not exist on chain yet,
  // and the node answers with an error rather than a zero balance.
  if (balance.isError) {
    return <span className="text-[var(--muted)]">{t('console.accounts.notOnChain')}</span>
  }
  if (!balance.data) return null
  return <span>{Amount.fromPlanck(balance.data.balanceNQT).getSigna()} SIGNA</span>
}
```

and render it in the list row, before the button group:

```tsx
            <span className="text-[var(--muted)]"><Balance id={account.id} /></span>
```

- [ ] **Step 5: Wire the views into the shell**

In `ConsoleShell.tsx`, add the feed and render the real views:

```tsx
import { useChainFeed } from '@/hooks/useChainFeed'
import { TransactionsView } from './views/TransactionsView'
import { BlocksView } from './views/BlocksView'
```

In the component body, after `const accounts = useAccounts()`:

```tsx
  const feed = useChainFeed(state.kind === 'ready' ? state.height : null)
```

`useChainFeed` must be called before the `unreachable` early return, or the hook order changes between renders. Move the early return to after all hook calls: keep the `if (state.kind === 'unreachable')` block, but place it below every `use*` call in the function.

Replace the stage content with:

```tsx
          {tab === 'transactions' && (
            <TransactionsView items={feed.items} accounts={accounts.accounts} />
          )}
          {tab === 'blocks' && <BlocksView blocks={feed.blocks} onSelect={() => setTab('transactions')} />}
          {tab === 'accounts' && <AccountsView store={accounts} />}
```

- [ ] **Step 6: Verify**

Run: `bun run test && bun run build`
Expected: all tests pass, build exits 0.

In the browser: with a forger set, press Forge a few times. The Transactions tab shows block-reward rows; expanding one shows the raw link. The Blocks tab lists the blocks with their forger. The Accounts tab shows a balance for the forger account and "not on chain yet" for a freshly created one.

- [ ] **Step 7: Commit**

```bash
git add src/components/console
git commit -m "feat: the transactions, blocks and accounts views"
```

---

## Task 15: Search

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`
- Create: `src/components/console/views/SearchField.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`
- Modify: `src/components/console/views/TransactionsView.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { interpret, matchesTransaction } from './search'
import type { Transaction } from '@signumjs/core'

describe('interpret', () => {
  it('reads a small number as a block height', () => {
    expect(interpret('128')).toEqual({ kind: 'height', height: 128 })
  })

  it('reads a long number as an id, since heights do not get that big', () => {
    expect(interpret('13703929038484906594')).toEqual({
      kind: 'id',
      value: '13703929038484906594',
    })
  })

  it('reads a Reed-Solomon address as an address', () => {
    expect(interpret('TS-ABCD-EFGH-IJKL-MNOPQ')).toEqual({
      kind: 'address',
      value: 'TS-ABCD-EFGH-IJKL-MNOPQ',
    })
  })

  it('treats anything else as a name', () => {
    expect(interpret('pizza')).toEqual({ kind: 'name', value: 'pizza' })
  })

  it('treats blank input as no filter at all', () => {
    expect(interpret('   ')).toEqual({ kind: 'none' })
  })
})

const tx = (extra: Partial<Transaction>) =>
  ({ transaction: '99', senderRS: 'TS-AAAA', recipientRS: 'TS-BBBB', ...extra }) as Transaction

describe('matchesTransaction', () => {
  it('keeps everything when there is no filter', () => {
    expect(matchesTransaction(tx({}), { kind: 'none' })).toBe(true)
  })

  it('matches an address against sender and recipient', () => {
    expect(matchesTransaction(tx({}), { kind: 'address', value: 'TS-BBBB' })).toBe(true)
    expect(matchesTransaction(tx({}), { kind: 'address', value: 'TS-ZZZZ' })).toBe(false)
  })

  it('matches an id against the transaction id', () => {
    expect(matchesTransaction(tx({}), { kind: 'id', value: '99' })).toBe(true)
  })

  it('matches a height against the containing block', () => {
    expect(matchesTransaction(tx({ height: 128 }), { kind: 'height', height: 128 })).toBe(true)
    expect(matchesTransaction(tx({ height: 127 }), { kind: 'height', height: 128 })).toBe(false)
  })

  it('matches a name case-insensitively against the attachment', () => {
    expect(
      matchesTransaction(
        tx({ attachment: { name: 'Pizza Coin' } } as Partial<Transaction>),
        { kind: 'name', value: 'pizza' },
      ),
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/lib/search.test.ts`
Expected: FAIL — `Failed to resolve import "./search"`.

- [ ] **Step 3: Implement**

Create `src/lib/search.ts`:

```ts
import type { Transaction } from '@signumjs/core'

export type Query =
  | { kind: 'none' }
  | { kind: 'height'; height: number }
  | { kind: 'id'; value: string }
  | { kind: 'address'; value: string }
  | { kind: 'name'; value: string }

/**
 * A block height and an account id are both digits, so length decides: a
 * sandbox chain will not reach ten digits, and no Signum id is shorter.
 */
const ID_DIGITS = 10

/** One input, read differently depending on what it looks like. No syntax to learn. */
export function interpret(input: string): Query {
  const value = input.trim()
  if (!value) return { kind: 'none' }
  if (/^\d+$/.test(value)) {
    return value.length >= ID_DIGITS
      ? { kind: 'id', value }
      : { kind: 'height', height: Number(value) }
  }
  if (/^[A-Za-z]{1,4}-[A-Za-z0-9-]+$/.test(value)) return { kind: 'address', value }
  return { kind: 'name', value: value.toLowerCase() }
}

export function matchesTransaction(tx: Transaction, query: Query): boolean {
  switch (query.kind) {
    case 'none':
      return true
    case 'height':
      return tx.height === query.height
    case 'id':
      return tx.transaction === query.value
    case 'address':
      return tx.senderRS === query.value || tx.recipientRS === query.value
    case 'name': {
      const haystack = JSON.stringify(tx.attachment ?? {}).toLowerCase()
      return haystack.includes(query.value)
    }
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `bun run test src/lib/search.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: The search field**

Create `src/components/console/views/SearchField.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

export function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <input
      className="border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      style={{ borderColor: 'var(--border2)', minWidth: 220 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`🔍 ${t('console.search.placeholder')}`}
    />
  )
}
```

- [ ] **Step 6: Filter the transactions view**

Change `TransactionsView` to take a query and filter with it:

```tsx
import { matchesTransaction, type Query } from '@/lib/search'
```

Add `query` to the props it already has, so the signature becomes `{ items, accounts, query }: { items: FeedItem[]; accounts: SandboxAccount[]; query: Query }`, and before the empty check:

```tsx
  const shown = items.filter((item) => matchesTransaction(item.tx, query))
```

then render `shown` instead of `items`, and base the empty check on `shown.length === 0` while keeping the `console.empty` text only when `items.length === 0` — otherwise a filter that matches nothing tells the user the chain is empty. When `items` is non-empty but `shown` is empty, render `t('console.tx.none')`.

- [ ] **Step 7: Wire it into the shell**

In `ConsoleShell.tsx`:

```tsx
import { interpret } from '@/lib/search'
import { SearchField } from './views/SearchField'
```

```tsx
  const [search, setSearch] = useState('')
  const query = interpret(search)
```

Put `<SearchField value={search} onChange={setSearch} />` at the right end of the tab row (wrap the tab row in `flex items-center justify-between`), add `query={query}` to the existing `<TransactionsView items={…} accounts={…} />`, and make the blocks view's `onSelect` fill the field:

```tsx
          {tab === 'blocks' && (
            <BlocksView
              blocks={feed.blocks}
              onSelect={(height) => {
                setSearch(String(height))
                setTab('transactions')
              }}
            />
          )}
```

Filter the accounts list the same way inside `AccountsView` by passing `query` and keeping accounts whose name or address matches — for `kind: 'name'` compare against the lowercased name, for `kind: 'address'` against the address, and show everything for any other kind.

- [ ] **Step 8: Verify**

Run: `bun run test && bun run build`
Expected: all tests pass, build exits 0.

In the browser: type a block height into the field on the Transactions tab and only that block's transactions remain. Clear it and everything returns. On the Blocks tab, click a block — the tab switches to Transactions with the height already in the field.

- [ ] **Step 9: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts src/components/console
git commit -m "feat: one search field per view"
```

**Phase B checkpoint:** the chain can be driven and inspected. Everything but sending works.

---

# Phase C — The composer

## Task 16: The send library

**Files:**
- Create: `src/lib/send.ts`

Every composer action is one function here. They share a shape: take a sender account and the action's own fields, return the transaction id. Keeping them out of the components is what makes the forms trivial and the call sites greppable.

- [ ] **Step 1: Write the module**

Create `src/lib/send.ts`:

```ts
import { generateSignKeys } from '@signumjs/crypto'
import { Address, type TransactionId } from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { DescriptorData } from '@signumjs/standards'
import { signingLedger } from './ledger'
import type { SandboxAccount } from './accounts'

/**
 * The mock chain has no fee market. One tenth of a SIGNA clears everything the
 * console sends and keeps the forms free of a field nobody wants to think about.
 */
export const DEFAULT_FEE = Amount.fromSigna(0.1)

const keysOf = (account: SandboxAccount) => generateSignKeys(account.passphrase)

/** Every send shares these three fields. */
const base = (account: SandboxAccount) => {
  const keys = keysOf(account)
  return {
    feePlanck: DEFAULT_FEE.getPlanck(),
    senderPublicKey: keys.publicKey,
    senderPrivateKey: keys.signPrivateKey,
  }
}

/** The API takes numeric ids; people type Reed-Solomon addresses. */
export const toNumericId = (addressOrId: string) =>
  /^\d+$/.test(addressOrId) ? addressOrId : Address.create(addressOrId).getNumericId()

const asId = (result: unknown) => (result as TransactionId).transaction

export async function sendPayment(
  from: SandboxAccount,
  to: string,
  signa: string,
  message?: string,
) {
  return asId(
    await signingLedger.transaction.sendAmountToSingleRecipient({
      ...base(from),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      attachment: message ? { message, messageIsText: true } : undefined,
    }),
  )
}

export async function sendMultiOut(
  from: SandboxAccount,
  recipients: { address: string; signa: string }[],
) {
  return asId(
    await signingLedger.transaction.sendAmountToMultipleRecipients({
      ...base(from),
      recipientAmounts: recipients.map((r) => ({
        recipient: toNumericId(r.address),
        amountNQT: Amount.fromSigna(r.signa).getPlanck(),
      })),
    }),
  )
}

export async function sendPlainMessage(from: SandboxAccount, to: string, message: string) {
  return asId(
    await signingLedger.message.sendMessage({
      ...base(from),
      message,
      messageIsText: true,
      recipientId: toNumericId(to),
    }),
  )
}

/**
 * Encryption needs the recipient's public key, which only exists once their
 * account is on chain — or, for a sandbox account, can be derived. The caller
 * resolves it and passes it in, so this function has no opinion about where it
 * came from.
 */
export async function sendEncryptedMessage(
  from: SandboxAccount,
  to: string,
  recipientPublicKey: string,
  message: string,
) {
  return asId(
    await signingLedger.message.sendEncryptedMessage({
      ...base(from),
      message,
      messageIsText: true,
      recipientId: toNumericId(to),
      recipientPublicKey,
      senderAgreementKey: keysOf(from).agreementPrivateKey,
    }),
  )
}

export async function setAccountInfo(
  account: SandboxAccount,
  name: string,
  description: string,
) {
  // SRC44 is what makes the description machine-readable; building it through
  // DescriptorData means what lands on chain is valid by construction.
  const descriptor = DescriptorData.create({ name, description })
  return asId(
    await signingLedger.account.setAccountInfo({
      ...base(account),
      name,
      description: descriptor.stringify(),
    }),
  )
}

export async function issueToken(
  issuer: SandboxAccount,
  name: string,
  quantity: string,
  decimals: number,
  description: string,
) {
  return asId(
    await signingLedger.asset.issueAsset({
      ...base(issuer),
      name,
      quantity,
      decimals,
      description,
      mintable: false,
    }),
  )
}

export async function transferToken(
  from: SandboxAccount,
  to: string,
  assetId: string,
  quantity: string,
) {
  return asId(
    await signingLedger.asset.transferAsset({
      ...base(from),
      assetId,
      quantity,
      recipientId: toNumericId(to),
    }),
  )
}

export async function setAlias(account: SandboxAccount, aliasName: string, content: string) {
  return asId(
    await signingLedger.alias.setAlias({ ...base(account), aliasName, aliasURI: content }),
  )
}

export async function createSubscription(
  from: SandboxAccount,
  to: string,
  signa: string,
  frequency: number,
) {
  return asId(
    await signingLedger.transaction.createSubscription({
      ...base(from),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      frequency,
    }),
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `bun run build`
Expected: exits 0. If `DescriptorData.create` or `.stringify()` do not match, check `node_modules/@signumjs/standards/out/src44/` and adjust the call — the intent (build SRC44, serialise it into `description`) does not change.

- [ ] **Step 3: Commit**

```bash
git add src/lib/send.ts
git commit -m "feat: one function per composer action"
```

---

## Task 17: The send drawer and the payment form

**Files:**
- Create: `src/components/console/drawers/SendDrawer.tsx`
- Create: `src/components/console/drawers/forms/fields.tsx`
- Create: `src/components/console/drawers/forms/PaymentForm.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`

- [ ] **Step 1: Shared field components**

Create `src/components/console/drawers/forms/fields.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { SandboxAccount } from '@/lib/accounts'

const border = { borderColor: 'var(--border2)' }

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[9px] uppercase tracking-[1px] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      style={border}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      style={border}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: SandboxAccount[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <select
      className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      style={border}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name} · {a.address}</option>
      ))}
    </select>
  )
}

export function SubmitButton({
  label,
  busy,
  onClick,
}: {
  label: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      className="border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]"
      style={border}
      disabled={busy}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: The payment form**

Create `src/components/console/drawers/forms/PaymentForm.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { sendPayment } from '@/lib/send'
import { AccountSelect, Field, SubmitButton, TextArea, TextInput } from './fields'

export function PaymentForm({
  accounts,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [attach, setAttach] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from || !to || !amount) return
    setBusy(true)
    try {
      await sendPayment(from, to, amount, attach ? message : undefined)
      setTo('')
      setAmount('')
      setMessage('')
      onSent()
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Field label={t('console.send.from')}>
        <AccountSelect accounts={accounts} value={fromId} onChange={setFromId} />
      </Field>
      <Field label={t('console.send.to')}>
        <TextInput value={to} onChange={setTo} placeholder="TS-…" />
      </Field>
      <Field label={t('console.send.amount')}>
        <TextInput value={amount} onChange={setAmount} placeholder="100" />
      </Field>
      <label className="mb-2 flex items-center gap-2 text-[10px] text-[var(--muted)]">
        <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        {t('console.send.attach')}
      </label>
      {attach && (
        <Field label={t('console.send.message')}>
          <TextArea value={message} onChange={setMessage} />
        </Field>
      )}
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
```

The form clears its fields and stays open after a successful send, per the spec.

- [ ] **Step 3: The drawer**

Create `src/components/console/drawers/SendDrawer.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import type { AccountStore } from '@/hooks/useAccounts'
import { PaymentForm } from './forms/PaymentForm'

export type SendKind =
  | 'payment'
  | 'multiOut'
  | 'message'
  | 'accountInfo'
  | 'tokenIssue'
  | 'tokenTransfer'
  | 'alias'
  | 'subscription'

const KINDS: SendKind[] = [
  'payment', 'multiOut', 'message', 'accountInfo',
  'tokenIssue', 'tokenTransfer', 'alias', 'subscription',
]

export function SendDrawer({ store }: { store: AccountStore }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [kind, setKind] = useState<SendKind>('payment')
  const [notice, setNotice] = useState<string | null>(null)

  if (!store.available) {
    return <p className="mt-2 text-[11px] text-[var(--muted)]">{t('console.guard.title')}</p>
  }

  // A fresh transaction shows up as unconfirmed only after the feed refetches;
  // the socket will do it too, but not before the user looks.
  const onSent = () => {
    setNotice(t('console.send.sent'))
    void client.invalidateQueries({ queryKey: ['unconfirmed'] })
  }

  return (
    <div className="mt-2">
      <div className="mb-3 flex flex-wrap gap-1">
        {KINDS.map((name) => (
          <button
            key={name}
            onClick={() => { setKind(name); setNotice(null) }}
            className="border px-2 py-[2px] text-[9px] uppercase tracking-[1px]"
            style={{
              borderColor: kind === name ? 'var(--blue2)' : 'var(--border2)',
              color: kind === name ? 'var(--blue3)' : 'var(--muted)',
            }}
          >
            {t(`console.kind.${name === 'message' ? 'message' : name}`)}
          </button>
        ))}
      </div>

      {kind === 'payment' && (
        <PaymentForm accounts={store.accounts} onSent={onSent} onError={setNotice} />
      )}

      {notice && <p className="mt-2 text-[10px] text-[var(--blue3)]">{notice}</p>}
    </div>
  )
}
```

Task 18 fills in the seven remaining branches.

- [ ] **Step 4: Render it in the shell**

In `ConsoleShell.tsx`, inside the drawer panel and below the header row, add:

```tsx
            {drawer === 'send' && <SendDrawer store={accounts} />}
```

with `import { SendDrawer } from './drawers/SendDrawer'`.

- [ ] **Step 5: Verify**

Run: `bun run build`
Expected: exits 0.

In the browser: create two accounts, forge a few blocks with the first so it has funds, open Send, pick it as sender, paste the second one's address, enter 100, press Send. Expected: the notice appears, the fields clear, and a `payment` row shows up in the stream as unconfirmed. Forge once — it moves to confirmed and the recipient's balance changes on the Accounts tab.

- [ ] **Step 6: Commit**

```bash
git add src/components/console/drawers
git commit -m "feat: the send drawer and the payment form"
```

---

## Task 18: The remaining seven forms

**Files:**
- Create: `src/components/console/drawers/forms/MultiOutForm.tsx`
- Create: `src/components/console/drawers/forms/MessageForm.tsx`
- Create: `src/components/console/drawers/forms/AccountInfoForm.tsx`
- Create: `src/components/console/drawers/forms/TokenIssueForm.tsx`
- Create: `src/components/console/drawers/forms/TokenTransferForm.tsx`
- Create: `src/components/console/drawers/forms/AliasForm.tsx`
- Create: `src/components/console/drawers/forms/SubscriptionForm.tsx`
- Modify: `src/components/console/drawers/SendDrawer.tsx`

Every form follows `PaymentForm` exactly: local state per field, a `submit` that calls its `src/lib/send.ts` function, `onSent` on success, `onError` with the message on failure, fields cleared, drawer stays open. All take the same props:

```tsx
{ accounts, onSent, onError }: {
  accounts: SandboxAccount[]
  onSent: () => void
  onError: (message: string) => void
}
```

- [ ] **Step 1: Multi-out**

`MultiOutForm.tsx`: an account select for the sender and one `TextArea` for the recipients, hinted by `t('console.send.recipientHint')` — one `address, amount` per line. Parse on submit:

```tsx
  const parsed = recipients
    .split('\n')
    .map((line) => line.split(',').map((part) => part.trim()))
    .filter((parts) => parts.length === 2 && parts[0] && parts[1])
    .map(([address, signa]) => ({ address, signa }))
```

then `await sendMultiOut(from, parsed)`. Refuse to submit when `parsed.length === 0`.

- [ ] **Step 2: Message, plain and encrypted**

`MessageForm.tsx`: sender select, recipient input, a `TextArea` for the text, and a checkbox for `t('console.send.encrypt')`.

Encryption needs the recipient's public key. Resolve it in this order and call `sendEncryptedMessage` only if one of them yields a key:

```tsx
  const recipientPublicKey = async (to: string): Promise<string | null> => {
    // A sandbox account's key is derivable without asking the node.
    const known = accounts.find((a) => a.address === to || a.id === toNumericId(to))
    if (known) return generateSignKeys(known.passphrase).publicKey
    try {
      const account = await ledger.account.getAccount(toNumericId(to))
      return account.publicKey || null
    } catch {
      return null
    }
  }
```

When it returns null, call `onError(t('console.send.needsPublicKey'))` and send nothing — a public key only exists on chain once the account has sent something, and silently downgrading to a plain message would be a lie.

Imports needed: `generateSignKeys` from `@signumjs/crypto`, `ledger` from `@/lib/ledger`, `toNumericId`, `sendPlainMessage` and `sendEncryptedMessage` from `@/lib/send`.

- [ ] **Step 3: Account info**

`AccountInfoForm.tsx`: account select, `t('console.send.infoName')` input, `t('console.send.infoDescription')` textarea, calling `setAccountInfo(account, name, description)`.

- [ ] **Step 4: Token issuance**

`TokenIssueForm.tsx`: issuer select plus `tokenName`, `tokenQuantity`, `tokenDecimals` and `tokenDescription`, calling `issueToken(issuer, name, quantity, Number(decimals), description)`. Default decimals to `'0'` and quantity to `'1000'` so the form can be submitted without reading documentation first.

- [ ] **Step 5: Token transfer**

`TokenTransferForm.tsx`: sender select, recipient input, a token select and a quantity. Load the sender's tokens:

```tsx
  const tokens = useQuery({
    queryKey: ['assetsByOwner', fromId],
    queryFn: () => ledger.asset.getAssetsByOwner({ accountId: fromId }),
    enabled: fromId !== '',
    retry: false,
  })
```

SignumJS names this `getAssetsByOwner`, not `getAccountAssets` — the API request type and the client method differ here. It resolves to `{ assets: Asset[] }`. Render one `<option>` per entry in `tokens.data?.assets ?? []`, with its `asset` id as the value and its `name` as the label, then call `transferToken(from, to, assetId, quantity)`.

- [ ] **Step 6: Alias**

`AliasForm.tsx`: account select, `aliasName` input, `aliasContent` input, calling `setAlias(account, aliasName, content)`.

- [ ] **Step 7: Subscription**

`SubscriptionForm.tsx`: sender select, recipient input, amount, and a `frequency` input in seconds defaulting to `'3600'`, calling `createSubscription(from, to, amount, Number(frequency))`.

- [ ] **Step 8: Wire all seven into the drawer**

In `SendDrawer.tsx`, add the imports and one branch per kind, following the payment branch exactly:

```tsx
      {kind === 'multiOut' && <MultiOutForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
      {kind === 'message' && <MessageForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
      {kind === 'accountInfo' && <AccountInfoForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
      {kind === 'tokenIssue' && <TokenIssueForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
      {kind === 'tokenTransfer' && <TokenTransferForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
      {kind === 'alias' && <AliasForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
      {kind === 'subscription' && <SubscriptionForm accounts={store.accounts} onSent={onSent} onError={setNotice} />}
```

- [ ] **Step 9: Verify each one against the chain**

Run: `bun run build`
Expected: exits 0.

Then in the browser, with a funded account, send one of each and forge after each. Expected in the stream, in order: `multiOut`, `message`, `encryptedMessage`, `accountInfo`, `tokenIssue`, `tokenTransfer`, `alias`, `subscription` — each as its own row with the right label, and the token issuance detail showing the SRC44-free description while the account info shows `name` and `description` as separate fields.

- [ ] **Step 10: Commit**

```bash
git add src/components/console/drawers/forms src/components/console/drawers/SendDrawer.tsx
git commit -m "feat: the remaining seven composer forms"
```

---

## Task 19: The chain and help drawers

**Files:**
- Create: `src/components/console/drawers/ChainDrawer.tsx`
- Create: `src/components/console/drawers/HelpDrawer.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`

- [ ] **Step 1: The chain drawer**

Create `src/components/console/drawers/ChainDrawer.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { resetChain } from '@/lib/chainAdmin'

export function ChainDrawer({ height }: { height: number | null }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = async () => {
    if (!window.confirm(t('console.chain.resetConfirm'))) return
    setBusy(true)
    const outcome = await resetChain(height ?? 0)
    setBusy(false)
    setNotice(outcome.succeeded ? t('console.chain.resetDone') : t('console.chain.resetManual'))
    void client.invalidateQueries()
  }

  return (
    <div className="mt-2">
      <button
        className="border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]"
        style={{ borderColor: 'var(--border2)' }}
        disabled={busy}
        onClick={() => void reset()}
      >
        {t('console.chain.reset')}
      </button>
      {notice && <p className="mt-2 text-[10px] text-[var(--muted)]">{notice}</p>}
    </div>
  )
}
```

`invalidateQueries()` without a key is deliberate: after a reset every cached answer is wrong.

- [ ] **Step 2: The help drawer**

Create `src/components/console/drawers/HelpDrawer.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { AudioToggle } from '@/components/controls/AudioToggle'

export function HelpDrawer() {
  const { t } = useTranslation()
  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <AudioToggle />
      </div>
      <a
        className="text-[11px] text-[var(--blue3)] underline"
        href="/api-doc/"
        target="_blank"
        rel="noreferrer"
      >
        ↗ {t('entry.apiDocs.title')}
      </a>
    </div>
  )
}
```

Both controls are named exports taking no props, so this import works as written.

Beginner mode, the tour and the advanced section belong to layer two and are not added here.

- [ ] **Step 3: Wire both into the shell**

Next to the existing `{drawer === 'send' && …}` line:

```tsx
            {drawer === 'chain' && <ChainDrawer height={state.height} />}
            {drawer === 'help' && <HelpDrawer />}
```

- [ ] **Step 4: Verify**

Run: `bun run build`
Expected: exits 0.

In the browser, with a chain of a few blocks: open Chain, press Reset, confirm. Expected: the height in the header drops to 1, the stream shows the empty state, and the message reports which stage succeeded. Open Help: theme and sound controls work and the API-doc link opens in a new tab.

- [ ] **Step 5: Commit**

```bash
git add src/components/console/drawers
git commit -m "feat: the chain and help drawers"
```

---

## Task 20: Smoke coverage and documentation

**Files:**
- Modify: `scripts/smoke.sh`
- Modify: `README.md`

- [ ] **Step 1: Read the smoke script**

```bash
cat scripts/smoke.sh
```

Note how it asserts a mount — the new assertions must follow that shape rather than invent one.

- [ ] **Step 2: Assert the admin key works**

Add an assertion alongside the existing ones that a `POST` to `clearUnconfirmedTransactions` with `apiKey=sandbox` does not return an error. This is the one piece of configuration whose failure disables reset and would otherwise be discovered by hand.

The console route needs no separate assertion: it is served by the same `index.html` as `/`, which the script already checks. Add a comment saying so, so the next person does not add a redundant check.

- [ ] **Step 3: Document the console in the README**

Under "What is served", change the `/` row to mention that the start page leads to the console, and add a row:

```markdown
| `/#/console` | the sandbox console — accounts, forging, transactions |
```

Replace the "Forging blocks" section's implication that curl is the way to forge with a sentence pointing at the console's forge button, keeping the curl example as the scriptable alternative.

- [ ] **Step 4: Verify**

Run: `./scripts/smoke.sh`
Expected: every assertion passes, the script exits 0.

Run: `bun run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke.sh README.md
git commit -m "test: smoke coverage for the admin key, and console docs"
```

**Phase C checkpoint, and the end of layer one:** the console manages accounts, drives the chain, sends every supported transaction and shows what happened.

---

## What layer two adds

Not in this plan, and deliberately: the scenario vocabulary and runner, the two scenario files, `scripts/seed.sh`, help icons, beginner mode, the interactive tour with its highlight and pre-fill hooks, and the advanced section exposing `popOff` at −1, −10 and −100. `resetPlan` and `popOffTo` already exist for that last one.
