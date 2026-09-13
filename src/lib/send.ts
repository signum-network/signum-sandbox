import { generateSignKeys } from '@signumjs/crypto'
import {
  Address,
  AttachmentMessage,
  type TransactionId,
  type UnsignedTransaction,
} from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { ledger, signingLedger } from './ledger'
import { knownPublicKey } from './recipient'
import { feeFor, type SendAction } from './fees'
import type { SandboxAccount } from './accounts'

/**
 * What every send takes on top of its own fields: the fee, when the sender
 * wants one other than the action's default.
 */
export interface Fee {
  fee?: Amount
}

const keysOf = (account: SandboxAccount) => generateSignKeys(account.passphrase)

/**
 * Every send shares these three fields. The fee defaults to what the action
 * needs — Signum's minimum is per transaction type, see feeFor in ./fees for
 * how each number was measured — and a caller can override it, because the
 * real minimum also rises with the attachment and only the sender knows what
 * they are willing to pay.
 */
const base = (account: SandboxAccount, action: SendAction, fee?: Amount) => {
  const keys = keysOf(account)
  return {
    feePlanck: (fee ?? feeFor(action)).getPlanck(),
    senderPublicKey: keys.publicKey,
    senderPrivateKey: keys.signPrivateKey,
  }
}

/** The API takes numeric ids; people type Reed-Solomon addresses. */
export const toNumericId = (addressOrId: string) =>
  /^\d+$/.test(addressOrId) ? addressOrId : Address.create(addressOrId).getNumericId()

/**
 * Every call site here always passes senderPrivateKey via `base`, so the result
 * is always a signed, broadcast TransactionId at runtime — the SDK's return
 * type only unions in UnsignedTransaction for the (unused here) unsigned path.
 */
const asId = (result: TransactionId | UnsignedTransaction) => (result as TransactionId).transaction

/**
 * The recipient's public key, announced on every send that has a recipient.
 *
 * The node rejects a transaction to an account it has never seen unless the
 * sender announces its public key, and a freshly created sandbox account is
 * exactly that. Rather than deciding case by case when it is needed, the key is
 * always resolved and always passed: from the sandbox's own accounts when it
 * owns the recipient, otherwise from the node, which already knows it for
 * anyone who has transacted. Undefined means nobody knows it, and the send will
 * fail — which is the honest outcome, not something to hide.
 *
 * The functions below take the resolved key as a required argument, so a form
 * cannot quietly omit it.
 */
export async function resolveRecipientPublicKey(
  to: string,
  accounts: SandboxAccount[],
): Promise<string | undefined> {
  const own = knownPublicKey(to, accounts)
  if (own) return own
  try {
    const account = await ledger.account.getAccount({ accountId: toNumericId(to) })
    return account.publicKey || undefined
  } catch {
    return undefined
  }
}

export interface PaymentArgs extends Fee {
  from: SandboxAccount
  to: string
  signa: string
  recipientPublicKey: string | undefined
  message?: string
}

export async function sendPayment({ from, to, signa, recipientPublicKey, message, fee }: PaymentArgs) {
  return asId(
    await signingLedger.transaction.sendAmountToSingleRecipient({
      ...base(from, 'payment', fee),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      recipientPublicKey,
      attachment: message ? new AttachmentMessage({ message, messageIsText: true }) : undefined,
    }),
  )
}

/**
 * Multi-out cannot announce anything: `MultioutRecipientAmount` carries only a
 * recipient and an amount, with no room for a public key. A recipient the chain
 * has never seen therefore cannot be paid this way — a protocol limit, not an
 * omission here. The form warns instead.
 */
export interface MultiOutArgs extends Fee {
  from: SandboxAccount
  recipients: { address: string; signa: string }[]
}

export interface MultiOutSameArgs extends Fee {
  from: SandboxAccount
  addresses: string[]
  signa: string
}

/**
 * The same amount to everyone, which is a different transaction type rather
 * than a convenience: one amount for the whole list instead of one per
 * recipient is what lets it carry twice as many — 128 against 64, measured.
 */
export async function sendMultiOutSame({ from, addresses, signa, fee }: MultiOutSameArgs) {
  return asId(
    await signingLedger.transaction.sendSameAmountToMultipleRecipients({
      ...base(from, 'multiOut', fee),
      recipientIds: addresses.map(toNumericId),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
    }),
  )
}

export async function sendMultiOut({ from, recipients, fee }: MultiOutArgs) {
  return asId(
    await signingLedger.transaction.sendAmountToMultipleRecipients({
      ...base(from, 'multiOut', fee),
      recipientAmounts: recipients.map((r) => ({
        recipient: toNumericId(r.address),
        amountNQT: Amount.fromSigna(r.signa).getPlanck(),
      })),
    }),
  )
}

export interface MessageArgs extends Fee {
  from: SandboxAccount
  to: string
  message: string
  recipientPublicKey: string | undefined
}

export async function sendPlainMessage({ from, to, message, recipientPublicKey, fee }: MessageArgs) {
  return asId(
    await signingLedger.message.sendMessage({
      ...base(from, 'message', fee),
      message,
      messageIsText: true,
      recipientId: toNumericId(to),
      recipientPublicKey,
    }),
  )
}

/**
 * Encryption needs the recipient's public key, which only exists once their
 * account is on chain — or, for a sandbox account, can be derived. The caller
 * resolves it and passes it in, so this function has no opinion about where it
 * came from.
 */
export interface EncryptedMessageArgs extends Fee {
  from: SandboxAccount
  to: string
  recipientPublicKey: string
  message: string
}

