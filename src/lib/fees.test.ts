import { describe, expect, it } from 'vitest'
import { feeFor, type SendAction } from './fees'

// Planck values spelled out rather than derived from Amount.fromSigna, so a
// bug in feeFor and a mistake in the test can't cancel each other out.
const PLANCK_0_1_SIGNA = '10000000'
const PLANCK_0_2_SIGNA = '20000000'
const PLANCK_150_SIGNA = '15000000000'

describe('feeFor', () => {
  it('charges the measured minimum for alias registration', () => {
    expect(feeFor('alias').getPlanck()).toBe(PLANCK_0_2_SIGNA)
  })

  it('charges the measured minimum for token issuance', () => {
    expect(feeFor('issueAsset').getPlanck()).toBe(PLANCK_150_SIGNA)
  })

  it.each<SendAction>([
    'payment',
    'multiOut',
    'message',
    'accountInfo',
    'transferAsset',
    'mintAsset',
    'subscription',
    'cancelSubscription',
  ])('falls back to the safe 0.1 SIGNA default for %s', (action) => {
    expect(feeFor(action).getPlanck()).toBe(PLANCK_0_1_SIGNA)
  })
})
