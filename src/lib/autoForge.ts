/**
 * The rates auto-forge offers, in seconds.
 *
 * Five is the floor rather than a round number: two submitNonce calls closer
 * together than that compete for the same height, so the node answers success
 * to both and produces one block. Offering a faster setting would promise
 * blocks the chain will not deliver.
 *
 * 240 is the other end and the only one with a meaning outside this sandbox —
 * it is Signum's average block time on mainnet. Picking it turns the sandbox
 * into an honest preview of how an application feels against the real chain,
 * where a confirmation is a wait and not a blink.
 */
export const AUTO_INTERVALS_S = [5, 10, 30, 60, 240] as const

export const DEFAULT_AUTO_INTERVAL_S = 5

/** The one rate that is not an arbitrary choice; the UI says why. */
export const MAINNET_INTERVAL_S = 240

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

/** A rate as a label: seconds while they stay readable, minutes once they do not. */
export function formatInterval(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`
}

/**
 * Time left until the next block, counted down. Under a minute the seconds
 * alone are what someone is watching; above it, m:ss — because "173 s" is a
 * number to decode and "2:53" is a glance.
 */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000))
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}
