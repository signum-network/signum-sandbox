import { TransactionAdvancedPaymentSubtype, TransactionType } from '@signumjs/core'
import type { FeedItem } from './chainFeed'
import type { ConsoleTab, DrawerName } from './consoleNav'

/**
 * A place in the console the tour can point at. The value is the
 * `data-tour` attribute on the element; the overlay finds it by query.
 *
 * An attribute rather than a ref passed up through props: the alternative is
 * every targetable component taking a ref it never uses itself, which spreads
 * the tour across the whole console for the sake of a rectangle.
 */
export type TourTarget =
  | 'accounts-tab'
  | 'create-account'
  | 'forger-select'
  | 'forge-button'
  | 'height'
  | 'send-button'
  | 'transactions-tab'

/**
 * What finishes a step. Every kind but `acknowledge` is answered by the chain
 * or by where the user navigated — never by "they clicked the thing we
 * highlighted", which would let the tour claim progress that did not happen.
 */
export type Completion =
  | { kind: 'acknowledge' }
  | { kind: 'accountCreated' }
  | { kind: 'forgerChosen' }
  | { kind: 'heightRose' }
  | { kind: 'sentSomething' }
  | { kind: 'somethingSettled' }
  | { kind: 'tabActive'; tab: ConsoleTab }
  | { kind: 'drawerOpen'; drawer: Exclude<DrawerName, null> }

export interface TourStep {
  /** Also the translation key: `tour.step.<id>.title` and `.body`. */
  id: string
  target: TourTarget | null
  completion: Completion
  /** Opened when the step begins, so the user lands where the step is about. */
  opens?: { tab?: ConsoleTab; drawer?: DrawerName }
  /** Filled into the send drawer when the step begins. */
  prefill?: { signa: string }
  /**
   * Drawn as a wide card in the middle of the screen instead of a callout
   * beside a control. Exactly one step is one: the last, which has nothing
   * left to point at and a list to show.
   */
  finale?: true
}

/**
 * What to go and build.
 *
 * The tour spends eighteen steps on mechanics — sign, send, forge, settle —
 * and mechanics are not why anyone stays. This is the payoff: eight things
 * this chain is actually good for, each named with the Signum feature that
 * carries it, so it reads as a starting point rather than a brochure.
 *
 * Every one of them is buildable with what the console just demonstrated.
 * That is the selection rule — no rollups, no bridges, nothing that needs a
 * feature this node does not have.
 */
export const TOUR_USE_CASES = [
  'tracing',
  'notarising',
  'credentials',
  'tokenising',
  'games',
  'registry',
  'machines',
  'channels',
] as const

/** Everything the tour needs to know about the console, at one moment. */
export interface Observation {
  height: number
  /**
   * The ids of the accounts this browser holds, not how many there are.
   *
   * Counting was wrong for the same reason it was wrong for transactions: the
   * tour can be started at any time, and someone who already has an account
   * satisfied "you now have at least one" before reading the step that asked
   * for it. The account chapter then explained a passphrase they had never
   * been shown.
   */
  accountIds: ReadonlySet<string>
  /** Null when none is set. Compared against the baseline, never merely to null. */
  forgerId: string | null
  /**
   * The ids of the transactions in the stream this browser sent — identified,
   * not counted.
   *
   * Counting was the first attempt and it was wrong in both directions. The
   * tour can be started at any time, including on a chain already full of the
   * user's own transactions, so "there is one" proves nothing; and a count
   * falls as well as rises — pending transactions confirm, and confirmed ones
   * age out of the feed's fifty-block window — so "there is one more than
   * before" can be false at the very moment the user did the thing. Asking
   * whether a *particular* transaction is new, or has stopped waiting,
   * survives both.
   */
  ownedSent: ReadonlySet<string>
  /** The subset of `ownedSent` still waiting for a block. */
  ownedUnconfirmed: ReadonlySet<string>
  tab: ConsoleTab
  drawer: DrawerName
}

/**
 * A subscription paying out.
 *
 * The chain issues these on the subscriber's behalf, so the sender is an
 * account this browser owns and every "did you send something?" test would
 * count it. It is the one transaction a user can appear to make while doing
 * nothing at all, which is exactly what the tour must not accept as progress
 * — someone who set up a standing order earlier would watch a step complete
 * itself while they read it.
 */
const isSubscriptionPayout = (item: FeedItem) =>
  item.tx.type === TransactionType.AdvancedPayment &&
  item.tx.subtype === TransactionAdvancedPaymentSubtype.SubscriptionPayment

/**
 * The transactions in the stream that came from an account this browser owns
 * and that a person actually sent, with the ones still waiting for a block
 * named separately.
 *
 * Only the sender counts: a payment arriving from elsewhere is not the user
 * doing something.
 */
