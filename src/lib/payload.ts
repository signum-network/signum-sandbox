import type { Transaction } from '@signumjs/core'
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
export function src44Fields(description: string): PayloadField[] | null {
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
