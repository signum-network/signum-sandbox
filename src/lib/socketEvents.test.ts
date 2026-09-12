import { describe, expect, it } from 'vitest'
import { isRefetchTrigger, parseEvent } from './socketEvents'

describe('parseEvent', () => {
  it('reads the event name out of the envelope', () => {
    expect(parseEvent('{"e":"BLOCK_PUSHED","p":{"localHeight":7}}')).toBe('BLOCK_PUSHED')
  })

  it('returns null for anything unparseable', () => {
    expect(parseEvent('not json')).toBeNull()
    expect(parseEvent('{"noEventField":1}')).toBeNull()
  })
})

describe('isRefetchTrigger', () => {
  it.each([
    ['BLOCK_PUSHED', true],
    ['PENDING_TRANSACTIONS_ADDED', true],
    ['HEARTBEAT', false],
    ['CONNECTED', false],
    [null, false],
    ['SOMETHING_NEW', false],
  ])('%s -> %s', (event, expected) => {
    expect(isRefetchTrigger(event)).toBe(expected)
  })
})
