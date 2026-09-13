import { describe, expect, it } from 'vitest'
import { REWIND_STEPS, START_HEIGHT, canRewindBy, rewindProblem } from './rewind'

describe('rewindProblem', () => {
  it('winds back a chain that has grown', () => {
    expect(rewindProblem(200)).toBe('none')
  })

  it('still reaches at exactly the 1440-block limit', () => {
    // Winding back to height 1 from height h removes h - 1 blocks.
    expect(rewindProblem(1441)).toBe('none')
    expect(rewindProblem(1442)).toBe('outOfReach')
  })

  it('has nothing to do on a chain already at the start', () => {
    expect(rewindProblem(START_HEIGHT)).toBe('alreadyAtStart')
    expect(rewindProblem(1)).toBe('alreadyAtStart')
    expect(rewindProblem(0)).toBe('alreadyAtStart')
  })

  it('calls the start genesis plus one, which is as far as popOff goes', () => {
    expect(START_HEIGHT).toBe(2)
  })
})

describe('canRewindBy', () => {
  it('allows a step that stays at or above block 1', () => {
    expect(canRewindBy(12, 10)).toBe(true)
    expect(canRewindBy(12, 1)).toBe(true)
  })

  it('allows a step that lands exactly on the start', () => {
    expect(canRewindBy(12, 10)).toBe(true)
    expect(canRewindBy(START_HEIGHT + 10, 10)).toBe(true)
  })

  it('refuses a step that would go below block 1, which the node rejects flatly', () => {
    expect(canRewindBy(START_HEIGHT + 9, 10)).toBe(false)
    expect(canRewindBy(START_HEIGHT, 1)).toBe(false)
  })

  it('offers steps worth having', () => {
    expect([...REWIND_STEPS]).toEqual([1, 10, 100])
  })
})
