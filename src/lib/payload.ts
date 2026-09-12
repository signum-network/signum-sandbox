import type { Transaction } from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { src44 } from '@signumjs/standards'
import { decryptMessage, generateSignKeys } from '@signumjs/crypto'
import type { SandboxAccount } from './accounts'

const { DescriptorData } = src44

export interface PayloadField {
  label: string
  /** Null means "present but not readable" — the detail view says so in words. */
  value: string | null
}

const asRecord = (tx: Transaction) => (tx.attachment ?? {}) as Record<string, unknown>

/**
 * SRC44 travels inside the ordinary description field as JSON. Parsing through
 * the reference implementation rather than JSON.parse is what makes "is this
 * SRC44?" the same question here as everywhere else in the ecosystem.
 */
function src44Fields(description: string): PayloadField[] | null {
  try {
    const data = DescriptorData.parse(description, false)
    const fields: PayloadField[] = []
    if (data.name) fields.push({ label: 'name', value: data.name })
    if (data.description) fields.push({ label: 'description', value: data.description })
    return fields.length > 0 ? fields : null
  } catch {
    return null
  }
}

/**
 * `recipients` is shared by two attachments the node tells apart, not this
 * decoder: sendMoneyMulti puts `[id, planck]` pairs (per
 * Attachment$PaymentMultiOutCreation.putMyJson), sendMoneyMultiSame puts a flat
 * list of id strings (per Attachment$PaymentMultiSameOutCreation.putMyJson,
 * whose backing field is an `ArrayList<Long>` serialised one string per
 * recipient — confirmed by decompiling the pinned node jar). Destructuring the
 * flat form as a pair would read an id's first two characters as an id and
 * invent an amount from the rest, so the shape is checked before anything is
 * unpacked. The flat form carries no per-recipient amount — the transaction's
 * own amount is split between the ids, and that split isn't in the attachment
 * — so only ids are listed for it, never a number.
 */
function recipientsSummary(recipients: unknown[]): string {
  if (recipients.length > 0 && Array.isArray(recipients[0])) {
    return (recipients as [string, string][])
      .map(([id, planck]) => `${id}: ${Amount.fromPlanck(planck).getSigna()} SIGNA`)
      .join(', ')
  }
  return (recipients as string[]).join(', ')
}

export function decodePayload(tx: Transaction): PayloadField[] {
  const a = asRecord(tx)
  const fields: PayloadField[] = []

  if (typeof a.message === 'string') {
    fields.push({ label: 'message', value: a.message })
  }

  if (a.encryptedMessage) {
    // Decryption needs one of the two agreement keys plus the counterpart's
    // public key. The console only has that for its own accounts, and the
    // caller has not offered them here, so the honest answer is "not readable".
    fields.push({ label: 'encrypted', value: null })
  }

  if (typeof a.description === 'string') {
    fields.push(...(src44Fields(a.description) ?? [{ label: 'description', value: a.description }]))
  }

  if (Array.isArray(a.recipients)) {
    fields.push({ label: 'recipients', value: recipientsSummary(a.recipients) })
  }

  if (typeof a.frequency === 'number') {
    fields.push({ label: 'frequency', value: `every ${a.frequency} s` })
  }

  return fields
}

interface EncryptedRef {
  data: string
  nonce: string
  isText: boolean
}

function encryptedMessageOf(tx: Transaction): EncryptedRef | null {
  const raw = asRecord(tx).encryptedMessage
  if (!raw || typeof raw !== 'object') return null
  const { data, nonce, isText } = raw as Record<string, unknown>
  if (typeof data !== 'string' || typeof nonce !== 'string') return null
  return { data, nonce, isText: isText !== false }
}

/**
 * Tries both ends: the sandbox may own the recipient, the sender, both, or
 * neither. Null means "we genuinely cannot read this", which the detail view
 * says in words rather than showing ciphertext.
 */
export async function decryptFor(
  tx: Transaction,
  accounts: SandboxAccount[],
): Promise<string | null> {
  const message = encryptedMessageOf(tx)
  if (!message) return null

  const owned = (id: string | undefined) => accounts.find((a) => a.id === id)
  const recipient = owned(tx.recipient)
  const sender = owned(tx.sender)

  const attempt = async (own: SandboxAccount, counterpartPublicKey: string | undefined) => {
    if (!counterpartPublicKey) return null
    try {
      return await decryptMessage(
        message,
        counterpartPublicKey,
        generateSignKeys(own.passphrase).agreementPrivateKey,
      )
    } catch {
      return null
    }
  }

  if (recipient) {
    const text = await attempt(recipient, tx.senderPublicKey)
    if (text !== null) return text
  }
  if (sender && recipient) {
    return attempt(sender, generateSignKeys(recipient.passphrase).publicKey)
  }
  return null
}
