import { describe, expect, it } from 'vitest'
import { NOT_ASKED, readBeginner, writeBeginner } from './beginner'

describe('readBeginner', () => {
  it('has not asked when nothing is stored', () => {
    expect(readBeginner(null)).toEqual(NOT_ASKED)
  })

  it('remembers a yes', () => {
    expect(readBeginner('{"beginner":true}')).toEqual({ answered: true, beginner: true })
  })

  // The point of storing `answered` separately: someone who said "old hand"
  // has answered, and must not be asked again on the next visit.
  it('remembers a no as an answer, not as an absence', () => {
    expect(readBeginner('{"beginner":false}')).toEqual({ answered: true, beginner: false })
  })

  it('treats unreadable storage as never asked', () => {
    expect(readBeginner('not json')).toEqual(NOT_ASKED)
    expect(readBeginner('"a string"')).toEqual(NOT_ASKED)
  })
})

describe('writeBeginner', () => {
  it('round-trips', () => {
    expect(readBeginner(writeBeginner(true))).toEqual({ answered: true, beginner: true })
    expect(readBeginner(writeBeginner(false))).toEqual({ answered: true, beginner: false })
  })
})
