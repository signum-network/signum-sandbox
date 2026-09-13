/** popOff reaches at most 1440 blocks back. */
const POP_OFF_REACH = 1440

/**
 * Genesis plus block 1 — as far back as the chain can be rewound from inside
 * the console, and therefore what "at the start" means here.
 *
 * It is not an empty chain. `popOff` refuses height 0 outright (`invalid
 * numBlocks or height`), so block 1 always survives, along with the 10,000
 * SIGNA its forger was paid for it. A genuinely empty chain means deleting the
 * database, which needs the node stopped — `start.sh --reset` does that, and
 * the drawer says so rather than pretending otherwise.
 */
export const START_HEIGHT = 2

export type RewindProblem = 'none' | 'alreadyAtStart' | 'outOfReach'

/**
 * Whether the chain can be wound back from here, and if not, why.
 *
 * Pure and free of any client import, so its test runs under the repository's
 * node test environment without a DOM.
 */
export function rewindProblem(height: number): RewindProblem {
  if (height <= START_HEIGHT) return 'alreadyAtStart'
  return height - 1 <= POP_OFF_REACH ? 'none' : 'outOfReach'
}
