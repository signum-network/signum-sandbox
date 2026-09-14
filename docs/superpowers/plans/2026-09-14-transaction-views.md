# Every Transaction, Read Properly — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every transaction a Signum node can produce — all 35 subtypes outside the marketplace — is named for what it is and opened to show the fields that matter for that kind, instead of a third of them being called "Transaction" and showing nothing.

**Architecture:** Naming and field extraction are pure functions over a `Transaction`, in `src/lib/`, tested without a node. The row renders what they return; it learns nothing about transaction types. Adding a type is a table entry, not a component.

**Tech Stack:** TypeScript, SignumJS 3.3.4, React 19, i18next across ten locales, Vitest (`environment: 'node'`, no jsdom, no render tests).

---

## The problem

`txSummary.ts` recognises ten kinds and returns `other` for the rest. A developer placing an ask order, deploying a contract or adding commitment sees a row that says "Transaction" and, opened, shows a fee and a link to the raw JSON.

Signum's types, outside `Marketplace` which is deliberately excluded:

| Type | Subtypes |
|---|---|
| `Payment` (0) | Ordinary, MultiOut, MultiOutSameAmount |
| `Arbitrary` (1) | Message, AliasAssignment, PollCreation, VoteCasting, HubAnnouncement, AccountInfo, AliasSale, AliasBuy, TopLevelDomainAssignment |
| `Asset` (2) | AssetIssuance, AssetTransfer, AskOrderPlacement, BidOrderPlacement, AskOrderCancellation, BidOrderCancellation, AssetMint, AssetAddTreasureyAccount, AssetDistributeToHolders, AssetMultiTransfer, AssetTransferOwnership |
| `Leasing` (4) | Ordinary |
| `Mining` (20) | RewardRecipientAssignment, AddCommitment, RemoveCommitment |
| `AdvancedPayment` (21) | EscrowCreation, EscrowSigning, EscrowResult, SubscriptionSubscribe, SubscriptionCancel, SubscriptionPayment |
| `SmartContract` (22) | SmartContractCreation, SmartContractPayment |

Poll, Vote and Hub Announcement are inherited from Burst and unusable on Signum. They are named anyway: naming all three costs thirty strings, and the goal is that nothing ever renders as "Transaction".

---

## The one principle that makes this safe

**An extractor must never hide a field it does not recognise.**

Most of these transactions cannot be produced by this console, so their attachment shapes come from Signum's API documentation rather than from watching one arrive. Some of that will be wrong.

So extraction is additive, not selective: a kind's extractor names the fields it knows how to present — an amount as SIGNA, a quantity scaled by its token's decimals, an account as an address — and everything else in the attachment is passed through under its own key. A field the extractor has never heard of still appears. A field whose name was guessed wrong appears twice, once badly labelled and once raw, which is a cosmetic fault rather than lost information.

This is what lets the plan be written from documentation without the risk that normally carries. A developer inspecting a bid order must see everything the node said, and the "own view" for a kind must never become a filter that quietly loses part of it.

---

## File Structure

**New — pure, tested:**
- `src/lib/txKind.ts` — the complete `TxKind` union and `kindOf`. Split out of `txSummary.ts`, which keeps the summary line's job.
- `src/lib/txDetail.ts` — `detailFields(tx)`, the per-kind extraction, and the passthrough that guarantees nothing is dropped.

**Modified:**
- `src/lib/txSummary.ts` — imports the kind rather than deciding it.
- `src/lib/payload.ts` — `decodePayload` is superseded for the row and keeps only what is still used elsewhere; see Task 5.
- `src/components/console/views/TransactionRow.tsx` — renders `detailFields`.
- `src/i18n/locales/*.ts` — the kind names and field labels, ten times.

**Why two modules.** The summary line needs a name and three values; the opened row needs a dozen labelled fields. They change for different reasons and the second is ten times the size of the first.

---

### Task 1: Name every transaction

