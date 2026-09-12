import { ledger } from './ledger'
import { resetPlan, type ResetStage } from './resetPlan'

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

export const fullReset = () => admin('fullReset')

export const clearUnconfirmed = () => admin('clearUnconfirmedTransactions')

export type ResetOutcome = { succeeded: ResetStage } | { succeeded: null }

/** Genesis plus block 1 — what a chain looks like once it is back at the start. */
const START_HEIGHT = 2

const currentHeight = async () =>
  (await ledger.network.getBlockchainStatus()).numberOfBlocks

/**
 * Attempts each stage and reads the chain back rather than trusting the answer.
 * Verified against v3.9.11: `fullReset` responds {"done":true} and leaves the
 * database untouched, because Flyway's clean is disabled in the node build. A
 * stage that lies is exactly why success is measured, not reported.
 *
 * A null result means the caller has to tell the user to run scripts/reset.sh.
 */
export async function resetChain(height: number): Promise<ResetOutcome> {
  for (const stage of resetPlan(height)) {
    try {
      if (stage === 'popOff') await popOffTo(1)
      else await fullReset()
      if ((await currentHeight()) <= START_HEIGHT) return { succeeded: stage }
    } catch {
      // Fall through to the next stage.
    }
  }
  return { succeeded: null }
}
