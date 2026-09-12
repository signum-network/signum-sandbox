/** popOff reaches at most 1440 blocks back. */
const POP_OFF_REACH = 1440

/**
 * Genesis plus block 1 — what a freshly bootstrapped or freshly reset chain
 * looks like. The single definition of "at the start" for both this plan and
 * chainAdmin's success check: they used to disagree (this file said `<= 1`,
 * chainAdmin said `<= 2`), which made a fresh chain report a *failed* reset
 * instead of nothing-to-do.
 */
export const START_HEIGHT = 2

export type ResetStage = 'popOff' | 'fullReset'

/**
 * Reset walks these stages in order and stops at the first that demonstrably
 * worked. popOff is preferred because it needs no restart; on a chain too long
 * for its reach it cannot get back to the start, so it is not attempted at all.
 * An empty plan means there is nothing to reset, not that resetting failed.
 *
 * Pure and free of any client import, so its test runs under the repository's
 * node test environment without a DOM.
 */
export function resetPlan(height: number): ResetStage[] {
  if (height <= START_HEIGHT) return []
  return height - 1 <= POP_OFF_REACH ? ['popOff', 'fullReset'] : ['fullReset']
}
