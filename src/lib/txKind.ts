import {
  TransactionType,
  TransactionPaymentSubtype,
  TransactionArbitrarySubtype,
  TransactionAssetSubtype,
  TransactionLeasingSubtype,
  TransactionMiningSubtype,
  TransactionAdvancedPaymentSubtype,
  TransactionSmartContractSubtype,
  type Transaction,
} from '@signumjs/core'

/**
 * What a transaction is, in the console's own words.
 *
 * One name per subtype the chain can produce, because a developer reading
 * their own transaction back should see what they made rather than
 * "Transaction". The marketplace is the one exclusion: it is a dead feature
 * on Signum and the spec leaves it out.
 *
 * Each name is also a translation key — `console.kind.<name>` — and
 * txKind.test.ts checks that English has every one of them.
 */
export const TX_KINDS = [
  'payment',
  'multiOut',
  'multiOutSame',
  'message',
  'encryptedMessage',
  'alias',
  'aliasSale',
  'aliasBuy',
  'tld',
  'accountInfo',
  'poll',
  'vote',
  'hubAnnouncement',
  'tokenIssue',
  'tokenTransfer',
  'tokenMultiTransfer',
  'askOrder',
  'bidOrder',
  'askOrderCancel',
  'bidOrderCancel',
  'mintAsset',
  'treasuryAccount',
  'distributeToHolders',
  'tokenOwnership',
  'leasing',
  'rewardRecipient',
  'addCommitment',
  'removeCommitment',
  'escrowCreate',
  'escrowSign',
  'escrowResult',
  'subscription',
  'cancelSubscription',
  'subscriptionPayment',
  'contractCreate',
  'contractPayment',
  'burn',
  'reward',
  'other',
] as const

export type TxKind = (typeof TX_KINDS)[number]

const attachment = (tx: Transaction) => (tx.attachment ?? {}) as Record<string, unknown>

const ARBITRARY: Record<number, TxKind> = {
  [TransactionArbitrarySubtype.AliasAssignment]: 'alias',
  [TransactionArbitrarySubtype.PollCreation]: 'poll',
  [TransactionArbitrarySubtype.VoteCasting]: 'vote',
  [TransactionArbitrarySubtype.HubAnnouncement]: 'hubAnnouncement',
  [TransactionArbitrarySubtype.AccountInfo]: 'accountInfo',
  [TransactionArbitrarySubtype.AliasSale]: 'aliasSale',
  [TransactionArbitrarySubtype.AliasBuy]: 'aliasBuy',
  [TransactionArbitrarySubtype.TopLevelDomainAssignment]: 'tld',
}

const ASSET: Record<number, TxKind> = {
  [TransactionAssetSubtype.AssetIssuance]: 'tokenIssue',
  [TransactionAssetSubtype.AssetTransfer]: 'tokenTransfer',
  [TransactionAssetSubtype.AskOrderPlacement]: 'askOrder',
  [TransactionAssetSubtype.BidOrderPlacement]: 'bidOrder',
  [TransactionAssetSubtype.AskOrderCancellation]: 'askOrderCancel',
  [TransactionAssetSubtype.BidOrderCancellation]: 'bidOrderCancel',
  [TransactionAssetSubtype.AssetMint]: 'mintAsset',
  [TransactionAssetSubtype.AssetAddTreasureyAccount]: 'treasuryAccount',
  [TransactionAssetSubtype.AssetDistributeToHolders]: 'distributeToHolders',
  [TransactionAssetSubtype.AssetMultiTransfer]: 'tokenMultiTransfer',
  [TransactionAssetSubtype.AssetTransferOwnership]: 'tokenOwnership',
}

const MINING: Record<number, TxKind> = {
  [TransactionMiningSubtype.RewardRecipientAssignment]: 'rewardRecipient',
  [TransactionMiningSubtype.AddCommitment]: 'addCommitment',
  [TransactionMiningSubtype.RemoveCommitment]: 'removeCommitment',
}

const ADVANCED: Record<number, TxKind> = {
  [TransactionAdvancedPaymentSubtype.EscrowCreation]: 'escrowCreate',
  [TransactionAdvancedPaymentSubtype.EscrowSigning]: 'escrowSign',
  [TransactionAdvancedPaymentSubtype.EscrowResult]: 'escrowResult',
  [TransactionAdvancedPaymentSubtype.SubscriptionSubscribe]: 'subscription',
  [TransactionAdvancedPaymentSubtype.SubscriptionCancel]: 'cancelSubscription',
  [TransactionAdvancedPaymentSubtype.SubscriptionPayment]: 'subscriptionPayment',
}

const CONTRACT: Record<number, TxKind> = {
  [TransactionSmartContractSubtype.SmartContractCreation]: 'contractCreate',
  [TransactionSmartContractSubtype.SmartContractPayment]: 'contractPayment',
}

/**
 * Signum's burn address. Anything sent here is destroyed rather than
 * delivered, so the recipient has to be read before the subtype: a payment
 * to `0` is not a payment to an account called zero, and a row that says so
 * is telling a developer something false about their own transaction.
 *
 * Arbitrary transactions are the exception. There address `0` means "no one
 * in particular" rather than "nobody ever": an alias offered to the whole
 * chain instead of to a named buyer carries recipient `0` and destroys
 * nothing, and calling that a burn would be the same lie in reverse.
 */
const BURN_ADDRESS = '0'

const isBurn = (tx: Transaction) =>
  tx.recipient === BURN_ADDRESS && tx.type !== TransactionType.Arbitrary

export function kindOf(tx: Transaction): TxKind {
  // A block reward has no sender: the chain itself credited the forger.
  if (!tx.senderRS) return 'reward'

  if (isBurn(tx)) return 'burn'

  switch (tx.type) {
    case TransactionType.Payment:
      if (tx.subtype === TransactionPaymentSubtype.Ordinary) return 'payment'
      return tx.subtype === TransactionPaymentSubtype.MultiOut ? 'multiOut' : 'multiOutSame'
    case TransactionType.Arbitrary:
      // The one place the subtype is not enough: a message is one subtype and
      // two very different things, and which one it is decides whether the
      // console can show the text at all.
      if (tx.subtype === TransactionArbitrarySubtype.Message) {
        return attachment(tx).encryptedMessage ? 'encryptedMessage' : 'message'
      }
      return ARBITRARY[tx.subtype] ?? 'other'
    case TransactionType.Asset:
      return ASSET[tx.subtype] ?? 'other'
    case TransactionType.Leasing:
      return tx.subtype === TransactionLeasingSubtype.Ordinary ? 'leasing' : 'other'
    case TransactionType.Mining:
      return MINING[tx.subtype] ?? 'other'
    case TransactionType.AdvancedPayment:
      return ADVANCED[tx.subtype] ?? 'other'
    case TransactionType.SmartContract:
      return CONTRACT[tx.subtype] ?? 'other'
    default:
      return 'other'
  }
}
