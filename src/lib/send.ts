import { generateSignKeys } from '@signumjs/crypto'
import {
  Address,
  AttachmentMessage,
  type TransactionId,
  type UnsignedTransaction,
} from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { src44 } from '@signumjs/standards'
import { signingLedger } from './ledger'
import type { SandboxAccount } from './accounts'

const { DescriptorDataBuilder } = src44

/**
 * The mock chain has no fee market. One tenth of a SIGNA clears everything the
 * console sends and keeps the forms free of a field nobody wants to think about.
 */
export const DEFAULT_FEE = Amount.fromSigna(0.1)

const keysOf = (account: SandboxAccount) => generateSignKeys(account.passphrase)

/** Every send shares these three fields. */
const base = (account: SandboxAccount) => {
  const keys = keysOf(account)
  return {
    feePlanck: DEFAULT_FEE.getPlanck(),
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

export async function sendPayment(
  from: SandboxAccount,
  to: string,
  signa: string,
  message?: string,
) {
  return asId(
    await signingLedger.transaction.sendAmountToSingleRecipient({
      ...base(from),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      attachment: message ? new AttachmentMessage({ message, messageIsText: true }) : undefined,
    }),
  )
}

export async function sendMultiOut(
  from: SandboxAccount,
  recipients: { address: string; signa: string }[],
) {
  return asId(
    await signingLedger.transaction.sendAmountToMultipleRecipients({
      ...base(from),
      recipientAmounts: recipients.map((r) => ({
        recipient: toNumericId(r.address),
        amountNQT: Amount.fromSigna(r.signa).getPlanck(),
      })),
    }),
  )
}

export async function sendPlainMessage(from: SandboxAccount, to: string, message: string) {
  return asId(
    await signingLedger.message.sendMessage({
      ...base(from),
      message,
      messageIsText: true,
      recipientId: toNumericId(to),
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
      ...base(from),
      message,
      messageIsText: true,
      recipientId: toNumericId(to),
      recipientPublicKey,
      senderAgreementKey: keysOf(from).agreementPrivateKey,
    }),
  )
}

export async function setAccountInfo(
  account: SandboxAccount,
  name: string,
  description: string,
) {
  // SRC44 is what makes the description machine-readable; building it through
  // DescriptorDataBuilder means what lands on chain is valid by construction.
  const descriptor = DescriptorDataBuilder.create(name).setDescription(description).build()
  return asId(
    await signingLedger.account.setAccountInfo({
      ...base(account),
      name,
      description: descriptor.stringify(),
    }),
  )
}

export async function issueToken(
  issuer: SandboxAccount,
  name: string,
  quantity: string,
  decimals: number,
  description: string,
) {
  return asId(
    await signingLedger.asset.issueAsset({
      ...base(issuer),
      name,
      quantity,
      decimals,
      description,
      mintable: false,
    }),
  )
}

export async function transferToken(
  from: SandboxAccount,
  to: string,
  assetId: string,
  quantity: string,
) {
  return asId(
    await signingLedger.asset.transferAsset({
      ...base(from),
      assetId,
      quantity,
      recipientId: toNumericId(to),
    }),
  )
}

export async function setAlias(account: SandboxAccount, aliasName: string, content: string) {
  return asId(
    await signingLedger.alias.setAlias({ ...base(account), aliasName, aliasURI: content }),
  )
}

export async function createSubscription(
  from: SandboxAccount,
  to: string,
  signa: string,
  frequency: number,
) {
  return asId(
    await signingLedger.transaction.createSubscription({
      ...base(from),
      amountPlanck: Amount.fromSigna(signa).getPlanck(),
      recipientId: toNumericId(to),
      frequency,
    }),
  )
}
