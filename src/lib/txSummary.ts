import { getRecipientAmountsFromMultiOutPayment, type Transaction } from '@signumjs/core'
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

/**
 * What a multi-out actually moved.
 *
 * `amountNQT` is zero on both multi-out shapes — the money is in the
 * attachment, one figure per recipient — so reading the field the way every
 * other transaction is read makes the one kind that moves the most money the
 * only kind that reports nothing. The SDK's reader handles both shapes and
 * is used rather than a second hand-rolled one: sniffing the attachment for
 * which shape it is, is exactly the code that once turned a same-amount
 * multi-out into fabricated SIGNA figures.
 */
function multiOutTotal(tx: Transaction): string | null {
  try {
    const total = getRecipientAmountsFromMultiOutPayment(tx).reduce(
      (sum, { amountNQT }) => sum.add(Amount.fromPlanck(amountNQT)),
      Amount.Zero(),
    )
    return total.equals(Amount.Zero()) ? null : total.getSigna()
  } catch {
    // It throws on anything that is not a multi-out. Reaching that means the
    // kind and the attachment disagree, which is the node's word against
    // ours — stay quiet rather than guess.
    return null
  }
}

export function summarize(tx: Transaction): TxSummary {
  const kind = kindOf(tx)
  const planck = tx.amountNQT ?? '0'
  return {
    kind,
    senderRS: tx.senderRS ?? null,
    recipientRS: tx.recipientRS ?? null,
    amountSigna:
      kind === 'multiOut' || kind === 'multiOutSame'
        ? multiOutTotal(tx)
        : planck === '0'
          ? null
          : Amount.fromPlanck(planck).getSigna(),
  }
}
