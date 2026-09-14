import { describe, expect, it } from 'vitest'
import {
  TransactionType,
  TransactionAdvancedPaymentSubtype,
  TransactionArbitrarySubtype,
  TransactionAssetSubtype,
  TransactionPaymentSubtype,
  type Transaction,
} from '@signumjs/core'
import { detailFields } from './txDetail'

const tx = (type: number, subtype: number, attachment: Record<string, unknown>) =>
  ({ senderRS: 'TS-AAAA', type, subtype, attachment }) as unknown as Transaction

const labels = (fields: { label: string }[]) => fields.map((f) => f.label)

const valueOf = (fields: { label: string; value: string | null }[], label: string) =>
  fields.find((f) => f.label === label)?.value

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

  // A contract's bytecode is thousands of characters. Hiding it would break
  // the rule this file rests on; printing it buries every other field. The
  // length is the honest middle, and the raw JSON link has the whole thing.
  it('shortens a value too long to read, and says how long it was', () => {
    const code = 'ab'.repeat(2000)
    const fields = detailFields(tx(TransactionType.SmartContract, 0, { creationBytes: code }))
    expect(fields[0].value).toContain('(4000 chars)')
    expect(fields[0].value?.length).toBeLessThan(200)
  })

  it('has nothing to say about a transaction with no attachment', () => {
    expect(detailFields({ senderRS: 'TS-A', type: 0, subtype: 0 } as Transaction)).toEqual([])
  })

  // The notes on the plan: `kindOf` calls a transfer to address 0 a burn
  // whatever carried it, and a token burn has `amountNQT: '0'` because the
  // quantity is in the attachment. Without its own entry the row says
  // something was destroyed and refuses to say what.
  it('says what a token burn destroyed', () => {
    const burn = {
      senderRS: 'TS-AAAA',
      recipient: '0',
      amountNQT: '0',
      type: TransactionType.Asset,
      subtype: TransactionAssetSubtype.AssetTransfer,
      attachment: { asset: '123', quantityQNT: '4200' },
    } as unknown as Transaction
    expect(detailFields(burn)).toEqual([
      { label: 'token', value: '123' },
      { label: 'quantity', value: '4200' },
    ])
  })

  // An encrypted message rides on payments and token transfers too, so the
  // field cannot belong to the message kinds alone. Null is the contract the
  // row's decryption path reads: "here, but not readable from the table".
  it('reports an encrypted message on a payment, not only on a message', () => {
    const fields = detailFields(
      tx(TransactionType.Payment, TransactionPaymentSubtype.Ordinary, {
        encryptedMessage: { data: 'ab', nonce: 'cd' },
      }),
    )
    expect(fields).toContainEqual({ label: 'encrypted', value: null })
  })

  it('reads a plain message on any kind that carries one', () => {
    const fields = detailFields(
      tx(TransactionType.Arbitrary, TransactionArbitrarySubtype.Message, { message: 'hello' }),
    )
    expect(fields).toContainEqual({ label: 'message', value: 'hello' })
  })

  // Parallel arrays, not pairs: `assetIds[i]` belongs with `quantitiesQNT[i]`.
  // Read as pairs they would produce a token that was never sent.
  it('pairs a multi-transfer token with its own quantity', () => {
    const fields = detailFields(
      tx(TransactionType.Asset, TransactionAssetSubtype.AssetMultiTransfer, {
        assetIds: ['123', '456'],
        quantitiesQNT: ['10', '20'],
      }),
    )
    expect(fields).toEqual([{ label: 'tokens', value: '123: 10, 456: 20' }])
  })

  // Two tokens in one transaction: `asset` is the token whose holders are
  // paid, `assetToDistribute` the one they are paid in, and "0" there is not
  // a token id at all — it is SIGNA.
  it('names SIGNA as SIGNA when a distribution paid holders in it', () => {
    const fields = detailFields(
      tx(TransactionType.Asset, TransactionAssetSubtype.AssetDistributeToHolders, {
        asset: '123',
        quantityMinimumQNT: '1',
        assetToDistribute: '0',
        quantityQNT: '0',
      }),
    )
    expect(valueOf(fields, 'paidIn')).toBe('SIGNA')
  })

  it('lists the recipients of a multi-out with what each one got', () => {
    const multi = {
      senderRS: 'TS-AAAA',
      amountNQT: '0',
      type: TransactionType.Payment,
      subtype: TransactionPaymentSubtype.MultiOut,
      attachment: {
        recipients: [
          ['123', '100000000'],
          ['456', '200000000'],
        ],
      },
    } as unknown as Transaction
    expect(valueOf(detailFields(multi), 'recipients')).toBe('123: 1 SIGNA, 456: 2 SIGNA')
  })

  // The same-amount shape is a flat list of ids; the share comes from the
  // transaction's own amount. Read as pairs, an id's first characters became
  // an id and the rest became an invented amount — which is what the SDK
  // reader exists to prevent.
  it('splits a same-amount multi-out without inventing figures', () => {
    const multi = {
      senderRS: 'TS-AAAA',
      amountNQT: '200000000',
      type: TransactionType.Payment,
      subtype: TransactionPaymentSubtype.MultiOutSameAmount,
      attachment: { recipients: ['12345', '67890'] },
    } as unknown as Transaction
    expect(valueOf(detailFields(multi), 'recipients')).toBe('12345: 1 SIGNA, 67890: 1 SIGNA')
  })

  it('unfolds an SRC44 description into its fields', () => {
    const fields = detailFields(
      tx(TransactionType.Arbitrary, TransactionArbitrarySubtype.AccountInfo, {
        name: 'Pizza',
        description: '{"vs":1,"nm":"Pizza Coin","ds":"cheesy"}',
      }),
    )
    expect(valueOf(fields, 'description')).toBe('cheesy')
  })

  it('keeps a description that is not SRC44 as the text it is', () => {
    const fields = detailFields(
      tx(TransactionType.Arbitrary, TransactionArbitrarySubtype.AccountInfo, {
        description: 'just a sentence',
      }),
    )
    expect(fields).toContainEqual({ label: 'description', value: 'just a sentence' })
  })

  it('reads a subscription interval as a span of time', () => {
    const fields = detailFields(
      tx(TransactionType.AdvancedPayment, TransactionAdvancedPaymentSubtype.SubscriptionSubscribe, {
        frequency: 3600,
      }),
    )
    expect(valueOf(fields, 'frequency')).toBe('3600 s')
  })
})
