import { describe, expect, it } from 'vitest'
import { HttpError } from '@signumjs/http'
import { isUnknownAccount } from './accountStatus'

const unknownAccountError = () =>
  new HttpError('/burst?requestType=getBalance', 400, 'Unknown account (Code: 5)', {
    errorCode: 5,
    errorDescription: 'Unknown account',
    requestProcessingTime: 1,
  })

describe('isUnknownAccount', () => {
  it('recognises the node\'s "Unknown account" response', () => {
    expect(isUnknownAccount(unknownAccountError())).toBe(true)
  })

  it('does not treat a different node error code as an unknown account', () => {
    const error = new HttpError('/burst', 400, 'Incorrect "account" (Code: 4)', {
      errorCode: 4,
      errorDescription: 'Incorrect "account"',
    })
    expect(isUnknownAccount(error)).toBe(false)
  })

  it('does not treat a transport failure as an unknown account', () => {
    const error = new HttpError('/burst', 0, 'Request failed', 'fetch failed')
    expect(isUnknownAccount(error)).toBe(false)
  })

  it('does not treat a plain error as an unknown account', () => {
    expect(isUnknownAccount(new Error('boom'))).toBe(false)
  })

  it('does not treat a non-error value as an unknown account', () => {
    expect(isUnknownAccount(undefined)).toBe(false)
    expect(isUnknownAccount(null)).toBe(false)
    expect(isUnknownAccount('Unknown account')).toBe(false)
  })
})