**Files:**
- Create: `src/lib/txKind.ts`
- Test: `src/lib/txKind.test.ts`
- Modify: `src/lib/txSummary.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/txKind.test.ts
import { describe, expect, it } from 'vitest'
import {
  TransactionType,
  TransactionPaymentSubtype,
  TransactionArbitrarySubtype,
  TransactionAssetSubtype,
  TransactionMiningSubtype,
  TransactionAdvancedPaymentSubtype,
  TransactionSmartContractSubtype,
  TransactionLeasingSubtype,
  type Transaction,
} from '@signumjs/core'
import en from '@/i18n/locales/en'
import { TX_KINDS, kindOf } from './txKind'

const tx = (type: number, subtype: number, extra: Partial<Transaction> = {}) =>
  ({ senderRS: 'TS-AAAA', type, subtype, ...extra }) as Transaction

describe('kindOf', () => {
  it('names a block reward, which has no sender', () => {
    expect(kindOf({ } as Transaction)).toBe('reward')
  })

  it('tells the three payment shapes apart', () => {
    expect(kindOf(tx(TransactionType.Payment, TransactionPaymentSubtype.Ordinary))).toBe('payment')
    expect(kindOf(tx(TransactionType.Payment, TransactionPaymentSubtype.MultiOut))).toBe('multiOut')
    expect(
      kindOf(tx(TransactionType.Payment, TransactionPaymentSubtype.MultiOutSameAmount)),
    ).toBe('multiOutSame')
  })

  it('tells a plain message from an encrypted one', () => {
    const plain = tx(TransactionType.Arbitrary, TransactionArbitrarySubtype.Message)
    const secret = tx(TransactionType.Arbitrary, TransactionArbitrarySubtype.Message, {
      attachment: { encryptedMessage: { data: 'x', nonce: 'y' } },
    } as Partial<Transaction>)
    expect(kindOf(plain)).toBe('message')
    expect(kindOf(secret)).toBe('encryptedMessage')
  })

  it('names the asset exchange, which this console cannot itself produce', () => {
    const kind = (subtype: number) => kindOf(tx(TransactionType.Asset, subtype))
    expect(kind(TransactionAssetSubtype.AskOrderPlacement)).toBe('askOrder')
    expect(kind(TransactionAssetSubtype.BidOrderPlacement)).toBe('bidOrder')
    expect(kind(TransactionAssetSubtype.AskOrderCancellation)).toBe('askOrderCancel')
    expect(kind(TransactionAssetSubtype.BidOrderCancellation)).toBe('bidOrderCancel')
  })

  it('names contracts and commitment', () => {
    expect(
      kindOf(tx(TransactionType.SmartContract, TransactionSmartContractSubtype.SmartContractCreation)),
    ).toBe('contractCreate')
    expect(kindOf(tx(TransactionType.Mining, TransactionMiningSubtype.AddCommitment))).toBe(
      'addCommitment',
    )
  })

  it('names a subscription payment apart from setting one up', () => {
    const kind = (subtype: number) => kindOf(tx(TransactionType.AdvancedPayment, subtype))
    expect(kind(TransactionAdvancedPaymentSubtype.SubscriptionSubscribe)).toBe('subscription')
    expect(kind(TransactionAdvancedPaymentSubtype.SubscriptionPayment)).toBe('subscriptionPayment')
    expect(kind(TransactionAdvancedPaymentSubtype.SubscriptionCancel)).toBe('cancelSubscription')
  })

  it('names leasing', () => {
    expect(kindOf(tx(TransactionType.Leasing, TransactionLeasingSubtype.Ordinary))).toBe('leasing')
  })

  // The point of the exercise. A type that falls through is a row reading
  // "Transaction" in front of a developer who knows exactly what it is.
  it('has a name for every subtype outside the marketplace', () => {
    const everything: [number, number[]][] = [
      [TransactionType.Payment, [0, 1, 2]],
      [TransactionType.Arbitrary, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
      [TransactionType.Asset, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      [TransactionType.Leasing, [0]],
      [TransactionType.Mining, [0, 1, 2]],
      [TransactionType.AdvancedPayment, [0, 1, 2, 3, 4, 5]],
      [TransactionType.SmartContract, [0, 1]],
    ]
    for (const [type, subtypes] of everything) {
      for (const subtype of subtypes) {
        expect(kindOf(tx(type, subtype)), `type ${type}.${subtype}`).not.toBe('other')
      }
    }
  })

  it('still has "other" for the marketplace and anything the chain adds later', () => {
    expect(kindOf(tx(TransactionType.Marketplace, 0))).toBe('other')
    expect(kindOf(tx(99, 0))).toBe('other')
  })
})

describe('TX_KINDS', () => {
  // The other nine locales follow from locales.test.ts; English being
  // complete is what makes all ten complete.
  it('every kind is named in English', () => {
    const kinds = (en as unknown as { console: { kind: Record<string, string> } }).console.kind
    for (const kind of TX_KINDS) expect(kinds[kind], kind).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- txKind`
