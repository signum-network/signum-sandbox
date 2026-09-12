import { ledger } from './ledger'

/** Matches API.adminKeyList in conf/node.properties. */
const ADMIN_KEY = 'sandbox'

/** popOff reaches at most 1440 blocks back. */
const POP_OFF_REACH = 1440

export type ResetStage = 'popOff' | 'fullReset'

/**
 * Reset walks these stages in order and stops at the first that works. popOff
 * is preferred because it needs no restart; on a chain too long for its reach
 * it cannot get back to the start, so it is not attempted at all.
 */
export function resetPlan(height: number): ResetStage[] {
  if (height <= 1) return []
  return height - 1 <= POP_OFF_REACH ? ['popOff', 'fullReset'] : ['fullReset']
}

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

/**
 * Attempts each stage of the plan and reports which one worked. A null result
 * means the caller has to tell the user to run scripts/reset.sh — silently
 * doing nothing after a confirmed destructive action is the worst outcome here.
 */
export async function resetChain(height: number): Promise<ResetOutcome> {
  for (const stage of resetPlan(height)) {
    try {
      if (stage === 'popOff') await popOffTo(1)
      else await fullReset()
      return { succeeded: stage }
    } catch {
      // Fall through to the next stage.
    }
  }
  return { succeeded: null }
}
