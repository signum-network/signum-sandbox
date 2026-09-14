import { getRecipientAmountsFromMultiOutPayment, type Transaction } from '@signumjs/core'
import { Amount } from '@signumjs/util'
import { kindOf, type TxKind } from './txKind'
import { src44Fields } from './payload'

export interface Payee {
  /** Numeric account id, as the attachment carries it. */
  id: string
  signa: string
}

export interface DetailField {
  /** A translation key under `console.field`, or a raw attachment key. */
  label: string
  /** Null means "known to be here but not readable", e.g. an encrypted message. */
  value: string | null
  /**
   * The parties of a multi-out, left as data rather than flattened into the
   * value.
   *
   * Joining them into a string here would force the row to show numeric ids,
   * since that is what the attachment carries and a library has no business
   * knowing the network's address prefix. Handed over as ids, the row can do
   * what it does for every other account on screen: an address, a name if it
   * has one, and the identicon that tells two of them apart.
   */
  payees?: Payee[]
}

/**
 * The node stamps every attachment with which version of the format it used.
 * It tells a reader nothing and there is one on almost every transaction.
 */
const isVersionMarker = (key: string) => key.startsWith('version.')

/**
 * Envelope, not content.
 *
 * `messageIsText` says the message is text, which is evident from the message
 * being readable; it is a format flag for the decoder, and it appears on
 * every message ever sent. Suppressing it is the same judgement as
 * suppressing the version markers, and for the same reason — a field that is
 * always there and never says anything is not information, it is furniture.
 * The raw response at the bottom of the row still carries it.
 *
 * Note what is *not* here: `recipientPublicKey`. It is announced on every
 * first payment to an account the chain has not seen, and that announcement
 * is a real fact about the transaction — this sandbox has already had one bug
 * from it going missing. It gets a label below instead of the axe.
 */
const ENVELOPE = new Set(['messageIsText'])

/**
 * Where a value stops being worth reading in a table row.
 *
 * A contract's attachment carries its compiled bytecode, which is thousands
 * of characters of hex. Hiding it would break the rule this file rests on —
 * a reader must be able to see that a field is there — but printing it buries
 * every other field under it. Shortening says both things: the field exists,
 * this is how big it is, and the raw JSON at the bottom of the row has all of
 * it.
 */
const TRUNCATE_AT = 120

const shorten = (text: string) =>
  text.length <= TRUNCATE_AT ? text : `${text.slice(0, TRUNCATE_AT)}… (${text.length} chars)`

const asText = (value: unknown): string =>
  shorten(
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value),
  )

const signa = (planck: unknown) =>
  typeof planck === 'string' ? `${Amount.fromPlanck(planck).getSigna()} SIGNA` : asText(planck)

/**
 * Token id `0` is not a token. In the places a token id and SIGNA can stand
 * in the same field — a distribution's payout token, above all — zero means
 * the holders were paid in the chain's own coin, and printing "0" there reads
 * as a token that does not exist.
 */
const SIGNA_TOKEN_ID = '0'

const tokenOrSigna = (id: unknown) => (id === SIGNA_TOKEN_ID ? 'SIGNA' : asText(id))

/**
 * A multi-transfer's attachment is two parallel arrays, not a list of pairs:
 * `assetIds[i]` belongs with `quantitiesQNT[i]`. Zipped wrongly it would
 * report a token nobody sent, so the pairing is done here once rather than
 * left to a reader looking at two unlabelled lists.
 */
function zipTokens(ids: unknown, quantities: unknown): string {
  if (!Array.isArray(ids)) return asText(ids)
  const amounts = Array.isArray(quantities) ? quantities : []
  return shorten(ids.map((id, i) => `${id}: ${amounts[i] ?? '?'}`).join(', '))
}

/**
 * What a multi-out actually paid, per recipient.
 *
 * The SDK reader handles both shapes — `[id, planck]` pairs, and a flat list
 * of ids sharing the transaction's own amount. Sniffing the attachment for
 * which shape it is, is exactly the code that once turned a same-amount
 * multi-out into fabricated SIGNA figures, so it is not done again here.
 */
function recipientAmounts(tx: Transaction, raw: unknown): DetailField {
  try {
    return {
      label: 'recipients',
      value: null,
      payees: getRecipientAmountsFromMultiOutPayment(tx).map(({ recipient, amountNQT }) => ({
        id: recipient,
        signa: Amount.fromPlanck(amountNQT).getSigna(),
      })),
    }
  } catch {
    // It throws on anything that is not a multi-out. Reaching that means the
    // kind and the attachment disagree, which is the node's word against
    // ours — show what the node sent rather than nothing.
    return { label: 'recipients', value: asText(raw) }
  }
}

