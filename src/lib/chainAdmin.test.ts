// @vitest-environment jsdom
//
// chainAdmin.ts imports ./ledger, which reads window.location.origin at
// module load time. The default vitest environment is plain node, where
// window does not exist, so this file alone needs a DOM global to import
// the module under test.
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