export function observeFeed(
  items: FeedItem[],
  ownedIds: ReadonlySet<string>,
): { ownedSent: ReadonlySet<string>; ownedUnconfirmed: ReadonlySet<string> } {
  const mine = items.filter((i) => ownedIds.has(i.tx.sender) && !isSubscriptionPayout(i))
  return {
    ownedSent: new Set(mine.map((i) => i.id)),
    ownedUnconfirmed: new Set(mine.filter((i) => !i.confirmed).map((i) => i.id)),
  }
}

/**
 * `baseline` is the observation taken when this step began, so "the height
 * rose" means since the step, not since the tour. `acknowledged` is the one
 * input that is not chain state: an explanation is finished when the reader
 * says it is.
 */
export function isStepComplete(
  step: TourStep,
  now: Observation,
  baseline: Observation,
  acknowledged: boolean,
): boolean {
  switch (step.completion.kind) {
    case 'acknowledge':
      return acknowledged
    case 'accountCreated':
      return [...now.accountIds].some((id) => !baseline.accountIds.has(id))
    case 'forgerChosen':
      // Changed during this step, not merely set. A forger left over from
      // earlier would otherwise complete "pick the one you just created"
      // before the user had picked anything.
      return now.forgerId !== baseline.forgerId
    case 'heightRose':
      return now.height > baseline.height
    case 'sentSomething':
      // A transaction that was not there when the step began. Not "one more
      // than there was": a block landing in between confirms what was pending
      // and can leave the pending count lower than it started, and a fast
      // block can carry the new transaction straight past the pending list.
      return [...now.ownedSent].some((id) => !baseline.ownedSent.has(id))
    case 'somethingSettled':
      // Waiting is over when something that was waiting no longer is. If
      // nothing was waiting when the step began, there is nothing to wait for
      // — auto-forging can settle the payment while the step before this one
      // is still being read, and a step that waits for an event already past
      // is a dead end on the one setting a newcomer is most likely to leave
      // running.
      return baseline.ownedUnconfirmed.size === 0
        ? now.ownedUnconfirmed.size === 0
        : [...baseline.ownedUnconfirmed].some((id) => !now.ownedUnconfirmed.has(id))
    case 'tabActive':
      return now.tab === step.completion.tab
    case 'drawerOpen':
      return now.drawer === step.completion.drawer
  }
}

/**
 * The tour.
 *
 * Three chapters. The first is the account, and it carries the most weight:
 * it is where a newcomer meets a passphrase, which is the one idea here that
 * matters outside the sandbox too. The second is a transaction from sending
 * to settled. The third points at the door.
 *
 * Note how the account gets funded: it is made the forger and then forges.
 * That teaches where the money in a chain comes from, and needs no faucet and
 * no second account to pay from.
 */
export const TOUR_STEPS: TourStep[] = [
  { id: 'welcome', target: null, completion: { kind: 'acknowledge' } },

  // Chapter one: an account, and what a passphrase really is.
  {
    id: 'openAccounts',
    target: 'accounts-tab',
    completion: { kind: 'tabActive', tab: 'accounts' },
  },
  {
    id: 'createAccount',
    target: 'create-account',
    completion: { kind: 'accountCreated' },
  },
  { id: 'passphraseIsTheAccount', target: null, completion: { kind: 'acknowledge' } },
  { id: 'passphraseIsForever', target: null, completion: { kind: 'acknowledge' } },
  { id: 'passphraseInPlainText', target: null, completion: { kind: 'acknowledge' } },
  { id: 'notOnChainYet', target: null, completion: { kind: 'acknowledge' } },

  // Chapter two: a block, and the money it makes.
  { id: 'pickForger', target: 'forger-select', completion: { kind: 'forgerChosen' } },
  { id: 'forge', target: 'forge-button', completion: { kind: 'heightRose' } },
  { id: 'heightRose', target: 'height', completion: { kind: 'acknowledge' } },
  {
    id: 'nowOnChain',
    target: 'accounts-tab',
    completion: { kind: 'acknowledge' },
    opens: { tab: 'accounts' },
  },

  // Chapter three: a transaction, from sent to settled.
  {
    id: 'secondAccount',
    target: 'create-account',
    completion: { kind: 'accountCreated' },
  },
  {
    id: 'openSend',
    target: 'send-button',
    completion: { kind: 'drawerOpen', drawer: 'send' },
  },
  {
    id: 'sendPayment',
    target: 'send-button',
    completion: { kind: 'sentSomething' },
    opens: { drawer: 'send' },
    prefill: { signa: '100' },
  },
  {
    id: 'unconfirmed',
    target: 'transactions-tab',
    completion: { kind: 'acknowledge' },
    opens: { tab: 'transactions', drawer: null },
  },
  { id: 'forgeAgain', target: 'forge-button', completion: { kind: 'somethingSettled' } },
  { id: 'settled', target: null, completion: { kind: 'acknowledge' } },
  { id: 'finale', target: null, completion: { kind: 'acknowledge' }, finale: true },
]