Expected: FAIL, `Failed to resolve import './txKind'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/txKind.ts
import {
  TransactionType,
  TransactionPaymentSubtype,
  TransactionArbitrarySubtype,
  TransactionAssetSubtype,
  TransactionLeasingSubtype,
  TransactionMiningSubtype,
  TransactionAdvancedPaymentSubtype,
  TransactionSmartContractSubtype,
  type Transaction,
} from '@signumjs/core'

/**
 * What a transaction is, in the console's own words.
 *
 * One name per subtype the chain can produce, because a developer reading
 * their own transaction back should see what they made rather than
 * "Transaction". The marketplace is the one exclusion: it is a dead feature
 * on Signum and the spec leaves it out.
 *
 * Each name is also a translation key — `console.kind.<name>` — and
 * txKind.test.ts checks that English has every one of them.
 */
export const TX_KINDS = [
  'payment',
  'multiOut',
  'multiOutSame',
  'message',
  'encryptedMessage',
  'alias',
  'aliasSale',
  'aliasBuy',
  'tld',
  'accountInfo',
  'poll',
  'vote',
  'hubAnnouncement',
  'tokenIssue',
  'tokenTransfer',
  'tokenMultiTransfer',
  'askOrder',
  'bidOrder',
  'askOrderCancel',
  'bidOrderCancel',
  'mintAsset',
  'treasuryAccount',
  'distributeToHolders',
  'tokenOwnership',
  'leasing',
  'rewardRecipient',
  'addCommitment',
  'removeCommitment',
  'escrowCreate',
  'escrowSign',
  'escrowResult',
  'subscription',
  'cancelSubscription',
  'subscriptionPayment',
  'contractCreate',
  'contractPayment',
  'reward',
  'other',
] as const

export type TxKind = (typeof TX_KINDS)[number]

const attachment = (tx: Transaction) => (tx.attachment ?? {}) as Record<string, unknown>

const ARBITRARY: Record<number, TxKind> = {
  [TransactionArbitrarySubtype.AliasAssignment]: 'alias',
  [TransactionArbitrarySubtype.PollCreation]: 'poll',
  [TransactionArbitrarySubtype.VoteCasting]: 'vote',
  [TransactionArbitrarySubtype.HubAnnouncement]: 'hubAnnouncement',
  [TransactionArbitrarySubtype.AccountInfo]: 'accountInfo',
  [TransactionArbitrarySubtype.AliasSale]: 'aliasSale',
  [TransactionArbitrarySubtype.AliasBuy]: 'aliasBuy',
  [TransactionArbitrarySubtype.TopLevelDomainAssignment]: 'tld',
}

const ASSET: Record<number, TxKind> = {
  [TransactionAssetSubtype.AssetIssuance]: 'tokenIssue',
  [TransactionAssetSubtype.AssetTransfer]: 'tokenTransfer',
  [TransactionAssetSubtype.AskOrderPlacement]: 'askOrder',
  [TransactionAssetSubtype.BidOrderPlacement]: 'bidOrder',
  [TransactionAssetSubtype.AskOrderCancellation]: 'askOrderCancel',
  [TransactionAssetSubtype.BidOrderCancellation]: 'bidOrderCancel',
  [TransactionAssetSubtype.AssetMint]: 'mintAsset',
  [TransactionAssetSubtype.AssetAddTreasureyAccount]: 'treasuryAccount',
  [TransactionAssetSubtype.AssetDistributeToHolders]: 'distributeToHolders',
  [TransactionAssetSubtype.AssetMultiTransfer]: 'tokenMultiTransfer',
  [TransactionAssetSubtype.AssetTransferOwnership]: 'tokenOwnership',
}

const MINING: Record<number, TxKind> = {
  [TransactionMiningSubtype.RewardRecipientAssignment]: 'rewardRecipient',
  [TransactionMiningSubtype.AddCommitment]: 'addCommitment',
  [TransactionMiningSubtype.RemoveCommitment]: 'removeCommitment',
}

const ADVANCED: Record<number, TxKind> = {
  [TransactionAdvancedPaymentSubtype.EscrowCreation]: 'escrowCreate',
  [TransactionAdvancedPaymentSubtype.EscrowSigning]: 'escrowSign',
  [TransactionAdvancedPaymentSubtype.EscrowResult]: 'escrowResult',
  [TransactionAdvancedPaymentSubtype.SubscriptionSubscribe]: 'subscription',
  [TransactionAdvancedPaymentSubtype.SubscriptionCancel]: 'cancelSubscription',
  [TransactionAdvancedPaymentSubtype.SubscriptionPayment]: 'subscriptionPayment',
}

const CONTRACT: Record<number, TxKind> = {
  [TransactionSmartContractSubtype.SmartContractCreation]: 'contractCreate',
  [TransactionSmartContractSubtype.SmartContractPayment]: 'contractPayment',
}

export function kindOf(tx: Transaction): TxKind {
  // A block reward has no sender: the chain itself credited the forger.
  if (!tx.senderRS) return 'reward'

  switch (tx.type) {
    case TransactionType.Payment:
      if (tx.subtype === TransactionPaymentSubtype.Ordinary) return 'payment'
      return tx.subtype === TransactionPaymentSubtype.MultiOut ? 'multiOut' : 'multiOutSame'
    case TransactionType.Arbitrary:
      // The one place the subtype is not enough: a message is one subtype and
      // two very different things, and which one it is decides whether the
      // console can show the text at all.
      if (tx.subtype === TransactionArbitrarySubtype.Message) {
        return attachment(tx).encryptedMessage ? 'encryptedMessage' : 'message'
      }
      return ARBITRARY[tx.subtype] ?? 'other'
    case TransactionType.Asset:
      return ASSET[tx.subtype] ?? 'other'
    case TransactionType.Leasing:
      return tx.subtype === TransactionLeasingSubtype.Ordinary ? 'leasing' : 'other'
    case TransactionType.Mining:
      return MINING[tx.subtype] ?? 'other'
    case TransactionType.AdvancedPayment:
      return ADVANCED[tx.subtype] ?? 'other'
    case TransactionType.SmartContract:
      return CONTRACT[tx.subtype] ?? 'other'
    default:
      return 'other'
  }
}
```

