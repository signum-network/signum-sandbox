/**
 * The intervals auto-forge offers, in seconds.
 *
 * Five is the floor rather than a round number: two submitNonce calls closer
 * together than that compete for the same height, so the node answers success
 * to both and produces one block. Offering a faster setting would promise
 * blocks the chain will not deliver.
 */
export const AUTO_INTERVALS_S = [5, 10, 30, 60] as const

export const DEFAULT_AUTO_INTERVAL_S = 5

/**
 * Storage written by an older version or by hand must not leave auto-forge
 * spinning at some nonsense rate, so anything outside the offered set falls
 * back to the default.
 */
export function parseAutoInterval(raw: string | null): number {
  const seconds = Number(raw)
  return (AUTO_INTERVALS_S as readonly number[]).includes(seconds)
    ? seconds
    : DEFAULT_AUTO_INTERVAL_S
}
