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

  it('recognises both multi-out flavours, and keeps them apart', () => {
    expect(summarize(tx(0, 1)).kind).toBe('multiOut')
    expect(summarize(tx(0, 2)).kind).toBe('multiOutSame')
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
