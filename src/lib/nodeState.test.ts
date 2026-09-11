import { describe, expect, it } from 'vitest'
import { deriveNodeState, relativeParts, type DeriveInput } from './nodeState'

const status = {
  numberOfBlocks: 1284,
  version: 'v3.9.11',
  cumulativeDifficulty: '1006632960',
  isScanning: false,
}

const base: DeriveInput = {
  status,
  lastBlockMs: 1_000_000,
  networkName: 'Signum-LOCAL-MOCK',
  statusFailed: false,
  socketConnected: true,
  now: 1_012_000,
}

describe('deriveNodeState', () => {
  it('reports the node as unreachable when the status call failed and nothing is cached', () => {
    expect(deriveNodeState({ ...base, status: undefined, statusFailed: true }))
      .toEqual({ kind: 'unreachable' })
  })

  it('keeps showing the last known status when a later call fails', () => {
    const state = deriveNodeState({ ...base, statusFailed: true })
    expect(state.kind).toBe('ready')
    if (state.kind !== 'ready') return
    expect(state.height).toBe(1284)
    expect(state.connection).toBe('live')
  })

  it('maps a healthy response onto the tiles', () => {
    const state = deriveNodeState(base)
    if (state.kind !== 'ready') throw new Error('expected ready')
    expect(state).toMatchObject({
      networkName: 'Signum-LOCAL-MOCK',
      version: 'v3.9.11',
      height: 1284,
      cumulativeDifficulty: '1006632960',
      lastBlockAgeMs: 12_000,
      connection: 'live',
      scanning: false,
    })
  })

  it('falls back to polling when the socket is down', () => {
    const state = deriveNodeState({ ...base, socketConnected: false })
    if (state.kind !== 'ready') throw new Error('expected ready')
    expect(state.connection).toBe('polling')
  })

  it('yields null values rather than throwing while the first response is in flight', () => {
    const state = deriveNodeState({
      statusFailed: false, socketConnected: false, now: 0,
    })
    expect(state).toEqual({
      kind: 'ready', networkName: null, version: null, height: null,
      cumulativeDifficulty: null, lastBlockAgeMs: null,
      connection: 'polling', scanning: false,
    })
  })

  it('does not report a negative age when the node clock runs ahead', () => {
    const state = deriveNodeState({ ...base, now: base.lastBlockMs! - 5_000 })
    if (state.kind !== 'ready') throw new Error('expected ready')
    expect(state.lastBlockAgeMs).toBe(0)
  })
})

describe('relativeParts', () => {
  it.each([
    [0, { value: 0, unit: 'second' }],
    [5_000, { value: -5, unit: 'second' }],
    [90_000, { value: -1, unit: 'minute' }],
    [3 * 3_600_000, { value: -3, unit: 'hour' }],
    [50 * 3_600_000, { value: -2, unit: 'day' }],
  ])('renders %ims as %o', (ageMs, expected) => {
    expect(relativeParts(ageMs)).toEqual(expected)
  })
})