/**
 * A description travels as SRC44 JSON wherever an account or a token names
 * itself, and unfolded is the difference between a name and a wall of
 * punctuation. Anything that is not SRC44 stays the text it is, and the raw
 * response link at the foot of the row still has the descriptor entire.
 */
function src44Detail(raw: unknown): DetailField[] {
  if (typeof raw !== 'string') return [{ label: 'description', value: asText(raw) }]
  const parsed = src44Fields(raw)
  if (!parsed) return [{ label: 'description', value: shorten(raw) }]
  return parsed.map(({ label, value }) => ({
    label: label === 'name' ? 'infoName' : label,
    value: value === null ? null : shorten(value),
  }))
}

type Format =
  | 'signa'
  | 'seconds'
  | 'unreadable'
  | 'tokenOrSigna'
  | 'tokens'
  | 'recipients'
  | 'src44'

interface KnownField {
  /** A key under `console.field`. */
  label: string
  format?: Format
  /** Other attachment keys this entry has already accounted for. */
  consumes?: readonly string[]
}

function present(field: KnownField, raw: unknown, tx: Transaction): DetailField[] {
  const attachment = (tx.attachment ?? {}) as Record<string, unknown>
  switch (field.format) {
    case 'unreadable':
      return [{ label: field.label, value: null }]
    case 'signa':
      return [{ label: field.label, value: signa(raw) }]
    case 'seconds':
      return [{ label: field.label, value: `${asText(raw)} s` }]
    case 'tokenOrSigna':
      return [{ label: field.label, value: tokenOrSigna(raw) }]
    case 'tokens':
      return [{ label: field.label, value: zipTokens(raw, attachment.quantitiesQNT) }]
    case 'recipients':
      return [recipientAmounts(tx, raw)]
    case 'src44':
      return src44Detail(raw)
    default:
      return [{ label: field.label, value: asText(raw) }]
  }
}

/**
 * The two fields that belong to no kind in particular.
 *
 * A message rides on whatever will carry it: a payment, a token transfer, an
 * alias assignment. `kindOf` rightly calls those `payment` and
 * `tokenTransfer`, so reading the message out of the message kinds alone
 * would lose it everywhere else. The encrypted one keeps a null value on
 * purpose — that is the contract the row's decryption path reads.
 */
const COMMON: Record<string, KnownField> = {
  message: { label: 'message' },
  encryptedMessage: { label: 'encrypted', format: 'unreadable' },
  // Carried by any send to an account the chain has never seen, which in a
  // sandbox is most of them. Worth naming rather than showing as a raw key
  // beside sixty-four characters of hex.
  recipientPublicKey: { label: 'announcedKey' },
}

const ORDER: Record<string, KnownField> = {
  asset: { label: 'token' },
  quantityQNT: { label: 'quantity' },
  priceNQT: { label: 'price', format: 'signa' },
}

// The wallet reads `asset` on a cancellation; an order id is presumably
// alongside it under `order`. Both are listed, and whichever the node
// actually sends shows up — that is what the passthrough is for.
const ORDER_CANCEL: Record<string, KnownField> = {
  order: { label: 'order' },
  asset: { label: 'token' },
}

const TOKEN_QUANTITY: Record<string, KnownField> = {
  asset: { label: 'token' },
  quantityQNT: { label: 'quantity' },
}

const ESCROW_DECISION: Record<string, KnownField> = {
  escrowId: { label: 'escrow' },
  decision: { label: 'decision' },
}

const COMMITMENT: Record<string, KnownField> = {
  amountNQT: { label: 'amount', format: 'signa' },
}

const SUBSCRIPTION_REF: Record<string, KnownField> = {
  subscriptionId: { label: 'subscription' },
}

/**
 * Which attachment keys each kind knows how to present, and under what label.
 *
 * A key listed here is renamed and formatted; a key not listed still appears,
 * under its own name. That is the difference between a view and a filter, and
 * it is what makes this table safe to write from documentation: most of these
 * transactions cannot be produced by this console, so some of what follows is
 * an educated guess. A guess that is wrong costs a badly labelled line. A
 * guess that *hid* the field would cost the developer the answer.
 */