- [ ] **Step 4: Point `txSummary.ts` at it**

Delete `kindOf` and the `TxKind` union from `src/lib/txSummary.ts`, and re-export so existing importers keep working:

```ts
import { kindOf, type TxKind } from './txKind'

export type { TxKind }
```

`summarize` keeps its body, calling the imported `kindOf`.

- [ ] **Step 5: Run the tests**

Run: `bun run test`
Expected: the `txKind` suite passes except the English-naming case, which Task 2 closes. Every existing `txSummary` test still passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/txKind.ts src/lib/txKind.test.ts src/lib/txSummary.ts
git commit -m "feat: a name for every transaction the chain can make"
```

---

### Task 2: The names, in ten languages

**Files:**
- Modify: `src/i18n/locales/*.ts` (all ten)

The existing `console.kind` block has eleven entries. It grows to thirty-eight.

- [ ] **Step 1: Add the English names**

Replace the `kind` block in `en.ts` with:

```ts
    kind: {
      payment: 'Payment',
      multiOut: 'Multi-out',
      multiOutSame: 'Multi-out, same amount',
      message: 'Message',
      encryptedMessage: 'Encrypted message',
      alias: 'Alias',
      aliasSale: 'Alias offered',
      aliasBuy: 'Alias bought',
      tld: 'Top-level domain',
      accountInfo: 'Account info',
      poll: 'Poll',
      vote: 'Vote',
      hubAnnouncement: 'Hub announcement',
      tokenIssue: 'Token issued',
      tokenTransfer: 'Token transfer',
      tokenMultiTransfer: 'Token multi-transfer',
      askOrder: 'Sell order',
      bidOrder: 'Buy order',
      askOrderCancel: 'Sell order cancelled',
      bidOrderCancel: 'Buy order cancelled',
      mintAsset: 'Token minted',
      treasuryAccount: 'Treasury account added',
      distributeToHolders: 'Distributed to holders',
      tokenOwnership: 'Token ownership transferred',
      leasing: 'Balance leased',
      rewardRecipient: 'Reward recipient set',
      addCommitment: 'Commitment added',
      removeCommitment: 'Commitment removed',
      escrowCreate: 'Escrow created',
      escrowSign: 'Escrow signed',
      escrowResult: 'Escrow settled',
      subscription: 'Subscription',
      cancelSubscription: 'Subscription cancelled',
      subscriptionPayment: 'Subscription payment',
      contractCreate: 'Contract deployed',
      contractPayment: 'Contract payment',
      reward: 'Block reward',
      other: 'Transaction',
    },
```

Note `aliasTransfer` is gone: the chain has no such subtype — an alias moves by `AliasSale` at a price of zero, which is what `transferAlias` in `send.ts` does. The Send drawer's own label for that action is `console.kindHelp.aliasTransfer` and stays; this block is about what a transaction *is* when read back.

**Check that before deleting it**: grep for `kind.aliasTransfer` and make sure nothing else reads it. If the Send drawer's action list uses `console.kind.aliasTransfer` as its label, keep the key and let it be a send-side name that `kindOf` never returns.

- [ ] **Step 2: Add the German names**

```ts
    kind: {
      payment: 'Zahlung',
      multiOut: 'Multi-Out',
      multiOutSame: 'Multi-Out, gleicher Betrag',
      message: 'Nachricht',
      encryptedMessage: 'Verschlüsselte Nachricht',
      alias: 'Alias',
      aliasSale: 'Alias angeboten',
      aliasBuy: 'Alias gekauft',
      tld: 'Top-Level-Domain',
      accountInfo: 'Account-Info',
      poll: 'Abstimmung',
      vote: 'Stimme',
      hubAnnouncement: 'Hub-Ankündigung',
      tokenIssue: 'Token ausgegeben',
      tokenTransfer: 'Token-Transfer',
      tokenMultiTransfer: 'Token-Multi-Transfer',
      askOrder: 'Verkaufsorder',
      bidOrder: 'Kauforder',
      askOrderCancel: 'Verkaufsorder storniert',
      bidOrderCancel: 'Kauforder storniert',
      mintAsset: 'Token nachgeprägt',
      treasuryAccount: 'Treasury-Konto hinzugefügt',
      distributeToHolders: 'An Halter ausgeschüttet',
      tokenOwnership: 'Token-Besitz übertragen',
      leasing: 'Guthaben verliehen',
      rewardRecipient: 'Belohnungsempfänger gesetzt',
      addCommitment: 'Commitment hinzugefügt',
      removeCommitment: 'Commitment entfernt',
      escrowCreate: 'Treuhand angelegt',
      escrowSign: 'Treuhand signiert',
      escrowResult: 'Treuhand abgeschlossen',
      subscription: 'Subscription',
      cancelSubscription: 'Subscription gekündigt',
      subscriptionPayment: 'Subscription-Zahlung',
      contractCreate: 'Vertrag ausgebracht',
      contractPayment: 'Vertragszahlung',
      reward: 'Blockbelohnung',
      other: 'Transaktion',
    },
```

- [ ] **Step 3: Translate the same thirty-eight into the remaining eight**

`es`, `pt`, `uk`, `ru`, `zh`, `ja`, `ko`, `hi`. These are read by a developer inspecting their own transaction, so accuracy beats elegance — but keep each file's existing vocabulary: check `glossary.*` and the rest of `console.*` for how that locale already says token, alias, subscription, commitment. `locales.test.ts` fails on any key difference.

- [ ] **Step 4: Run the tests**

Run: `bun run test`
Expected: PASS, including `TX_KINDS` from Task 1

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "feat: name all thirty-eight kinds, in ten languages"
```

---

### Task 3: What each kind is worth showing

**Files:**
- Create: `src/lib/txDetail.ts`
- Test: `src/lib/txDetail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/txDetail.test.ts
import { describe, expect, it } from 'vitest'
import { TransactionType, TransactionAssetSubtype, type Transaction } from '@signumjs/core'
import { detailFields } from './txDetail'

const tx = (type: number, subtype: number, attachment: Record<string, unknown>) =>
  ({ senderRS: 'TS-AAAA', type, subtype, attachment }) as unknown as Transaction

const labels = (fields: { label: string }[]) => fields.map((f) => f.label)

describe('detailFields', () => {
  it('reads an order as a price and a quantity', () => {
    const fields = detailFields(
      tx(TransactionType.Asset, TransactionAssetSubtype.AskOrderPlacement, {
        asset: '123',
        quantityQNT: '500',
        priceNQT: '250000',
      }),
    )
    expect(labels(fields)).toContain('token')
    expect(labels(fields)).toContain('quantity')
    expect(labels(fields)).toContain('price')
  })

  it('reads a cancellation as the order it cancels', () => {
    const fields = detailFields(
      tx(TransactionType.Asset, TransactionAssetSubtype.AskOrderCancellation, { order: '99' }),
    )
    expect(fields).toContainEqual({ label: 'order', value: '99' })
  })

  // The principle the whole file rests on. Most of these transactions cannot
  // be made from this console, so their attachment shapes come from
  // documentation rather than observation — some of it will be wrong. An
  // extractor that only showed what it recognised would hide the evidence.
  it('passes through an attachment field it has never heard of', () => {
    const fields = detailFields(
      tx(TransactionType.Asset, TransactionAssetSubtype.AskOrderPlacement, {
        asset: '123',
        quantityQNT: '500',
        priceNQT: '250000',
        somethingNew: 'do not lose me',
      }),
    )
    expect(fields).toContainEqual({ label: 'somethingNew', value: 'do not lose me' })
  })

  it('passes through everything for a kind it has no extractor for at all', () => {
    const fields = detailFields(tx(TransactionType.Marketplace, 0, { goods: 'x', price: '1' }))
    expect(labels(fields).sort()).toEqual(['goods', 'price'])
  })

  it('never shows the version markers the node adds to every attachment', () => {
    const fields = detailFields(
      tx(TransactionType.Asset, TransactionAssetSubtype.AssetTransfer, {
        'version.AssetTransfer': 1,
        asset: '123',
        quantityQNT: '10',
      }),
    )
    expect(labels(fields)).not.toContain('version.AssetTransfer')
  })

  it('renders an object rather than printing [object Object]', () => {
    const fields = detailFields(tx(99, 0, { nested: { a: 1 } }))
    expect(fields[0].value).toBe('{"a":1}')
  })

  it('has nothing to say about a transaction with no attachment', () => {
    expect(detailFields({ senderRS: 'TS-A', type: 0, subtype: 0 } as Transaction)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- txDetail`
Expected: FAIL, `Failed to resolve import './txDetail'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/txDetail.ts
import { Amount } from '@signumjs/util'
import type { Transaction } from '@signumjs/core'
import { kindOf, type TxKind } from './txKind'

export interface DetailField {
  /** A translation key under `console.field`, or a raw attachment key. */
  label: string
  /** Null means "known to be here but not readable", e.g. an encrypted message. */
  value: string | null
}

