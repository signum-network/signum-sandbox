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