export async function sendEncryptedMessage({
  from,
  to,
  recipientPublicKey,
  message,
  fee,
}: EncryptedMessageArgs) {
  return asId(
    await signingLedger.message.sendEncryptedMessage({
      ...base(from, 'message', fee),
      message,
      messageIsText: true,
      recipientId: toNumericId(to),
      recipientPublicKey,
      senderAgreementKey: keysOf(from).agreementPrivateKey,
    }),
  )
}

/**
 * `description` is passed through exactly as given — the form decides whether
 * it is plain text or an SRC44 descriptor, and building one here as well
 * would wrap a descriptor inside another descriptor's description.
 */
export interface AccountInfoArgs extends Fee {
  account: SandboxAccount
  name: string
  description: string
}

export async function setAccountInfo({ account, name, description, fee }: AccountInfoArgs) {
  return asId(
    await signingLedger.account.setAccountInfo({
      ...base(account, 'accountInfo', fee),
      name,
      description,
    }),
  )
}

export interface IssueTokenArgs extends Fee {
  issuer: SandboxAccount
  name: string
  quantity: string
  decimals: number
  description: string
  mintable: boolean
}

export async function issueToken({
  issuer,
  name,
  quantity,
  decimals,
  description,
  mintable,
  fee,
}: IssueTokenArgs) {
  return asId(
    await signingLedger.asset.issueAsset({
      ...base(issuer, 'issueAsset', fee),
      name,
      quantity,
      decimals,
      description,
      mintable,
    }),
  )
}

/**
 * A transfer can carry a message alongside the asset — verified against
 * v3.9.11, where the transaction comes back holding both `version.AssetTransfer`
 * and `version.Message`. That message is a payload like any other, so it can
 * be an SRC44 descriptor: an application shipping a token can say what the
 * transfer was for in a form another application can read.
 */
export interface TransferTokenArgs extends Fee {
  from: SandboxAccount
  to: string
  assetId: string
  quantity: string
  recipientPublicKey: string | undefined
  message?: string
}

export async function transferToken({
  from,
  to,
  assetId,
  quantity,
  recipientPublicKey,
  message,
  fee,
}: TransferTokenArgs) {
  return asId(
    await signingLedger.asset.transferAsset({
      ...base(from, 'transferAsset', fee),
      assetId,
      quantity,
      recipientId: toNumericId(to),
      recipientPublicKey,
      attachment: message ? new AttachmentMessage({ message, messageIsText: true }) : undefined,
    }),
  )
}

/**
 * Only works on a token issued with `mintable: true` — the node answers
 * `"this asset is not mintable"` otherwise. The form is expected to have
 * already filtered its asset list down to mintable ones; this function
 * trusts that and lets the node be the final word regardless.
 */
export interface MintArgs extends Fee {
  issuer: SandboxAccount
  assetId: string
  quantity: string
}

export async function mintAsset({ issuer, assetId, quantity, fee }: MintArgs) {
  return asId(
    await signingLedger.asset.mintAsset({
      ...base(issuer, 'mintAsset', fee),
      assetId,
      quantity,
    }),
  )
}

export interface AliasArgs extends Fee {
  account: SandboxAccount
  aliasName: string
  content: string
}

export async function setAlias({ account, aliasName, content, fee }: AliasArgs) {
  return asId(
    await signingLedger.alias.setAlias({
      ...base(account, 'alias', fee),
      aliasName,
      aliasURI: content,
    }),
  )
}

/**
 * Handing an alias to someone else.
 *
 * Signum has no transfer of its own: an alias moves by being sold to a named
 * recipient, and a sale at zero is what a gift looks like on this chain. The
 * price is fixed at zero here rather than exposed, because selling aliases is
 * a marketplace feature and the sandbox is not a marketplace.
 */
export interface AliasTransferArgs extends Fee {
  from: SandboxAccount
  aliasName: string
  to: string
  recipientPublicKey: string | undefined
}

export async function transferAlias({
  from,
  aliasName,
  to,
  recipientPublicKey,
  fee,
}: AliasTransferArgs) {
  return asId(
    await signingLedger.alias.sellAlias({
      ...base(from, 'alias', fee),
      aliasName,
      amountPlanck: '0',
      recipientId: toNumericId(to),
      recipientPublicKey,
    }),
  )
}

export interface SubscriptionArgs extends Fee {
  from: SandboxAccount
  to: string
  signa: string
  frequency: number
  recipientPublicKey: string | undefined
}

export async function createSubscription({
  from,
  to,
  signa,
  frequency,
  recipientPublicKey,
  fee,
}: SubscriptionArgs) {
  return asId(
    await signingLedger.transaction.createSubscription({
      ...base(from, 'subscription', fee),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      recipientPublicKey,
      frequency,
    }),
  )
}

/**
 * Cancels a subscription this account pays on — not one that pays it.
 * `getAccountSubscriptions(accountId)` is documented as listing subscriptions
 * where the account is the sender, but checked live against this node it
 * actually returns a subscription for either party, and the node accepted a
 * cancellation signed by the recipient rather than the sender just as
 * readily. So the "only what this account pays" guarantee has to come from
 * the caller filtering by `sender`, not from the query or the node — see
 * SubscriptionCancelForm, which does that filtering before ever calling this.
 */
export interface CancelSubscriptionArgs extends Fee {
  account: SandboxAccount
  subscriptionId: string
}

export async function cancelSubscription({ account, subscriptionId, fee }: CancelSubscriptionArgs) {
  return asId(
    await signingLedger.transaction.cancelSubscription({
      ...base(account, 'cancelSubscription', fee),
      subscriptionId,
    }),
  )
}
