import { describe, expect, it } from 'vitest'
import { detectPlatform, resetScriptCommand } from './platform'

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const LINUX_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

describe('detectPlatform', () => {
  it('recognises Windows', () => {
    expect(detectPlatform(WINDOWS_UA)).toBe('windows')
  })

  it('treats macOS as posix', () => {
    expect(detectPlatform(MAC_UA)).toBe('posix')
  })

  it('treats Linux as posix', () => {
    expect(detectPlatform(LINUX_UA)).toBe('posix')
  })

  it('treats an unrecognised or missing user agent as posix, not Windows', () => {
    expect(detectPlatform('some-unknown-agent/1.0')).toBe('posix')
    expect(detectPlatform('')).toBe('posix')
    expect(detectPlatform(undefined)).toBe('posix')
  })
})

describe('resetScriptCommand', () => {
  it('names the Windows script on Windows', () => {
    expect(resetScriptCommand(WINDOWS_UA)).toBe('.\\scripts\\reset.cmd')
  })

  it('names the POSIX script everywhere else, including the unrecognised case', () => {
    expect(resetScriptCommand(MAC_UA)).toBe('./scripts/reset.sh')
    expect(resetScriptCommand(LINUX_UA)).toBe('./scripts/reset.sh')
    expect(resetScriptCommand(undefined)).toBe('./scripts/reset.sh')
  })
})
