import { describe, expect, it } from 'vitest'
import { resetPlan } from './resetPlan'

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

  it('has nothing to do exactly at the start height (genesis plus block 1)', () => {
    expect(resetPlan(2)).toEqual([])
  })

  it('has something to do just past the start height', () => {
    expect(resetPlan(3)).toEqual(['popOff', 'fullReset'])
  })
})
