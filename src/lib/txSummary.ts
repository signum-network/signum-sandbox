import {
  TransactionType,
  TransactionPaymentSubtype,
  TransactionArbitrarySubtype,
  TransactionAssetSubtype,
  TransactionAdvancedPaymentSubtype,
  type Transaction,
} from '@signumjs/core'
import { Amount } from '@signumjs/util'

export type TxKind =
  | 'payment'
  | 'multiOut'
  | 'message'
  | 'encryptedMessage'
  | 'accountInfo'
  | 'tokenIssue'
  | 'tokenTransfer'
  | 'alias'
  | 'subscription'
  | 'reward'
  | 'other'

export interface TxSummary {
  kind: TxKind
  senderRS: string | null
  recipientRS: string | null
  /** Null when the transaction moves no SIGNA, so the row stays quiet about it. */
  amountSigna: string | null
}

const attachment = (tx: Transaction) => (tx.attachment ?? {}) as Record<string, unknown>

function kindOf(tx: Transaction): TxKind {
  // A block reward has no sender: the chain itself credited the forger.
  if (!tx.senderRS) return 'reward'

  switch (tx.type) {
    case TransactionType.Payment:
      return tx.subtype === TransactionPaymentSubtype.Ordinary ? 'payment' : 'multiOut'
    case TransactionType.Arbitrary:
      if (tx.subtype === TransactionArbitrarySubtype.AliasAssignment) return 'alias'
      if (tx.subtype === TransactionArbitrarySubtype.AccountInfo) return 'accountInfo'
      if (tx.subtype === TransactionArbitrarySubtype.Message) {
        return attachment(tx).encryptedMessage ? 'encryptedMessage' : 'message'
      }
      return 'other'
    case TransactionType.Asset:
      if (tx.subtype === TransactionAssetSubtype.AssetIssuance) return 'tokenIssue'
      if (tx.subtype === TransactionAssetSubtype.AssetTransfer) return 'tokenTransfer'
      return 'other'
    case TransactionType.AdvancedPayment:
      return tx.subtype === TransactionAdvancedPaymentSubtype.SubscriptionSubscribe
        ? 'subscription'
        : 'other'
    default:
      return 'other'
  }
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