const KNOWN: Partial<Record<TxKind, Record<string, KnownField>>> = {
  multiOut: { recipients: { label: 'recipients', format: 'recipients' } },
  multiOutSame: { recipients: { label: 'recipients', format: 'recipients' } },
  alias: { alias: { label: 'aliasName' }, uri: { label: 'content' } },
  // The wallet reads `alias || uri` for both of these, so a sale or purchase
  // may name the alias under either key.
  aliasSale: {
    alias: { label: 'aliasName' },
    uri: { label: 'aliasName' },
    priceNQT: { label: 'price', format: 'signa' },
  },
  aliasBuy: { alias: { label: 'aliasName' }, uri: { label: 'aliasName' } },
  accountInfo: {
    name: { label: 'infoName' },
    description: { label: 'description', format: 'src44' },
  },
  tokenIssue: {
    name: { label: 'tokenName' },
    description: { label: 'description', format: 'src44' },
    quantityQNT: { label: 'quantity' },
    decimals: { label: 'decimals' },
    mintable: { label: 'mintable' },
  },
  tokenTransfer: TOKEN_QUANTITY,
  mintAsset: TOKEN_QUANTITY,
  treasuryAccount: { asset: { label: 'token' } },
  tokenOwnership: { asset: { label: 'token' } },
  // Parallel arrays, not pairs — `assetIds[i]` goes with `quantitiesQNT[i]`.
  // This is the same shape that once made same-amount multi-out decode into
  // invented SIGNA figures, so it gets a formatter rather than a label.
  tokenMultiTransfer: {
    assetIds: { label: 'tokens', format: 'tokens', consumes: ['quantitiesQNT'] },
  },
  // Two tokens in one transaction: the one whose holders are paid, and
  // optionally the one they are paid in. `assetToDistribute` of "0" means
  // they were paid in SIGNA.
  distributeToHolders: {
    asset: { label: 'token' },
    quantityMinimumQNT: { label: 'minimumHolding' },
    assetToDistribute: { label: 'paidIn', format: 'tokenOrSigna' },
    quantityQNT: { label: 'quantity' },
  },
  askOrder: ORDER,
  bidOrder: ORDER,
  askOrderCancel: ORDER_CANCEL,
  bidOrderCancel: ORDER_CANCEL,
  addCommitment: COMMITMENT,
  removeCommitment: COMMITMENT,
  subscription: { frequency: { label: 'frequency', format: 'seconds' } },
  cancelSubscription: SUBSCRIPTION_REF,
  subscriptionPayment: SUBSCRIPTION_REF,
  // The name and the description are the whole of what a person can read
  // here; the rest of the attachment is the compiled contract, which is
  // bytecode. It still comes through — see `TRUNCATE_AT` — but as a stated
  // size rather than a screenful of hex.
  contractCreate: {
    name: { label: 'contractName' },
    description: { label: 'description', format: 'src44' },
  },
  escrowCreate: {
    amountNQT: { label: 'amount', format: 'signa' },
    requiredSigners: { label: 'requiredSigners' },
    deadline: { label: 'deadline' },
    deadlineAction: { label: 'deadlineAction' },
  },
  escrowSign: ESCROW_DECISION,
  escrowResult: ESCROW_DECISION,
  /**
   * A burn is not one subtype but any transfer to address `0`, so its
   * attachment is whichever vehicle carried it: nothing at all when SIGNA
   * went, an asset and a quantity when a token did, the parallel arrays when
   * several did. Left to the passthrough, an unlabelled `quantityQNT` beside
   * the word "Burned" is not an answer to what was destroyed.
   */
  burn: {
    asset: { label: 'token' },
    quantityQNT: { label: 'quantity' },
    assetIds: { label: 'tokens', format: 'tokens', consumes: ['quantitiesQNT'] },
  },
}

/**
 * Every attachment field, named where the console knows the name.
 *
 * Deliberately additive: the fields a kind understands come first, in the
 * order the table lists them, and everything else follows under its own key.
 * Nothing in an attachment is ever dropped except the node's own version
 * markers, which say nothing to a reader.
 */
export function detailFields(tx: Transaction): DetailField[] {
  const attachment = (tx.attachment ?? {}) as Record<string, unknown>
  const known = { ...(KNOWN[kindOf(tx)] ?? {}), ...COMMON }
  const fields: DetailField[] = []
  const taken = new Set<string>()

  for (const [key, how] of Object.entries(known)) {
    if (!(key in attachment)) continue
    taken.add(key)
    for (const consumed of how.consumes ?? []) taken.add(consumed)
    fields.push(...present(how, attachment[key], tx))
  }

  for (const [key, raw] of Object.entries(attachment)) {
    if (taken.has(key) || isVersionMarker(key) || ENVELOPE.has(key)) continue
    fields.push({ label: key, value: asText(raw) })
  }

  return fields
}
