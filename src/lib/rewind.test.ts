import { describe, expect, it } from 'vitest'
import { START_HEIGHT, rewindProblem } from './rewind'

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
