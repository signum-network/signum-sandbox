import { describe, expect, it } from 'vitest'
import { parseConsoleSearch } from './consoleNav'

describe('parseConsoleSearch', () => {
  it('reads an address as the account to watch', () => {
    expect(parseConsoleSearch({ watch: 'TS-Y24K-6X8Z-JVS7-9AUT2' })).toEqual({
      watch: '8099521788498608209',
    })
  })

  it('reads a numeric id given as a string', () => {
    expect(parseConsoleSearch({ watch: '8099521788498608209' })).toEqual({
      watch: '8099521788498608209',
    })
  })

  it('ignores a number, which has already lost its last digits', () => {
    expect(parseConsoleSearch({ watch: 8099521788498608209 })).toEqual({})
  })

  it('ignores what does not parse, and an absent value', () => {
    expect(parseConsoleSearch({ watch: 'nobody' })).toEqual({})
    expect(parseConsoleSearch({})).toEqual({})
  })
})
