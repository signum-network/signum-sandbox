export type MultiOutVariant = 'individual' | 'same'

/**
 * How many recipients each variant takes.
 *
 * Measured against the running node rather than taken from documentation: 65
 * recipients on `sendMoneyMulti` and 129 on `sendMoneyMultiSame` both come
 * back as `Invalid recipients parameter`, while 64 and 128 get past that
 * check. The difference is what fits in the attachment — individual amounts
 * cost a number per recipient, the same amount costs one for all of them.
 */
export const MULTI_OUT_LIMITS: Record<MultiOutVariant, number> = {
  individual: 64,
  same: 128,
}

export interface Recipient {
  address: string
  /** In SIGNA. Ignored by the same-amount variant, which carries one for all. */
  signa: string
}

export const EMPTY_RECIPIENT: Recipient = { address: '', signa: '' }

/**
 * Recipients pasted in bulk: one per line, an optional amount after a comma.
 *
 * Seeding twenty recipients by hand would be worse than the textarea this
 * replaced, so pasting stays possible — but as a way to fill the rows, not as
 * the way to enter them. A line with no amount is a row with an empty amount,
 * which the same-amount variant does not need anyway.
 */
export function parseRecipients(text: string): Recipient[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [address, signa = ''] = line.split(',').map((part) => part.trim())
      return { address, signa }
    })
    .filter((r) => r.address !== '')
}

/** Rows that name a recipient. An empty row is a row someone has not filled in yet. */
export const filledRecipients = (rows: Recipient[]) =>
  rows.filter((r) => r.address.trim() !== '')

export type RecipientProblem = 'none' | 'empty' | 'tooMany' | 'missingAmount'

/**
 * What is wrong with these rows, if anything — checked here rather than at the
 * node, because the node answers a list of 200 recipients with one flat
 * rejection and no hint about which limit was crossed.
 */
export function checkRecipients(
  rows: Recipient[],
  variant: MultiOutVariant,
): RecipientProblem {
  const filled = filledRecipients(rows)
  if (filled.length === 0) return 'empty'
  if (filled.length > MULTI_OUT_LIMITS[variant]) return 'tooMany'
  if (variant === 'individual' && filled.some((r) => r.signa.trim() === '')) {
    return 'missingAmount'
  }
  return 'none'
}