/**
 * The node stamps every attachment with which version of the format it used.
 * It tells a reader nothing and there is one on almost every transaction.
 */
const isVersionMarker = (key: string) => key.startsWith('version.')

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : JSON.stringify(value)

const signa = (planck: unknown) =>
  typeof planck === 'string' ? `${Amount.fromPlanck(planck).getSigna()} SIGNA` : asText(planck)

/**
 * Which attachment keys each kind knows how to present, and under what label.
 *
 * A key listed here is renamed and formatted; a key not listed still appears,
 * under its own name. That is the difference between a view and a filter, and
 * it is what makes this table safe to write from documentation: most of these
 * transactions cannot be produced by this console, so some of what follows is
 * an educated guess. A guess that is wrong costs a badly labelled line. A
 * guess that *hid* the field would cost the developer the answer.
 */
const KNOWN: Partial<Record<TxKind, Record<string, { label: string; format?: 'signa' }>>> = {
  tokenIssue: {
    name: { label: 'tokenName' },
    description: { label: 'description' },
    quantityQNT: { label: 'quantity' },
    decimals: { label: 'decimals' },
    mintable: { label: 'mintable' },
  },
  tokenTransfer: { asset: { label: 'token' }, quantityQNT: { label: 'quantity' } },
  mintAsset: { asset: { label: 'token' }, quantityQNT: { label: 'quantity' } },
  askOrder: {
    asset: { label: 'token' },
    quantityQNT: { label: 'quantity' },
    priceNQT: { label: 'price', format: 'signa' },
  },
  bidOrder: {
    asset: { label: 'token' },
    quantityQNT: { label: 'quantity' },
    priceNQT: { label: 'price', format: 'signa' },
  },
  askOrderCancel: { order: { label: 'order' } },
  bidOrderCancel: { order: { label: 'order' } },
  alias: { alias: { label: 'aliasName' }, uri: { label: 'content' } },
  aliasSale: { alias: { label: 'aliasName' }, priceNQT: { label: 'price', format: 'signa' } },
  aliasBuy: { alias: { label: 'aliasName' } },
  accountInfo: { name: { label: 'infoName' }, description: { label: 'description' } },
  subscription: { frequency: { label: 'frequency' } },
  cancelSubscription: { subscriptionId: { label: 'subscription' } },
  subscriptionPayment: { subscriptionId: { label: 'subscription' } },
  addCommitment: { amountNQT: { label: 'amount', format: 'signa' } },
  removeCommitment: { amountNQT: { label: 'amount', format: 'signa' } },
  contractCreate: { name: { label: 'contractName' }, description: { label: 'description' } },
  escrowCreate: {
    amountNQT: { label: 'amount', format: 'signa' },
    requiredSigners: { label: 'requiredSigners' },
    deadline: { label: 'deadline' },
    deadlineAction: { label: 'deadlineAction' },
  },
  escrowSign: { escrowId: { label: 'escrow' }, decision: { label: 'decision' } },
  escrowResult: { escrowId: { label: 'escrow' }, decision: { label: 'decision' } },
}

