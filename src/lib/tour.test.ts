import { describe, expect, it } from 'vitest'
import {
  TransactionAdvancedPaymentSubtype,
  TransactionType,
  type Transaction,
} from '@signumjs/core'
import type { FeedItem } from './chainFeed'
import en from '@/i18n/locales/en'
import {
  TOUR_STEPS,
  TOUR_USE_CASES,
  isStepComplete,
  observeFeed,
  type Observation,
  type TourStep,
} from './tour'

const base: Observation = {
  height: 10,
  accountIds: new Set<string>(),
  forgerId: null,
  ownedSent: new Set<string>(),
  ownedUnconfirmed: new Set<string>(),
  tab: 'transactions',
  drawer: null,
}

const step = (extra: Partial<TourStep>): TourStep => ({
  id: 'test',
  target: null,
  completion: { kind: 'acknowledge' },
  ...extra,
})

describe('isStepComplete', () => {
  it('completes an acknowledge step only when acknowledged', () => {
    expect(isStepComplete(step({}), base, base, false)).toBe(false)
    expect(isStepComplete(step({}), base, base, true)).toBe(true)
  })

  it('completes a forge step when the height passed where it started', () => {
    const forging = step({ completion: { kind: 'heightRose' } })
    expect(isStepComplete(forging, base, base, false)).toBe(false)
    expect(isStepComplete(forging, { ...base, height: 11 }, base, false)).toBe(true)
  })

  // The baseline is per step, not per tour: a block forged before this step
  // began must not complete it.
  it('measures the height against the step’s own baseline', () => {
    const forging = step({ completion: { kind: 'heightRose' } })
    const baseline = { ...base, height: 11 }
    expect(isStepComplete(forging, { ...base, height: 11 }, baseline, false)).toBe(false)
  })

  it('completes an account step when an account appears', () => {
    const creating = step({ completion: { kind: 'accountCreated' } })
    expect(isStepComplete(creating, base, base, false)).toBe(false)
    expect(isStepComplete(creating, { ...base, accountIds: new Set(['a']) }, base, false)).toBe(true)
  })

  // The bug a real tour found. Someone who already has accounts had "create
  // an account" completed for them before they read it, and the three steps
  // that follow explain a passphrase they were never shown.
  it('is not satisfied by accounts that were already there', () => {
    const creating = step({ completion: { kind: 'accountCreated' } })
    const had = { ...base, accountIds: new Set(['a', 'b']) }
    expect(isStepComplete(creating, had, had, false)).toBe(false)
    expect(
      isStepComplete(creating, { ...had, accountIds: new Set(['a', 'b', 'c']) }, had, false),
    ).toBe(true)
  })

  it('completes when a forger is picked, and not when one was already set', () => {
    const picking = step({ completion: { kind: 'forgerChosen' } })
    expect(isStepComplete(picking, base, base, false)).toBe(false)
    expect(isStepComplete(picking, { ...base, forgerId: 'a' }, base, false)).toBe(true)
    const had = { ...base, forgerId: 'old' }
    expect(isStepComplete(picking, had, had, false)).toBe(false)
    expect(isStepComplete(picking, { ...had, forgerId: 'new' }, had, false)).toBe(true)
  })

  const sending = step({ completion: { kind: 'sentSomething' } })
  const settling = step({ completion: { kind: 'somethingSettled' } })
  const at = (sent: string[], pending: string[] = sent): Observation => ({
    ...base,
    ownedSent: new Set(sent),
    ownedUnconfirmed: new Set(pending),
  })

  it('completes when you send something, and separately when it settles', () => {
    expect(isStepComplete(sending, at(['tx1']), base, false)).toBe(true)
    expect(isStepComplete(settling, at(['tx1']), at(['tx1']), false)).toBe(false)
    expect(isStepComplete(settling, at(['tx1'], []), at(['tx1']), false)).toBe(true)
  })

  // Someone who takes the tour from the help drawer on a chain they have
  // already used starts with their own transactions all over the feed. What
  // was already there proves nothing.
  it('is not satisfied by transactions that were already there', () => {
    const used = at(['old1', 'old2', 'old3'], ['old1'])
    expect(isStepComplete(sending, used, used, false)).toBe(false)
    expect(isStepComplete(settling, used, used, false)).toBe(false)
    expect(isStepComplete(sending, at(['old1', 'old2', 'old3', 'new'], ['old1']), used, false)).toBe(
      true,
    )
    expect(isStepComplete(settling, at(['old1', 'old2', 'old3'], []), used, false)).toBe(true)
  })

  // Why sending is not "the pending count went up". A block landing between
  // the step starting and the user sending confirms what was already waiting,
  // so the pending count can be *lower* at the very moment they did the thing.
  it('sees a send even when a block confirmed the backlog first', () => {
    const backlog = at(['old1', 'old2'])
    const afterBlockAndSend = at(['old1', 'old2', 'new'], ['new'])
    expect(isStepComplete(sending, afterBlockAndSend, backlog, false)).toBe(true)
  })

  // And why sending is not "it appeared in the pending list" either: a block
  // can carry a fresh transaction straight past it.
  it('sees a send that went into a block before anyone looked', () => {
    expect(isStepComplete(sending, at(['new'], []), base, false)).toBe(true)
  })

  // The tour can be left running while auto-forge is on, and then the payment
  // settles while the step before this one is still on screen. Nothing of
  // yours is waiting, so the step's goal is already met -- waiting for an
  // event already past is a dead end.
  it('does not wait for something that has already settled', () => {
    const nothingPending = at(['tx1'], [])
    expect(isStepComplete(settling, nothingPending, nothingPending, false)).toBe(true)
    expect(isStepComplete(settling, at(['tx1', 'tx2'], ['tx2']), nothingPending, false)).toBe(false)
  })

  // The feed holds fifty blocks. A confirmed transaction ages out of it, so a
  // settled step that watched a confirmed count could miss its own answer.
  // Leaving the pending list is what settling means here.
  it('settles even when the transaction has aged out of the feed', () => {
    expect(isStepComplete(settling, at([], []), at(['tx1']), false)).toBe(true)
  })

  it('completes when the named tab or drawer is showing', () => {
    const onAccounts = step({ completion: { kind: 'tabActive', tab: 'accounts' } })
    const sendOpen = step({ completion: { kind: 'drawerOpen', drawer: 'send' } })
    expect(isStepComplete(onAccounts, { ...base, tab: 'accounts' }, base, false)).toBe(true)
    expect(isStepComplete(onAccounts, base, base, false)).toBe(false)
    expect(isStepComplete(sendOpen, { ...base, drawer: 'send' }, base, false)).toBe(true)
    expect(isStepComplete(sendOpen, { ...base, drawer: 'chain' }, base, false)).toBe(false)
  })
})

