/**
 * A token quantity as people read it.
 *
 * Signum stores an asset quantity as an integer in its smallest unit, and the
 * asset's own `decimals` says where the point goes — 1000 with 2 decimals is
 * ten whole tokens. Showing the raw integer would misstate the amount by a
 * factor of a hundred, so this is not cosmetic.
 */
export function formatQuantity(quantityQNT: string, decimals: number): string {
  if (decimals <= 0) return quantityQNT
  const padded = quantityQNT.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/**
 * Whether an amount asks for a finer division than a token has.
 *
 * A token with two decimals cannot hold a thousandth, and silently rounding
 * one away would move somebody's money.
 */
export function finerThanToken(amount: string, decimals: number): boolean {
  const fraction = amount.split('.')[1] ?? ''
  return fraction.length > decimals
}

/**
 * A written amount, in the smallest unit the chain counts in.
 *
 * The inverse of `formatQuantity`, and the reason it exists: a quantity is
 * stored as an integer of smallest units, so "250.5" of a two-decimal token
 * is 25050. Anywhere a person writes an amount, this is what has to happen to
 * it before the chain sees it — otherwise the number on screen and the number
 * on the chain differ by a factor of a hundred, which is the kind of mistake
 * nobody catches until the supply is already issued.
 *
 * Assumes `finerThanToken` has already said no. A fraction longer than the
 * token allows would be truncated here, and truncating money is not this
 * function's decision to make.
 */
export function toSmallestUnit(amount: string, decimals: number): string {
  const [whole, fraction = ''] = amount.split('.')
  const padded = (whole + fraction.padEnd(decimals, '0').slice(0, decimals)).replace(/^0+(?=\d)/, '')
  return padded === '' ? '0' : padded
}
