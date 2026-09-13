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
  | { kind: 'accountsAtLeast'; count: number }
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
  accountCount: number
  forgerChosen: boolean
  /**
   * How many transactions in the stream this browser sent — counted, not
   * flagged, so a step can ask for one *more* than there was when it began.
   * The tour can be started at any time, including on a chain already full of
   * the user's own transactions.
   */
  ownedUnconfirmed: number
  ownedConfirmed: number
  tab: ConsoleTab
  drawer: DrawerName
}

/**
 * Whether any transaction in the stream came from an account this browser
 * owns, split by whether it has made it into a block.
 *
 * Only the sender counts. The tour asks the user to send something, and a
 * payment arriving from elsewhere — a subscription firing, say — is not
 * them doing it.
 */
export function observeFeed(
  items: FeedItem[],
  ownedIds: ReadonlySet<string>,
): { ownedUnconfirmed: number; ownedConfirmed: number } {
  const mine = items.filter((i) => ownedIds.has(i.tx.sender))
  return {
    ownedUnconfirmed: mine.filter((i) => !i.confirmed).length,
    ownedConfirmed: mine.filter((i) => i.confirmed).length,
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
    case 'accountsAtLeast':
      return now.accountCount >= step.completion.count
    case 'forgerChosen':
      return now.forgerChosen
    case 'heightRose':
      return now.height > baseline.height
    case 'sentSomething':
      return now.ownedUnconfirmed > baseline.ownedUnconfirmed
    case 'somethingSettled':
      return now.ownedConfirmed > baseline.ownedConfirmed
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
    completion: { kind: 'accountsAtLeast', count: 1 },
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
    completion: { kind: 'accountsAtLeast', count: 2 },
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