/**
 * Every attachment field, named where the console knows the name.
 *
 * Deliberately additive: the fields a kind understands come first, in the
 * order the table lists them, and everything else follows under its own key.
 * Nothing in an attachment is ever dropped except the node's own version
 * markers, which say nothing to a reader.
 */
export function detailFields(tx: Transaction): DetailField[] {
  const attachment = (tx.attachment ?? {}) as Record<string, unknown>
  const known = KNOWN[kindOf(tx)] ?? {}
  const fields: DetailField[] = []
  const taken = new Set<string>()

  for (const [key, how] of Object.entries(known)) {
    if (!(key in attachment)) continue
    taken.add(key)
    const raw = attachment[key]
    fields.push({ label: how.label, value: how.format === 'signa' ? signa(raw) : asText(raw) })
  }

  for (const [key, raw] of Object.entries(attachment)) {
    if (taken.has(key) || isVersionMarker(key)) continue
    fields.push({ label: key, value: asText(raw) })
  }

  return fields
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test -- txDetail`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/txDetail.ts src/lib/txDetail.test.ts
git commit -m "feat: what each kind of transaction is worth showing"
```

---

### Task 4: The field labels, in ten languages

**Files:**
- Modify: `src/i18n/locales/*.ts` (all ten)

Labels the table above uses that the locales do not already carry. Several
do exist — `console.send.tokenName`, `console.src44.description`,
`console.send.aliasName` — but a detail row should not reach into the send
drawer's vocabulary for them, so this is its own block.

- [ ] **Step 1: Add the English block**

Inside `console`:

```ts
    field: {
      token: 'Token',
      quantity: 'Quantity',
      decimals: 'Decimals',
      mintable: 'Mintable',
      price: 'Price',
      order: 'Order',
      tokenName: 'Token name',
      description: 'Description',
      infoName: 'Name',
      aliasName: 'Alias',
      content: 'Content',
      frequency: 'Every',
      subscription: 'Subscription',
      amount: 'Amount',
      contractName: 'Contract',
      escrow: 'Escrow',
      decision: 'Decision',
      requiredSigners: 'Required signers',
      deadline: 'Deadline',
      deadlineAction: 'On deadline',
      message: 'Message',
      encrypted: 'Encrypted',
      recipients: 'Recipients',
    },
```

- [ ] **Step 2: Add the German block**

```ts
    field: {
      token: 'Token',
      quantity: 'Menge',
      decimals: 'Nachkommastellen',
      mintable: 'Nachprägbar',
      price: 'Preis',
      order: 'Order',
      tokenName: 'Token-Name',
      description: 'Beschreibung',
      infoName: 'Name',
      aliasName: 'Alias',
      content: 'Inhalt',
      frequency: 'Alle',
      subscription: 'Subscription',
      amount: 'Betrag',
      contractName: 'Vertrag',
      escrow: 'Treuhand',
      decision: 'Entscheidung',
      requiredSigners: 'Benötigte Unterschriften',
      deadline: 'Frist',
      deadlineAction: 'Bei Fristablauf',
      message: 'Nachricht',
      encrypted: 'Verschlüsselt',
      recipients: 'Empfänger',
    },
```

- [ ] **Step 3: The remaining eight**

Same key set, each locale's own vocabulary.

- [ ] **Step 4: Verify and commit**

Run: `bun run test && bun run build`

```bash
git add src/i18n/locales
git commit -m "feat: label the fields a transaction carries, in ten languages"
```

---

### Task 5: The row reads what the libraries return

**Files:**
- Modify: `src/components/console/views/TransactionRow.tsx`
- Modify: `src/lib/payload.ts`

- [ ] **Step 1: Swap `decodePayload` for `detailFields`**

`TransactionRow` currently calls `decodePayload(item.tx)`. That function is
kind-blind — it looks for a handful of attachment keys whatever the
transaction is — and `detailFields` supersedes it. Replace the call.

The label is now a key rather than a word, so render it translated, and fall
back to the raw label for a passthrough field:

```tsx
{fields.map((field) => (
  <Detail key={field.label} label={t(`console.field.${field.label}`, field.label)}>
    {field.value ??
      (field.label === 'encrypted' && decrypted.data
        ? decrypted.data
        : t('console.tx.undecryptable'))}
  </Detail>
))}
```

i18next's second argument is the default, so an unrecognised attachment key
renders as itself rather than as a missing-key marker — which is exactly
right for a field the console has never heard of.

- [ ] **Step 2: Keep the encrypted-message case**

`decodePayload` emitted `{ label: 'encrypted', value: null }` so the row could
offer to decrypt. `detailFields` must do the same: add `encryptedMessage` to
the `message`/`encryptedMessage` entries in `KNOWN` with label `encrypted`
and a null value, and check `decryptFor` in `payload.ts` still receives what
it expects.

- [ ] **Step 3: Check what still uses `payload.ts`**

Run: `grep -rn "decodePayload\|src44Fields" src/`

`src44Fields` is used by the account views and stays. If `decodePayload` has
no callers left, delete it and its tests; if it has one, leave it. Do not
leave a dead export.

- [ ] **Step 4: Verify**

Run: `bun run test && bun run build`

- [ ] **Step 5: Walk it against a running node**

Load the "Full house" scenario and open one of each: a payment with a
message, an encrypted message, a token issuance, a token transfer, an alias,
a multi-out, a subscription. Check each shows its own fields with proper
labels, and that the SRC44 descriptions still decode.

Then confirm the passthrough works: there is no way to place an ask order
from this console, so use the API doc page (`/api-doc/`) to place one against
a scenario token, and check the row names it "Sell order" and shows a price
and a quantity.

- [ ] **Step 6: Commit**

```bash
git add src/components/console src/lib/payload.ts
git commit -m "feat: the row shows the fields its kind of transaction carries"
```

---

## Notes for whoever executes this

**Additive, never selective.** The one rule. Most of these transactions cannot be produced by this console, so `KNOWN` is written from documentation and some of it is wrong. A wrong guess costs a badly labelled row; a guess that hid the field would cost a developer the answer they opened the row for. If you find yourself writing `if (recognised)` around the output, stop.

**Verify what you can, and say what you could not.** Payments, messages, tokens, aliases, multi-out and subscriptions can all be produced here and should be checked against real transactions. Orders, escrow, contracts, commitment and leasing cannot — say so in the commit rather than implying they were tested.

**Ten locales, every time.** `locales.test.ts` catches a missing key but not a lazy translation, and these are read by developers inspecting their own work.

**Do not add jsdom, and do not run prettier.** The repo tests pure functions only and has no prettier config.