const item = (id: string, sender: string, confirmed: boolean, tx: Partial<Transaction> = {}) =>
  ({
    id,
    confirmed,
    tx: { transaction: id, sender, timestamp: 0, ...tx } as Transaction,
  }) as FeedItem

describe('observeFeed', () => {
  const owned = new Set(['111'])

  it('finds nothing in an empty feed', () => {
    expect(observeFeed([], owned)).toEqual({
      ownedSent: new Set(),
      ownedUnconfirmed: new Set(),
    })
  })

  it('ignores transactions from accounts you do not own', () => {
    const theirs = [item('a', '999', false), item('b', '999', true)]
    expect(observeFeed(theirs, owned)).toEqual({
      ownedSent: new Set(),
      ownedUnconfirmed: new Set(),
    })
  })

  it('names what is waiting as a subset of what was sent', () => {
    const mine = [item('a', '111', false), item('b', '111', true)]
    expect(observeFeed(mine, owned)).toEqual({
      ownedSent: new Set(['a', 'b']),
      ownedUnconfirmed: new Set(['a']),
    })
  })

  // The chain sends these on the subscriber's behalf, so the sender is an
  // owned account and nobody pressed anything. A step that accepted one would
  // complete itself while the user read it.
  it('ignores a subscription paying out, which the user did not send', () => {
    const payout = item('a', '111', false, {
      type: TransactionType.AdvancedPayment,
      subtype: TransactionAdvancedPaymentSubtype.SubscriptionPayment,
    })
    expect(observeFeed([payout], owned)).toEqual({
      ownedSent: new Set(),
      ownedUnconfirmed: new Set(),
    })
  })

  it('still counts the transaction that sets a subscription up', () => {
    const subscribe = item('a', '111', false, {
      type: TransactionType.AdvancedPayment,
      subtype: TransactionAdvancedPaymentSubtype.SubscriptionSubscribe,
    })
    expect(observeFeed([subscribe], owned).ownedSent).toEqual(new Set(['a']))
  })
})

describe('TOUR_USE_CASES', () => {
  // Same guard as the glossary: an idea with no words is not an idea. The
  // other nine locales follow from locales.test.ts.
  const useCase = (
    en as unknown as { tour: { useCase: Record<string, { title?: string; body?: string }> } }
  ).tour.useCase

  it('has a headline and a sentence for every idea', () => {
    for (const id of TOUR_USE_CASES) {
      expect(useCase[id]?.title, `${id}.title`).toBeTruthy()
      expect(useCase[id]?.body, `${id}.body`).toBeTruthy()
    }
  })

  // The finale card lays them out in a grid of short headlines beside longer
  // bodies. A headline that runs to a sentence breaks that shape, and it is
  // the last thing a newcomer reads.
  it('keeps the headlines short enough for a two-column card', () => {
    for (const id of TOUR_USE_CASES) {
      expect(useCase[id]?.title?.length, `${id}.title`).toBeLessThan(60)
    }
  })
})

describe('TOUR_STEPS', () => {
  it('has unique ids, since a step id is a translation key', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length)
  })

  // A step whose completion nobody can trigger would strand the tour, and a
  // step with no chain rule needs the "next" button that only an acknowledge
  // step is given.
  it('gives every step either a chain rule or an acknowledge button', () => {
    for (const s of TOUR_STEPS) expect(s.completion.kind).toBeTruthy()
  })

  // The one change that can ship a blank card: adding a step. Its id is a
  // translation key the same way a glossary term is, and locales.test.ts only
  // holds the other nine in step with English -- it cannot tell that English
  // itself is missing something.
  it('has a title and a body for every step', () => {
    const steps = (
      en as unknown as { tour: { step: Record<string, { title?: string; body?: string }> } }
    ).tour.step
    for (const s of TOUR_STEPS) {
      expect(steps[s.id]?.title, `${s.id}.title`).toBeTruthy()
      expect(steps[s.id]?.body, `${s.id}.body`).toBeTruthy()
    }
  })

  // The overlay lays the finale out differently and reads its list from
  // TOUR_USE_CASES. More than one, or one that still points at a control,
  // would render a wide centred card over a highlight ring.
  it('ends on exactly one finale, and it points at nothing', () => {
    const finales = TOUR_STEPS.filter((s) => s.finale)
    expect(finales).toHaveLength(1)
    expect(finales[0]).toBe(TOUR_STEPS[TOUR_STEPS.length - 1])
    expect(finales[0].target).toBeNull()
  })
})
