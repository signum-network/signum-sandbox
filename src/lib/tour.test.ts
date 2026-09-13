import { describe, expect, it } from 'vitest'
import type { Transaction } from '@signumjs/core'
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
  accountCount: 0,
  forgerChosen: false,
  ownedUnconfirmed: 0,
  ownedConfirmed: 0,
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

  it('completes an account step at the required count', () => {
    const creating = step({ completion: { kind: 'accountsAtLeast', count: 2 } })
    expect(isStepComplete(creating, { ...base, accountCount: 1 }, base, false)).toBe(false)
    expect(isStepComplete(creating, { ...base, accountCount: 2 }, base, false)).toBe(true)
  })

  it('completes when a forger has been picked', () => {
    const picking = step({ completion: { kind: 'forgerChosen' } })
    expect(isStepComplete(picking, base, base, false)).toBe(false)
    expect(isStepComplete(picking, { ...base, forgerChosen: true }, base, false)).toBe(true)
  })

  it('completes when you send something, and separately when it settles', () => {
    const sending = step({ completion: { kind: 'sentSomething' } })
    const settling = step({ completion: { kind: 'somethingSettled' } })
    expect(isStepComplete(sending, { ...base, ownedUnconfirmed: 1 }, base, false)).toBe(true)
    expect(isStepComplete(settling, { ...base, ownedUnconfirmed: 1 }, base, false)).toBe(false)
    expect(isStepComplete(settling, { ...base, ownedConfirmed: 1 }, base, false)).toBe(true)
  })

  // The reason these are counts and not booleans. Someone who takes the tour
  // from the help drawer on a chain they have already used starts with their
  // own transactions all over the feed. A boolean would read as "you already
  // did it" and skip both steps; a count only completes on one more than
  // there was when the step began.
  it('is not satisfied by transactions that were already there', () => {
    const used = { ...base, ownedUnconfirmed: 3, ownedConfirmed: 7 }
    const sending = step({ completion: { kind: 'sentSomething' } })
    const settling = step({ completion: { kind: 'somethingSettled' } })
    expect(isStepComplete(sending, used, used, false)).toBe(false)
    expect(isStepComplete(settling, used, used, false)).toBe(false)
    expect(isStepComplete(sending, { ...used, ownedUnconfirmed: 4 }, used, false)).toBe(true)
    expect(isStepComplete(settling, { ...used, ownedConfirmed: 8 }, used, false)).toBe(true)
  })

  // The tour can be left running while auto-forge is on, and then the payment
  // settles while the step before this one is still on screen. The step's goal
  // is "nothing of yours is still waiting", so it is already met -- a rule that
  // only watched the confirmed count would wait for an event already past.
  it('does not wait for something that has already settled', () => {
    const settling = step({ completion: { kind: 'somethingSettled' } })
    const nothingPending = { ...base, ownedUnconfirmed: 0, ownedConfirmed: 5 }
    expect(isStepComplete(settling, nothingPending, nothingPending, false)).toBe(true)
    // But something visibly waiting is still worth waiting for.
    expect(
      isStepComplete(settling, { ...nothingPending, ownedUnconfirmed: 1 }, nothingPending, false),
    ).toBe(false)
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

const item = (sender: string, confirmed: boolean): FeedItem => ({
  id: `${sender}-${String(confirmed)}`,
  confirmed,
  tx: { transaction: '1', sender, timestamp: 0 } as Transaction,
})

describe('observeFeed', () => {
  const owned = new Set(['111'])

  it('counts nothing in an empty feed', () => {
    expect(observeFeed([], owned)).toEqual({ ownedUnconfirmed: 0, ownedConfirmed: 0 })
  })

  it('ignores transactions from accounts you do not own', () => {
    expect(observeFeed([item('999', false), item('999', true)], owned)).toEqual({
      ownedUnconfirmed: 0,
      ownedConfirmed: 0,
    })
  })

  it('counts waiting and settled separately', () => {
    expect(observeFeed([item('111', false)], owned)).toEqual({
      ownedUnconfirmed: 1,
      ownedConfirmed: 0,
    })
    expect(observeFeed([item('111', false), item('111', true)], owned)).toEqual({
      ownedUnconfirmed: 1,
      ownedConfirmed: 1,
    })
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
