import { convertShortStringToContractData, generateMethodCall } from '@signumjs/contracts'
import { Amount } from '@signumjs/util'
import { toComparableId } from './recipient'

/**
 * What a person can type into one argument row. Each one becomes exactly one
 * 8-byte block, the unit a contract reads its message in.
 */
export type ContractArgType = 'integer' | 'address' | 'boolean' | 'shortString'

/** A boolean's value is the string 'true' or 'false', so every row is text. */
export interface ContractArg {
  type: ContractArgType
  value: string
}

export type ContractArgError = 'empty' | 'notAnInteger' | 'outOfRange' | 'notAnAddress' | 'tooLong'

export type EncodedArgs = { hex: string } | { errors: Record<number, ContractArgError> }

/**
 * A long is read signed or unsigned depending on the contract, so both
 * halves of the range are accepted: -2^63 for the signed floor, 2^64-1 for an
 * unsigned id. The reference encoder checks neither — 2^64 comes out as 16
 * bytes and shifts every argument after it — so the check has to be here.
 */
const MIN_LONG = -(2n ** 63n)
const MAX_ULONG = 2n ** 64n - 1n

const SHORT_STRING_BYTES = 8

/**
 * One argument as the decimal string generateMethodCall expects, or why it
 * cannot be one. A short string is not trimmed — a space is a byte a
 * contract may well compare against — but every other kind is.
 */
export function toContractData(arg: ContractArg): { data: string } | { error: ContractArgError } {
  if (arg.type === 'boolean') return { data: arg.value === 'true' ? '1' : '0' }

  if (arg.type === 'shortString') {
    if (arg.value === '') return { error: 'empty' }
    // convertShortStringToContractData counts characters; a contract counts bytes.
    if (new TextEncoder().encode(arg.value).length > SHORT_STRING_BYTES) return { error: 'tooLong' }
    return { data: convertShortStringToContractData(arg.value) as string }
  }

  const value = arg.value.trim()
  if (value === '') return { error: 'empty' }

  if (arg.type === 'integer') {
    if (!/^-?\d+$/.test(value)) return { error: 'notAnInteger' }
    const n = BigInt(value)
    if (n < MIN_LONG || n > MAX_ULONG) return { error: 'outOfRange' }
    return { data: n.toString() }
  }

  // toComparableId hands back its input when it cannot parse it, so anything
  // that is still not a plain non-negative number afterwards was no address.
  const id = toComparableId(value)
  if (!/^\d+$/.test(id) || BigInt(id) > MAX_ULONG) return { error: 'notAnAddress' }
  return { data: id }
}

/**
 * The whole argument list as the hex a contract reads, or one error per bad
 * row. Packing goes through generateMethodCall, the ecosystem's reference for
 * byte order: it is nothing but "each value to 8 little-endian bytes,
 * concatenated", so the first argument rides in as methodId.
 */
export function encodeContractArgs(args: ContractArg[]): EncodedArgs {
  const errors: Record<number, ContractArgError> = {}
  const data: string[] = []
  args.forEach((arg, index) => {
    const result = toContractData(arg)
    if ('error' in result) errors[index] = result.error
    else data.push(result.data)
  })
  if (Object.keys(errors).length > 0) return { errors }
  if (data.length === 0) return { hex: '' }
  return { hex: generateMethodCall({ methodId: data[0], methodArgs: data.slice(1) }) }
}

export function activationSigna(minActivationPlanck: string): string {
  return Amount.fromPlanck(minActivationPlanck).getSigna()
}

/**
 * Whether an amount would reach the contract without running it. An amount
 * that is not a number yet is not "below" anything — the field is still
 * being typed, and the form says nothing until it means something.
 */
export function isBelowActivation(signa: string, minActivationPlanck: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(signa.trim())) return false
  try {
    return BigInt(Amount.fromSigna(signa.trim()).getPlanck()) < BigInt(minActivationPlanck)
  } catch {
    return false
  }
}

export type AttachmentMode = 'args' | 'text'

export interface Attachment {
  message?: string
  binaryMessage?: string
}

/**
 * What a form puts on chain beside its amount, or null while the chosen
 * payload is invalid and the send has to wait. Argument mode only counts for
 * a contract: a person who picked a contract, chose arguments, then picked
 * an ordinary account must not send the contract's bytes to it.
 */
export function pickAttachment({
  attach,
  toContract,
  mode,
  encoded,
  text,
}: {
  attach: boolean
  toContract: boolean
  mode: AttachmentMode
  encoded: EncodedArgs
  text: string | null
}): Attachment | null {
  if (!attach) return {}
  if (toContract && mode === 'args') {
    if ('errors' in encoded) return null
    return encoded.hex === '' ? {} : { binaryMessage: encoded.hex }
  }
  if (text === null) return null
  return text === '' ? {} : { message: text }
}

/**
 * Which half of the attachment a form shows when its recipient becomes a
 * contract. Arguments are the usual case, but text someone already wrote
 * stays in view: opening on an empty argument list would hide it, and the
 * send would then go out without it and without a word.
 */
export function attachmentModeFor(text: string | null): AttachmentMode {
  return text ? 'text' : 'args'
}
