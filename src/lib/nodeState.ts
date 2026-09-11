export type Connection = 'live' | 'polling'

export interface DeriveInput {
  /** Last successful getBlockchainStatus, if one has arrived. */
  status?: {
    numberOfBlocks: number
    version: string
    cumulativeDifficulty: string
    isScanning: boolean
  }
  /** Timestamp of the last block in epoch milliseconds. */
  lastBlockMs?: number
  networkName?: string
  statusFailed: boolean
  socketConnected: boolean
  now: number
}

export type NodeState =
  | { kind: 'unreachable' }
  | {
      kind: 'ready'
      networkName: string | null
      version: string | null
      height: number | null
      cumulativeDifficulty: string | null
      lastBlockAgeMs: number | null
      connection: Connection
      scanning: boolean
    }

/**
 * A failed call only means "unreachable" while we have never had an answer.
 * Once a status is known we keep showing it: a mock node gets restarted often,
 * and blanking the page on every restart would be noise, not information.
 */
export function deriveNodeState(input: DeriveInput): NodeState {
  if (input.statusFailed && !input.status) return { kind: 'unreachable' }

  return {
    kind: 'ready',
    networkName: input.networkName ?? null,
    version: input.status?.version ?? null,
    height: input.status?.numberOfBlocks ?? null,
    cumulativeDifficulty: input.status?.cumulativeDifficulty ?? null,
    lastBlockAgeMs:
      input.lastBlockMs === undefined ? null : Math.max(0, input.now - input.lastBlockMs),
    connection: input.socketConnected ? 'live' : 'polling',
    scanning: input.status?.isScanning ?? false,
  }
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** Negating zero yields -0, which Intl.RelativeTimeFormat may read as the past. */
const intoPast = (n: number) => (n === 0 ? 0 : -n)

/**
 * Picks the coarsest unit that still reads naturally, for Intl.RelativeTimeFormat.
 * Returns negative values because every age is in the past.
 */
export function relativeParts(ageMs: number): {
  value: number
  unit: Intl.RelativeTimeFormatUnit
} {
  const age = Math.max(0, ageMs)
  if (age < MINUTE) return { value: intoPast(Math.floor(age / 1000)), unit: 'second' }
  if (age < HOUR) return { value: intoPast(Math.floor(age / MINUTE)), unit: 'minute' }
  if (age < DAY) return { value: intoPast(Math.floor(age / HOUR)), unit: 'hour' }
  return { value: intoPast(Math.floor(age / DAY)), unit: 'day' }
}
