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

const keysOf = (account: SandboxAccount) => generateSignKeys(account.passphrase)

/**
 * Every send shares these three fields. The fee is looked up per action
 * rather than fixed, since Signum's minimum fee is set per transaction
 * type — see feeFor's comment in ./fees for how each number was measured.
 */
const base = (account: SandboxAccount, action: SendAction) => {
  const keys = keysOf(account)
  return {
    feePlanck: feeFor(action).getPlanck(),
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

export async function sendPayment(
  from: SandboxAccount,
  to: string,
  signa: string,
  recipientPublicKey: string | undefined,
  message?: string,
) {
  return asId(
    await signingLedger.transaction.sendAmountToSingleRecipient({
      ...base(from, 'payment'),
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
export async function sendMultiOut(
  from: SandboxAccount,
  recipients: { address: string; signa: string }[],
) {
  return asId(
    await signingLedger.transaction.sendAmountToMultipleRecipients({
      ...base(from, 'multiOut'),
      recipientAmounts: recipients.map((r) => ({
        recipient: toNumericId(r.address),
        amountNQT: Amount.fromSigna(r.signa).getPlanck(),
      })),
    }),
  )
}

export async function sendPlainMessage(
  from: SandboxAccount,
  to: string,
  message: string,
  recipientPublicKey: string | undefined,
) {
  return asId(
    await signingLedger.message.sendMessage({
      ...base(from, 'message'),
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
export async function sendEncryptedMessage(
  from: SandboxAccount,
  to: string,
  recipientPublicKey: string,
  message: string,
) {
  return asId(
    await signingLedger.message.sendEncryptedMessage({
      ...base(from, 'message'),
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
export async function setAccountInfo(
  account: SandboxAccount,
  name: string,
  description: string,
) {
  return asId(
    await signingLedger.account.setAccountInfo({
      ...base(account, 'accountInfo'),
      name,
      description,
    }),
  )
}

export async function issueToken(
  issuer: SandboxAccount,
  name: string,
  quantity: string,
  decimals: number,
  description: string,
  mintable: boolean,
) {
  return asId(
    await signingLedger.asset.issueAsset({
      ...base(issuer, 'issueAsset'),
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
export async function transferToken(
  from: SandboxAccount,
  to: string,
  assetId: string,
  quantity: string,
  recipientPublicKey: string | undefined,
  message?: string,
) {
  return asId(
    await signingLedger.asset.transferAsset({
      ...base(from, 'transferAsset'),
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
export async function mintAsset(issuer: SandboxAccount, assetId: string, quantity: string) {
  return asId(
    await signingLedger.asset.mintAsset({
      ...base(issuer, 'mintAsset'),
      assetId,
      quantity,
    }),
  )
}

export async function setAlias(account: SandboxAccount, aliasName: string, content: string) {
  return asId(
    await signingLedger.alias.setAlias({
      ...base(account, 'alias'),
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
export async function transferAlias(
  from: SandboxAccount,
  aliasName: string,
  to: string,
  recipientPublicKey: string | undefined,
) {
  return asId(
    await signingLedger.alias.sellAlias({
      ...base(from, 'alias'),
      aliasName,
      amountPlanck: '0',
      recipientId: toNumericId(to),
      recipientPublicKey,
    }),
  )
}

export async function createSubscription(
  from: SandboxAccount,
  to: string,
  signa: string,
  frequency: number,
  recipientPublicKey: string | undefined,
) {
  return asId(
    await signingLedger.transaction.createSubscription({
      ...base(from, 'subscription'),
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
export async function cancelSubscription(account: SandboxAccount, subscriptionId: string) {
  return asId(
    await signingLedger.transaction.cancelSubscription({
      ...base(account, 'cancelSubscription'),
      subscriptionId,
    }),
  )
}
