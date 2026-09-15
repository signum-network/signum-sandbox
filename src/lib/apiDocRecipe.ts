import type { SandboxAccount } from './accounts'

/**
 * Where the interactive documentation opens the operation the guide is about.
 *
 * The anchor is RapiDoc's own element id — method, then the path with every
 * character it cannot put in an id replaced by a dash. Verified against the
 * vendored documentation rather than derived from its source, because that
 * file comes from the node release and we do not control its version.
 */
export const SEND_MONEY_URL = '/api-doc/index.html#post-/api-requestType-sendMoney'

/** One Signa in Planck. The number the Quantity Converter exists for. */
const ONE_SIGNA_NQT = '100000000'
/** The minimum fee the node accepts, 0.01 Signa. */
const MIN_FEE_NQT = '1000000'
/** Minutes. The maximum, so the transaction cannot expire while it is read about. */
const DEADLINE = '1440'

export interface ApiRecipe {
  /** The sender's numeric id, so the guide can show what it has to spend. */
  sender: string
  senderName: string
  /** The numeric id, which is the form the `recipient` parameter wants. */
  recipient: string
  recipientName: string
  amountNQT: string
  feeNQT: string
  deadline: string
  secretPhrase: string
}

/**
 * The values that make the documentation's Send Signa form work, taken from
 * the accounts this sandbox actually has.
 *
 * It exists because the form is not what defeats a newcomer — the concepts
 * are already understood by the time anyone gets here. What defeats them is
 * that `amountNQT` is not "1", that a passphrase has to come from somewhere,
 * and that a recipient is a numeric id rather than the address on screen.
 * Handing over real values turns all three into paste.
 *
 * The forger sends, when one is chosen: it is the account collecting block
 * rewards, so it is the one certain to have something to send. Otherwise the
 * first account does, and the first different one receives.
 */
export function apiDocRecipe(
  accounts: SandboxAccount[],
  forger: SandboxAccount | undefined,
): ApiRecipe | null {
  // A payment needs someone to send it and someone else to get it.
  if (accounts.length < 2) return null

  const sender =
    forger && accounts.some((a) => a.id === forger.id) ? forger : accounts[0]
  const recipient = accounts.find((a) => a.id !== sender.id)
  if (!recipient) return null

  return {
    sender: sender.id,
    senderName: sender.name,
    recipient: recipient.id,
    recipientName: recipient.name,
    amountNQT: ONE_SIGNA_NQT,
    feeNQT: MIN_FEE_NQT,
    deadline: DEADLINE,
    secretPhrase: sender.passphrase,
  }
}
