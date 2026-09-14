import type { Transaction } from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { kindOf, type TxKind } from './txKind'

export type { TxKind }

export interface TxSummary {
  kind: TxKind
  senderRS: string | null
  recipientRS: string | null
  /** Null when the transaction moves no SIGNA, so the row stays quiet about it. */
  amountSigna: string | null
}

export function summarize(tx: Transaction): TxSummary {
  const planck = tx.amountNQT ?? '0'
  return {
    kind: kindOf(tx),
    senderRS: tx.senderRS ?? null,
    recipientRS: tx.recipientRS ?? null,
    amountSigna: planck === '0' ? null : Amount.fromPlanck(planck).getSigna(),
  }
}
