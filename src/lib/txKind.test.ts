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
    expect(kindOf({} as Transaction)).toBe('reward')
  })

  // Taken from the mobile wallet, which reads the recipient before the
  // subtype. Address 0 destroys what is sent to it, and "Payment · 0" would
  // be a false statement about a developer's own transaction.
  it('names a burn, whatever kind of transfer carried it there', () => {
    const burn = (type: number, subtype: number) =>
      kindOf(tx(type, subtype, { recipient: '0' } as Partial<Transaction>))
    expect(burn(TransactionType.Payment, TransactionPaymentSubtype.Ordinary)).toBe('burn')
    expect(burn(TransactionType.Asset, TransactionAssetSubtype.AssetTransfer)).toBe('burn')
  })

  // The exception the wallet does not have to make, because it never names
  // alias sales: an alias offered to the whole chain rather than to one buyer
  // carries recipient 0, and nothing is destroyed. Reading it as a burn would
  // be the same lie in the other direction.
  it('does not read an alias offered to anyone as a burn', () => {
    const offer = tx(TransactionType.Arbitrary, TransactionArbitrarySubtype.AliasSale, {
      recipient: '0',
    } as Partial<Transaction>)
    expect(kindOf(offer)).toBe('aliasSale')
  })

  it('tells the three payment shapes apart', () => {
    const kind = (subtype: number) => kindOf(tx(TransactionType.Payment, subtype))
    expect(kind(TransactionPaymentSubtype.Ordinary)).toBe('payment')
    expect(kind(TransactionPaymentSubtype.MultiOut)).toBe('multiOut')
    expect(kind(TransactionPaymentSubtype.MultiOutSameAmount)).toBe('multiOutSame')
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
    const contract = TransactionSmartContractSubtype.SmartContractCreation
    expect(kindOf(tx(TransactionType.SmartContract, contract))).toBe('contractCreate')
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
