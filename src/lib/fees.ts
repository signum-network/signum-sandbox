import { Amount } from '@signumjs/util'

/**
 * Every kind of write the console's Send drawer can produce. Kept flat
 * rather than mirroring `TxKind` from txSummary.ts: that type distinguishes
 * plain from encrypted messages because the chain does, on-screen, but the
 * two share one fee, so `feeFor` only needs one `message` case for both.
 */
export type SendAction =
  | 'payment'
  | 'multiOut'
  | 'message'
  | 'accountInfo'
  | 'issueAsset'
  | 'transferAsset'
  | 'mintAsset'
  | 'alias'
  | 'subscription'
  | 'cancelSubscription'

/**
 * Signum's minimum fee is set per transaction type, not globally — a single
 * flat fee for every action is a guess, not a fact. These numbers were
 * measured against the running mock node (at height 10) by deliberately
 * offering too little and reading back what it demanded:
 *
 *   issueAsset → {"errorCode":4,"errorDescription":"Transaction fee 10000000
 *                 less than minimum fee 15000000000 at height 10"}   → 150 SIGNA
 *   setAlias   → {"errorCode":4,"errorDescription":"Transaction fee 10000000
 *                 less than minimum fee 20000000 at height 10"}      → 0.2 SIGNA
 *
 * setAccountInfo and sendMoneyMulti (2 recipients) were both accepted at the
 * 0.01 SIGNA floor — an order of magnitude below the old flat default, so
 * they were never broken by it. Payments and messages were accepted at the
 * old 0.1 SIGNA default too, and 0.1 is kept as their fee below: it is
 * comfortably above the measured 0.01 floor, with room to spare.
 *
 * Messages are the one case where "comfortably above" needs a reason rather
 * than an assumption: Signum charges an arbitrary-message transaction per
 * 176-byte slot, and this console caps a message at 1000 bytes, i.e. 6
 * slots. At the 0.01 SIGNA ordinary-fee floor that is roughly 6 x 0.01 =
 * 0.06 SIGNA for the largest message the form allows, so the flat 0.1 SIGNA
 * fee covers it — not by luck, but because 0.1 was checked against the
 * worst case the form can produce.
 *
 * `DescriptorData.estimateFeePlanck()` (@signumjs/standards) sizes a fee for
 * an SRC44 payload at 0.2 SIGNA per 184-byte slot — which is exactly where
 * the measured setAlias minimum above comes from (a short alias fits in one
 * slot: 1 x 0.2 SIGNA). It is deliberately not used here: setAccountInfo
 * also carries an SRC44 payload (built via DescriptorDataBuilder in
 * send.ts) but was measured at 0.01 SIGNA — twenty times below
 * estimateFeePlanck's own per-slot default — so the two actions plainly
 * sit on different fee schedules on this node, and one formula can't
 * answer for both. Calling it would also change feeFor's shape from a pure
 * lookup on the action to something that needs the actual payload in hand,
 * for a case (a console-typed name, description or alias) that today never
 * approaches even one 184-byte slot. If a form here ever lets someone type
 * enough text to cross that boundary, that is the point to wire it in —
 * not before.
 */
export function feeFor(action: SendAction): Amount {
  switch (action) {
    case 'alias':
      return Amount.fromSigna(0.2)
    case 'issueAsset':
      return Amount.fromSigna(150)
    default:
      return Amount.fromSigna(0.1)
  }
}

/**
 * The fees the field offers without typing.
 *
 * The floor the node accepts for an ordinary transaction is 0.01 SIGNA and it
 * rises with the attachment — Signum charges per 176-byte slot — so these are
 * steps up from that floor rather than a promise. A fee the node refuses is
 * answered by the node naming the minimum it wanted, which reaches the user
 * verbatim, so guessing the size here would buy nothing.
 */
const ORDINARY_PRESETS = [0.01, 0.02, 0.05, 0.1]

/**
 * Presets for one action, in SIGNA, ascending and without duplicates. An
 * action whose own minimum is above the ordinary steps — a token issuance at
 * 150 — offers that too, so its default is always reachable by picking.
 */
export function feePresets(action: SendAction): string[] {
  const own = Number(feeFor(action).getSigna())
  const all = [...new Set([...ORDINARY_PRESETS, own])].sort((a, b) => a - b)
  return all.filter((signa) => signa >= own || own <= Math.max(...ORDINARY_PRESETS)).map(String)
}
