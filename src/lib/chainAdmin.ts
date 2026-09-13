import { ledger } from './ledger'
import { START_HEIGHT, rewindProblem, type RewindProblem } from './rewind'

/** Matches API.adminKeyList in conf/node.properties. */
const ADMIN_KEY = 'sandbox'

/**
 * These requests have no typed SignumJS method, so they go through the generic
 * escape hatch the foundation spec reserved for exactly this. `send` is the
 * POST variant — `query` issues a GET, and the admin endpoints are POST-only.
 */
const admin = (requestType: string, params: Record<string, string> = {}) =>
  ledger.service.send(requestType, { ...params, apiKey: ADMIN_KEY })

/**
 * Forging deliberately omits accountId: passing it sends the node down its
 * passthrough-mining path, which fails once the passphrase's account exists.
 * The mock network accepts any nonce.
 */
export const forge = (secretPhrase: string) =>
  ledger.service.send('submitNonce', { secretPhrase, nonce: '0' })

export const popOffTo = (height: number) => admin('popOff', { height: String(height) })

export const clearUnconfirmed = () => admin('clearUnconfirmedTransactions')

/**
 * What a rewind did, or why it did nothing.
 *
 * `fullReset` used to sit behind this as a second stage and has been removed
 * rather than kept for luck: verified against v3.9.11 it answers
 * `{"done":true}` and leaves the database untouched, because Flyway's clean is
 * disabled inside the node — a JVM `-Dflyway.cleanDisabled=false` does not
 * lift it either, since the node sets the flag in code. A stage that always
 * lies is worse than no stage.
 */
export type RewindOutcome = { kind: 'succeeded' } | { kind: RewindProblem } | { kind: 'failed' }

const currentHeight = async () => (await ledger.network.getBlockchainStatus()).numberOfBlocks

/**
 * Winds the chain back to block 1 and reads the height afterwards rather than
 * trusting the answer — the console's one habit worth keeping from when its
 * predecessor could report a success it had not achieved.
 */
export async function rewindChain(height: number): Promise<RewindOutcome> {
  const problem = rewindProblem(height)
  if (problem !== 'none') return { kind: problem }
  try {
    await popOffTo(1)
    return (await currentHeight()) <= START_HEIGHT ? { kind: 'succeeded' } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
