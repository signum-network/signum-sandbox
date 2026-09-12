/** popOff reaches at most 1440 blocks back. */
const POP_OFF_REACH = 1440

export type ResetStage = 'popOff' | 'fullReset'

/**
 * Reset walks these stages in order and stops at the first that demonstrably
 * worked. popOff is preferred because it needs no restart; on a chain too long
 * for its reach it cannot get back to the start, so it is not attempted at all.
 *
 * Pure and free of any client import, so its test runs under the repository's
 * node test environment without a DOM.
 */
export function resetPlan(height: number): ResetStage[] {
  if (height <= 1) return []
  return height - 1 <= POP_OFF_REACH ? ['popOff', 'fullReset'] : ['fullReset']
}
