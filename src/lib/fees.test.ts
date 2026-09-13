import { describe, expect, it } from 'vitest'
import { feeFor, feePresets, type SendAction } from './fees'

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

describe('feePresets', () => {
  it('offers the ordinary steps up from the floor', () => {
    expect(feePresets('payment')).toEqual(['0.01', '0.02', '0.05', '0.1'])
  })

  it('includes an action’s own higher minimum, so the default can be picked', () => {
    expect(feePresets('issueAsset')).toEqual(['150'])
  })

  it('keeps the alias minimum in the list alongside the ordinary steps', () => {
    expect(feePresets('alias')).toContain('0.2')
  })

  it('never offers a preset below what the action needs', () => {
    for (const action of ['payment', 'alias', 'issueAsset'] as const) {
      const min = Number(feeFor(action).getSigna())
      expect(feePresets(action).every((p) => Number(p) >= Math.min(min, 0.01))).toBe(true)
    }
  })
})
