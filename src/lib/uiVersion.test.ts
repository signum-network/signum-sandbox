import { describe, expect, it } from 'vitest'
import { staleVersion } from './uiVersion'

describe('staleVersion — whether this page is older than what is installed', () => {
  it('names the installed version when it differs from the running one', () => {
    expect(staleVersion('0.1.0', { version: '0.2.0' })).toBe('0.2.0')
  })

  it('is quiet when the page is what is installed', () => {
    expect(staleVersion('0.1.0', { version: '0.1.0' })).toBeNull()
  })

  it('is quiet on a dev server, which is always ahead of any release', () => {
    expect(staleVersion('0.1.0-dev', { version: '0.1.0' })).toBeNull()
  })

  it('is quiet when the installation says nothing readable', () => {
    expect(staleVersion('0.1.0', null)).toBeNull()
    expect(staleVersion('0.1.0', 'not json')).toBeNull()
    expect(staleVersion('0.1.0', {})).toBeNull()
    expect(staleVersion('0.1.0', { version: 7 })).toBeNull()
    expect(staleVersion('0.1.0', { version: '' })).toBeNull()
  })
})
