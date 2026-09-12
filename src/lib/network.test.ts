import { describe, expect, it } from 'vitest'
import { isMockNetwork, MOCK_NETWORK_NAME } from './network'

describe('isMockNetwork', () => {
  it('accepts the mock network', () => {
    expect(isMockNetwork(MOCK_NETWORK_NAME)).toBe(true)
  })

  it('rejects mainnet, testnet and anything else', () => {
    expect(isMockNetwork('Signum')).toBe(false)
    expect(isMockNetwork('Signum-TESTNET')).toBe(false)
    expect(isMockNetwork('signum-local-mock')).toBe(false)
  })

  it('rejects an unknown network rather than assuming the best', () => {
    expect(isMockNetwork(undefined)).toBe(false)
  })
})
