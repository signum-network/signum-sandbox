import type { Transaction } from '@signumjs/core'

export type Query =
  | { kind: 'none' }
  | { kind: 'height'; height: number }
  | { kind: 'id'; value: string }
  | { kind: 'address'; value: string }
  | { kind: 'name'; value: string }

/**
 * A block height and an account id are both digits, so length decides: a
 * sandbox chain will not reach ten digits, and no Signum id is shorter.
 */
const ID_DIGITS = 10

/** One input, read differently depending on what it looks like. No syntax to learn. */
export function interpret(input: string): Query {
  const value = input.trim()
  if (!value) return { kind: 'none' }
  if (/^\d+$/.test(value)) {
    return value.length >= ID_DIGITS
      ? { kind: 'id', value }
      : { kind: 'height', height: Number(value) }
  }
  if (/^[A-Za-z]{1,4}-[A-Za-z0-9-]+$/.test(value)) return { kind: 'address', value }
  return { kind: 'name', value: value.toLowerCase() }
}

export function matchesTransaction(tx: Transaction, query: Query): boolean {
  switch (query.kind) {
    case 'none':
      return true
    case 'height':
      return tx.height === query.height
    case 'id':
      return tx.transaction === query.value
    case 'address':
      return tx.senderRS === query.value || tx.recipientRS === query.value
    case 'name': {
      const haystack = JSON.stringify(tx.attachment ?? {}).toLowerCase()
      return haystack.includes(query.value)
    }
  }
}
