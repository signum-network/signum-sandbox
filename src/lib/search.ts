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

/**
 * The predicate both the owned-accounts list and the contact book filter
 * through, so the one search field behaves the same way over both: a name
 * query matches case-insensitively as a substring, an address query matches
 * exactly (nobody types half an address), and every other kind — height, id,
 * or no query at all — doesn't apply to an account-shaped row, so it passes
 * everything rather than hiding rows a height or transaction id query was
 * never meant to filter.
 */
export function matchesAccountQuery(name: string, address: string, query: Query): boolean {
  if (query.kind === 'name') return name.toLowerCase().includes(query.value)
  if (query.kind === 'address') return address === query.value
  return true
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
