# Beginner Mode and the Tour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the finished developer console into something a newcomer can walk into: it asks once who you are, explains its own vocabulary in place, and can lead you through creating an account, forging a block and sending a payment on the real chain.

**Architecture:** Beginner mode is one boolean in `localStorage`, published through a React context so any component can render an explanation without a prop threaded through five parents. The tour is data: a list of steps, each naming a DOM target by `data-tour` attribute and a completion rule evaluated against observed chain state. `isStepComplete` is a pure function over an `Observation` built from what `ConsoleShell` already holds — height, owned accounts, feed items, current tab and drawer — so no new queries are added and the tour is testable without rendering anything.

**Tech Stack:** React 19, TanStack Query, framer-motion, i18next (10 locales), Vitest (`environment: 'node'`, no jsdom, no render tests).

**Layer two, part one.** This plan covers the newcomer: the entry question, beginner mode, the glossary tooltips, the per-view notes and the tour. Scenarios, their runner and the terminal seed script are the second part and get their own plan.

---

## File Structure

**New — pure, tested:**
- `src/lib/beginner.ts` — reading and writing the stored answer. `answered` is stored, not derived: "I know my way around" must survive a reload just as firmly as "I'm new".
- `src/lib/glossary.ts` — the list of domain terms, and the two key helpers. One place to add a word.
- `src/lib/consoleNav.ts` — `ConsoleTab` and `DrawerName`, moved out of `ConsoleShell.tsx` so a library can name a tab without importing a component.
- `src/lib/tour.ts` — `TourStep`, `Observation`, `TOUR_STEPS`, `observeFeed`, `isStepComplete`.

**New — hooks:**
- `src/hooks/useBeginner.ts` — the stored boolean, same shape as `useWatched`.
- `src/hooks/useTour.ts` — which step is current, the baseline taken when it began, and the auto-advance.

**New — components:**
- `src/components/console/BeginnerMode.tsx` — the context and its `useBeginnerMode` reader.
- `src/components/console/Term.tsx` — a domain word, with an `i` beside it in beginner mode.
- `src/components/console/ViewNote.tsx` — one sentence of context above a view, beginner only.
- `src/components/console/FirstVisit.tsx` — the panel that asks once.
- `src/components/console/tour/TourOverlay.tsx` — the ring around the target and the callout beside it.

**Modified:**
- `src/components/console/ConsoleShell.tsx` — provider, first-visit panel, observation, overlay, `data-tour` attributes.
- `src/components/console/Header.tsx` — `data-tour` on the height, the forger picker, the forge button and the drawer buttons.
- `src/components/console/views/AccountsView.tsx` — `data-tour` on the create control, plus `Term` on the domain words.
- `src/components/console/drawers/HelpDrawer.tsx` — the beginner switch and the button that starts the tour.
- `src/components/console/drawers/SendDrawer.tsx` and `forms/PaymentForm.tsx` — accept a prefill.
- `src/i18n/locales/*.ts` — the new keys, ten times.

**Why a context and not props:** `Term` will appear in the header, three views, the account detail and half a dozen forms. Threading a boolean to all of them would touch every component signature in the console for a value none of them act on. Beginner mode is exactly what context is for — ambient, read-only, rarely changing.

---

### Task 1: The stored answer

**Files:**
- Create: `src/lib/beginner.ts`
- Test: `src/lib/beginner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/beginner.test.ts
import { describe, expect, it } from 'vitest'
import { NOT_ASKED, readBeginner, writeBeginner } from './beginner'

describe('readBeginner', () => {
  it('has not asked when nothing is stored', () => {
    expect(readBeginner(null)).toEqual(NOT_ASKED)
  })

  it('remembers a yes', () => {
    expect(readBeginner('{"beginner":true}')).toEqual({ answered: true, beginner: true })
  })

  // The point of storing `answered` separately: someone who said "old hand"
  // has answered, and must not be asked again on the next visit.
  it('remembers a no as an answer, not as an absence', () => {
    expect(readBeginner('{"beginner":false}')).toEqual({ answered: true, beginner: false })
  })

  it('treats unreadable storage as never asked', () => {
    expect(readBeginner('not json')).toEqual(NOT_ASKED)
    expect(readBeginner('"a string"')).toEqual(NOT_ASKED)
  })
})

describe('writeBeginner', () => {
  it('round-trips', () => {
    expect(readBeginner(writeBeginner(true))).toEqual({ answered: true, beginner: true })
    expect(readBeginner(writeBeginner(false))).toEqual({ answered: true, beginner: false })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- beginner`
Expected: FAIL, `Failed to resolve import "./beginner"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/beginner.ts

/**
 * Whether the console has asked "new here, or an old hand?", and what the
 * answer was.
 *
 * `answered` is stored rather than inferred from `beginner`, because the two
 * false cases are different: nobody has been asked yet, and someone answered
 * that they know their way around. Inferring would ask the second person the
 * same question on every visit.
 */
export interface BeginnerState {
  answered: boolean
  beginner: boolean
}

export const NOT_ASKED: BeginnerState = { answered: false, beginner: false }

export function readBeginner(raw: string | null): BeginnerState {
  if (!raw) return NOT_ASKED
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return NOT_ASKED
    return { answered: true, beginner: (parsed as { beginner?: unknown }).beginner === true }
  } catch {
    return NOT_ASKED
  }
}

export const writeBeginner = (beginner: boolean) => JSON.stringify({ beginner })
```

- [ ] **Step 4: Run the test again**

Run: `bun run test -- beginner`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beginner.ts src/lib/beginner.test.ts
git commit -m "feat: remember whether the console has asked who you are"
```

---

### Task 2: The hook and the context

**Files:**
- Create: `src/hooks/useBeginner.ts`
- Create: `src/components/console/BeginnerMode.tsx`

No test: both are thin wrappers over Task 1's tested functions and React itself, and the repo does not render-test.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useBeginner.ts
import { useCallback, useEffect, useState } from 'react'
import { NOT_ASKED, readBeginner, writeBeginner, type BeginnerState } from '@/lib/beginner'

const STORAGE_KEY = 'signum-sandbox.beginner.v1'

export interface BeginnerStore extends BeginnerState {
  /** Answers the entry question, and later flips the switch in the help drawer. */
  setBeginner: (beginner: boolean) => void
}

/**
 * Beginner mode, kept across sessions. It holds no secret and reveals
 * nothing, so unlike the account store it needs no network rail.
 */
export function useBeginner(): BeginnerStore {
  const [state, setState] = useState<BeginnerState>(NOT_ASKED)

  useEffect(() => {
    setState(readBeginner(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const setBeginner = useCallback((beginner: boolean) => {
    setState({ answered: true, beginner })
    window.localStorage.setItem(STORAGE_KEY, writeBeginner(beginner))
  }, [])

  return { ...state, setBeginner }
}
```

- [ ] **Step 2: Write the context**

```tsx
// src/components/console/BeginnerMode.tsx
import { createContext, useContext, type ReactNode } from 'react'

/**
 * Beginner mode as ambient state.
 *
 * The explanations appear in the header, in all four views and in a dozen
 * forms. A prop would have to cross every component signature in the console
 * to reach them, for a value none of those components act on — they only read
 * it to decide whether to say more.
 */
const BeginnerContext = createContext(false)

export const BeginnerMode = ({ on, children }: { on: boolean; children: ReactNode }) => (
  <BeginnerContext.Provider value={on}>{children}</BeginnerContext.Provider>
)

export const useBeginnerMode = () => useContext(BeginnerContext)
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBeginner.ts src/components/console/BeginnerMode.tsx
git commit -m "feat: beginner mode as ambient state"
```

---

### Task 3: The glossary

**Files:**
- Create: `src/lib/glossary.ts`
- Test: `src/lib/glossary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/glossary.test.ts
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { GLOSSARY_TERMS, helpKey, termKey } from './glossary'

// The other nine locales are covered by locales.test.ts, which demands the
// exact English key set — so English being complete makes all ten complete.
const glossary = (en as unknown as { glossary: Record<string, { term?: string; help?: string }> })
  .glossary

describe('glossary', () => {
  it('has a word and an explanation for every term', () => {
    for (const term of GLOSSARY_TERMS) {
      expect(glossary[term]?.term, `${term}.term`).toBeTruthy()
      expect(glossary[term]?.help, `${term}.help`).toBeTruthy()
    }
  })

  it('names its keys the way the locale file nests them', () => {
    expect(termKey('fee')).toBe('glossary.fee.term')
    expect(helpKey('fee')).toBe('glossary.fee.help')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- glossary`
Expected: FAIL, `Failed to resolve import "./glossary"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/glossary.ts

/**
 * The words the console uses without apology, and the single place they are
 * listed. Adding one here without translating it fails glossary.test.ts, and
 * translating it in English alone fails locales.test.ts — so a term either
 * arrives in ten languages or it does not arrive.
 */
export const GLOSSARY_TERMS = [
  'block',
  'height',
  'forge',
  'forger',
  'passphrase',
  'address',
  'publicKey',
  'unconfirmed',
  'fee',
  'payload',
  'src44',
  'token',
  'alias',
  'subscription',
  'multiOut',
  'contact',
] as const

export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number]

export const termKey = (term: GlossaryTerm) => `glossary.${term}.term`
export const helpKey = (term: GlossaryTerm) => `glossary.${term}.help`
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- glossary`
Expected: FAIL — the terms exist, the translations do not yet. That is Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/glossary.ts src/lib/glossary.test.ts
git commit -m "feat: name the words the console expects you to know"
```

Note for the reviewer: this commit lands with one failing test on purpose, and Task 4 is what makes it pass. If you would rather not commit red, do Tasks 3 and 4 as one commit.

---

### Task 4: The glossary in ten languages

**Files:**
- Modify: `src/i18n/locales/en.ts`, `de.ts`, `es.ts`, `pt.ts`, `uk.ts`, `ru.ts`, `zh.ts`, `ja.ts`, `ko.ts`, `hi.ts`

- [ ] **Step 1: Add the English block**

Insert a top-level `glossary` key in `src/i18n/locales/en.ts`, as a sibling of `console` (before it, so the file reads glossary-then-console):

```ts
  glossary: {
    block: {
      term: 'Block',
      help: 'A batch of transactions, written to the chain in one go and never changed afterwards. Until a transaction is in a block, it has not really happened.',
    },
    height: {
      term: 'Height',
      help: 'How many blocks the chain has. It only ever counts up, so it doubles as the chain’s clock.',
    },
    forge: {
      term: 'Forge',
      help: 'Making the next block. Signum calls it forging rather than mining because it costs a hard drive, not electricity. Here it costs one button press.',
    },
    forger: {
      term: 'Forger',
      help: 'The account credited with the blocks you make, and the one that collects their fees and rewards. Pick one before forging.',
    },
    passphrase: {
      term: 'Passphrase',
      help: 'Not a password protecting an account — it *is* the account. The address is calculated from it, so the same passphrase always gives the same account, and nobody can restore a lost one.',
    },
    address: {
      term: 'Address',
      help: 'Where an account can be reached, calculated from its passphrase. The letters after the prefix are a checksum, so a typo is caught rather than sending money to nobody.',
    },
    publicKey: {
      term: 'Public key',
      help: 'The account’s open half. An account that has never received anything is unknown to the chain, so the first payment to it has to carry this key along.',
    },
    unconfirmed: {
      term: 'Unconfirmed',
      help: 'Sent, but not yet in a block. The node is holding it. Forge a block and watch it settle.',
    },
    fee: {
      term: 'Fee',
      help: 'What a transaction costs its sender, paid to whoever forges the block. Signum sets a minimum per transaction type and per attachment size.',
    },
    payload: {
      term: 'Payload',
      help: 'Data carried along by a transaction — plain text, encrypted text, or a structured record. This is the part that makes a chain useful for more than money.',
    },
    src44: {
      term: 'SRC44',
      help: 'Signum’s agreed shape for a payload: name, description, type, links and your own fields. Because everyone uses the same shape, other applications can read what you write.',
    },
    token: {
      term: 'Token',
      help: 'Your own asset on the chain, with its own name, supply and decimals. Signum does this natively — no smart contract, no deployment.',
    },
    alias: {
      term: 'Alias',
      help: 'A name registered on the chain that points at something: an account, a link, or any content you choose. A name registry built into the protocol.',
    },
    subscription: {
      term: 'Subscription',
      help: 'A payment that repeats on its own. You set it up once and the chain carries it out until it is cancelled.',
    },
    multiOut: {
      term: 'Multi-out',
      help: 'One transaction paying many accounts — up to 64 with individual amounts, or 128 all getting the same. One fee instead of a hundred.',
    },
    contact: {
      term: 'Contact',
      help: 'A name you give an account you do not own, kept in this browser only. It makes the stream readable without putting anything on the chain.',
    },
  },
```

- [ ] **Step 2: Add the German block**

```ts
  glossary: {
    block: {
      term: 'Block',
      help: 'Ein Bündel Transaktionen, in einem Zug in die Chain geschrieben und danach unveränderlich. Solange eine Transaktion in keinem Block steht, ist sie nicht wirklich passiert.',
    },
    height: {
      term: 'Höhe',
      help: 'Wie viele Blöcke die Chain hat. Sie zählt nur aufwärts und ist damit zugleich die Uhr der Chain.',
    },
    forge: {
      term: 'Forgen',
      help: 'Den nächsten Block erzeugen. Signum sagt forgen statt minen, weil es eine Festplatte kostet und keinen Strom. Hier kostet es einen Knopfdruck.',
    },
    forger: {
      term: 'Forger',
      help: 'Das Konto, dem deine Blöcke gutgeschrieben werden und das ihre Gebühren und Belohnungen einsammelt. Wähle eines, bevor du forgst.',
    },
    passphrase: {
      term: 'Passphrase',
      help: 'Kein Passwort, das ein Konto schützt — sie *ist* das Konto. Die Adresse wird aus ihr berechnet, dieselbe Passphrase ergibt immer dasselbe Konto, und eine verlorene kann niemand wiederherstellen.',
    },
    address: {
      term: 'Adresse',
      help: 'Wo ein Konto erreichbar ist, berechnet aus seiner Passphrase. Die Zeichen hinter dem Präfix sind eine Prüfsumme — ein Tippfehler fällt auf, statt Geld ins Nichts zu schicken.',
    },
    publicKey: {
      term: 'Public Key',
      help: 'Die offene Hälfte des Kontos. Ein Konto, das noch nie etwas empfangen hat, kennt die Chain nicht — die erste Zahlung dorthin muss diesen Schlüssel mitbringen.',
    },
    unconfirmed: {
      term: 'Unbestätigt',
      help: 'Abgeschickt, aber noch in keinem Block. Der Node hält sie fest. Forge einen Block und sieh zu, wie sie sich setzt.',
    },
    fee: {
      term: 'Gebühr',
      help: 'Was eine Transaktion ihren Sender kostet, gezahlt an den, der den Block forgt. Signum legt ein Minimum je Transaktionsart und je Anhangsgröße fest.',
    },
    payload: {
      term: 'Payload',
      help: 'Daten, die eine Transaktion mitführt — Klartext, verschlüsselter Text oder ein strukturierter Datensatz. Dieser Teil macht eine Chain zu mehr als Geld.',
    },
    src44: {
      term: 'SRC44',
      help: 'Signums vereinbarte Form für Payload: Name, Beschreibung, Typ, Links und eigene Felder. Weil alle dieselbe Form nutzen, können andere Anwendungen lesen, was du schreibst.',
    },
    token: {
      term: 'Token',
      help: 'Ein eigener Wert auf der Chain, mit Name, Menge und Nachkommastellen. Signum kann das nativ — kein Smart Contract, kein Deployment.',
    },
    alias: {
      term: 'Alias',
      help: 'Ein auf der Chain registrierter Name, der auf etwas zeigt: ein Konto, einen Link oder beliebigen Inhalt. Ein Namensregister im Protokoll selbst.',
    },
    subscription: {
      term: 'Subscription',
      help: 'Eine Zahlung, die sich von selbst wiederholt. Einmal eingerichtet, führt die Chain sie aus, bis sie gekündigt wird.',
    },
    multiOut: {
      term: 'Multi-Out',
      help: 'Eine Transaktion, die viele Konten bezahlt — bis zu 64 mit einzelnen Beträgen oder 128 mit demselben. Eine Gebühr statt hundert.',
    },
    contact: {
      term: 'Kontakt',
      help: 'Ein Name, den du einem fremden Konto gibst, nur in diesem Browser gespeichert. Er macht den Stream lesbar, ohne etwas auf die Chain zu schreiben.',
    },
  },
```

- [ ] **Step 3: Translate the same key set into the remaining eight**

`es`, `pt`, `uk`, `ru`, `zh`, `ja`, `ko`, `hi` each get a `glossary` block with exactly these sixteen terms and both keys each. Translate the meaning, not the words — these are explanations, and an explanation that reads like machine output teaches nothing. Keep `SRC44`, `Multi-Out`, `Signum` and `SIGNA` untranslated; they are proper nouns on the chain. `locales.test.ts` is the gate: it compares every locale's flattened key set against English and fails on any difference.

- [ ] **Step 4: Run the tests**

Run: `bun run test`
Expected: PASS, including `glossary` and all nine `locales` cases

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "feat: explain the sixteen words, in ten languages"
```

---

### Task 5: Term, the word with an explanation beside it

**Files:**
- Create: `src/components/console/Term.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/console/Term.tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { helpKey, termKey, type GlossaryTerm } from '@/lib/glossary'
import { useBeginnerMode } from './BeginnerMode'

/**
 * A domain word, and in beginner mode the `i` that explains it.
 *
 * Outside beginner mode it renders the word and nothing else — no wrapper,
 * no spacing change — so switching the mode off leaves the console laid out
 * exactly as it was before any of this existed.
 *
 * `children` is for the places where the surrounding sentence needs its own
 * wording: the tooltip still comes from the glossary, but the visible word is
 * whatever fits the line.
 */
export function Term({ id, children }: { id: GlossaryTerm; children?: ReactNode }) {
  const { t } = useTranslation()
  const beginner = useBeginnerMode()
  const label = children ?? t(termKey(id))

  if (!beginner) return <>{label}</>

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <InfoTooltip text={t(helpKey(id))} />
    </span>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/components/console/Term.tsx
git commit -m "feat: a domain word that can explain itself"
```

---

### Task 6: The entry question

**Files:**
- Create: `src/components/console/FirstVisit.tsx`
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Add the English strings**

Inside `console` in `en.ts`:

```ts
    firstVisit: {
      title: 'First time here?',
      description:
        'This is a throwaway Signum chain that runs on your machine. Nothing here is worth anything, so nothing here can go wrong.',
      newHere: 'I’m new to this',
      oldHand: 'I know my way around',
      newHereNote: 'Explanations everywhere, and an offer to walk you through it',
      oldHandNote: 'Straight to the console',
    },
```

German:

```ts
    firstVisit: {
      title: 'Zum ersten Mal hier?',
      description:
        'Das ist eine Wegwerf-Chain von Signum, die auf deinem Rechner läuft. Nichts davon ist etwas wert, also kann nichts davon schiefgehen.',
      newHere: 'Ich bin neu hier',
      oldHand: 'Ich kenne mich aus',
      newHereNote: 'Erklärungen überall, und das Angebot, dich durchzuführen',
      oldHandNote: 'Direkt in die Konsole',
    },
```

Then the same six keys in the other eight locales.

- [ ] **Step 2: Write the panel**

```tsx
// src/components/console/FirstVisit.tsx
import { useTranslation } from 'react-i18next'
import { ConsoleButton } from './ConsoleButton'

/**
 * Asked once, in the stage, where the transaction list will be.
 *
 * Not a modal: a dialog that greys out the console before anyone has seen it
 * makes the first impression a barrier. Not on the start page either — that
 * page has one job, choosing between the API docs and the sandbox, and it
 * keeps it. This sits where the answer is about to matter.
 */
export function FirstVisit({ onAnswer }: { onAnswer: (beginner: boolean) => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-[13px] text-[var(--blue3)]">{t('console.firstVisit.title')}</p>
      <p className="max-w-[420px] text-[11px] leading-relaxed text-[var(--muted)]">
        {t('console.firstVisit.description')}
      </p>
      <div className="flex flex-wrap items-start justify-center gap-3">
        {([true, false] as const).map((beginner) => (
          <div key={String(beginner)} className="flex max-w-[190px] flex-col items-center gap-1">
            <ConsoleButton onClick={() => onAnswer(beginner)}>
              {t(beginner ? 'console.firstVisit.newHere' : 'console.firstVisit.oldHand')}
            </ConsoleButton>
            <span className="text-[10px] leading-relaxed text-[var(--muted)]">
              {t(beginner ? 'console.firstVisit.newHereNote' : 'console.firstVisit.oldHandNote')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Show it in the shell**

In `ConsoleShell.tsx`, add the hook beside the others:

```tsx
import { useBeginner } from '@/hooks/useBeginner'
import { BeginnerMode } from './BeginnerMode'
import { FirstVisit } from './FirstVisit'
```

```tsx
  const beginner = useBeginner()
```

Wrap the returned tree in the provider, and inside the stage box render the panel instead of the tabs' content until the question is answered:

```tsx
  return (
    <BeginnerMode on={beginner.beginner}>
      <div className="mx-auto flex h-screen max-w-6xl flex-col p-6">
        ...
        <div
          className="flex min-h-[200px] min-w-0 flex-1 flex-col border p-3"
          style={{ borderColor: 'var(--border2)' }}
        >
          {!beginner.answered && <FirstVisit onAnswer={beginner.setBeginner} />}
          {beginner.answered && tab === 'transactions' && (
            <TransactionsView ... />
          )}
          {beginner.answered && tab === 'blocks' && ( ... )}
          {beginner.answered && tab === 'watch' && watched.watchedId && ( ... )}
          {beginner.answered && tab === 'accounts' && ( ... )}
        </div>
        ...
      </div>
    </BeginnerMode>
  )
```

- [ ] **Step 4: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 5: Commit**

```bash
git add src/components/console/FirstVisit.tsx src/components/console/ConsoleShell.tsx src/i18n/locales
git commit -m "feat: ask once whether this is your first chain"
```

---

### Task 7: The switch in the help drawer

**Files:**
- Modify: `src/components/console/drawers/HelpDrawer.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Add the strings**

English, inside `console`:

```ts
    help: {
      beginner: 'Beginner mode',
      beginnerNote: 'Adds an explanation beside every domain word, and a sentence of context above every view.',
      tour: 'Take the tour',
      tourNote: 'Nine minutes, all of it on the real chain.',
      tourStop: 'Stop the tour',
    },
```

German:

```ts
    help: {
      beginner: 'Einsteiger-Modus',
      beginnerNote: 'Setzt neben jedes Fachwort eine Erklärung und über jede Ansicht einen Satz Kontext.',
      tour: 'Tour starten',
      tourNote: 'Neun Minuten, alles auf der echten Chain.',
      tourStop: 'Tour beenden',
    },
```

Then the other eight.

- [ ] **Step 2: Rewrite the drawer**

```tsx
// src/components/console/drawers/HelpDrawer.tsx
import { useTranslation } from 'react-i18next'
import { Toggle } from '@/components/console/Toggle'
import { ConsoleButton } from '@/components/console/ConsoleButton'

/**
 * Sound, theme and language moved into the app header, where they sit on
 * every page instead of behind a drawer on one. What is left is the way out
 * to the API documentation, and the two controls the first-visit question
 * sets by proxy — both reachable here forever after, because an answer given
 * once should never be a decision you are stuck with.
 */
export function HelpDrawer({
  beginner,
  onBeginner,
  tourActive,
  onStartTour,
  onStopTour,
}: {
  beginner: boolean
  onBeginner: (on: boolean) => void
  tourActive: boolean
  onStartTour: () => void
  onStopTour: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div>
        <Toggle checked={beginner} onChange={onBeginner} label={t('console.help.beginner')} />
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
          {t('console.help.beginnerNote')}
        </p>
      </div>

      <div>
        <ConsoleButton onClick={tourActive ? onStopTour : onStartTour}>
          {t(tourActive ? 'console.help.tourStop' : 'console.help.tour')}
        </ConsoleButton>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
          {t('console.help.tourNote')}
        </p>
      </div>

      <a
        className="text-[11px] text-[var(--blue3)] underline"
        href="/api-doc/"
        target="_blank"
        rel="noreferrer"
      >
        ↗ {t('entry.apiDocs.title')}
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Pass the props from the shell**

The tour props do not exist yet. Until Task 12 wires `useTour`, pass placeholders so the tree compiles:

```tsx
            {drawer === 'help' && (
              <HelpDrawer
                beginner={beginner.beginner}
                onBeginner={beginner.setBeginner}
                tourActive={false}
                onStartTour={() => {}}
                onStopTour={() => {}}
              />
            )}
```

- [ ] **Step 4: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 5: Commit**

```bash
git add src/components/console/drawers/HelpDrawer.tsx src/components/console/ConsoleShell.tsx src/i18n/locales
git commit -m "feat: beginner mode is a switch, not a one-time answer"
```

---

### Task 8: A sentence above each view

**Files:**
- Create: `src/components/console/ViewNote.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Add the strings**

English, inside `console`:

```ts
    note: {
      transactions:
        'Everything happening on the chain, newest first. Unconfirmed entries are waiting for the next block — forge one and watch them settle.',
      blocks:
        'Every block ever forged. Most are empty, because a block is made whether or not anyone sent anything.',
      accounts:
        'The accounts this browser holds the passphrases for, and the contacts you have named. An account appears on the chain only once it has received something.',
      watch:
        'One account kept in view: what it holds, what it is called on chain, and what has gone in and out.',
      send: 'Every kind of transaction Signum can carry. Pick one and the line beneath says what it does.',
      chain: 'Undo what you did. Winding back removes blocks; it cannot empty the chain — only restarting the node can.',
    },
```

German:

```ts
    note: {
      transactions:
        'Alles, was auf der Chain passiert, das Neueste zuerst. Unbestätigte Einträge warten auf den nächsten Block — forge einen und sieh zu, wie sie sich setzen.',
      blocks:
        'Jeder je geforgte Block. Die meisten sind leer, denn ein Block entsteht, ob jemand etwas gesendet hat oder nicht.',
      accounts:
        'Die Konten, deren Passphrasen dieser Browser hält, und die Kontakte, die du benannt hast. Ein Konto erscheint erst auf der Chain, wenn es etwas empfangen hat.',
      watch:
        'Ein Konto im Blick: was es hält, wie es auf der Chain heißt, und was ein- und ausgegangen ist.',
      send: 'Jede Transaktionsart, die Signum kennt. Wähle eine, die Zeile darunter sagt, was sie tut.',
      chain: 'Mach rückgängig, was du getan hast. Zurückspulen entfernt Blöcke; leeren kann es die Chain nicht — das kann nur ein Neustart des Nodes.',
    },
```

Then the other eight.

- [ ] **Step 2: Write the component**

```tsx
// src/components/console/ViewNote.tsx
import { useTranslation } from 'react-i18next'
import { useBeginnerMode } from './BeginnerMode'

/**
 * One sentence saying what you are looking at.
 *
 * Beginner mode only, and deliberately not a tooltip: a view needs its
 * context before you have decided which word you did not understand.
 */
export function ViewNote({ id }: { id: string }) {
  const beginner = useBeginnerMode()
  const { t } = useTranslation()
  if (!beginner) return null
  return (
    <p className="mb-2 shrink-0 text-[10px] leading-relaxed text-[var(--muted)]">
      {t(`console.note.${id}`)}
    </p>
  )
}
```

- [ ] **Step 3: Place one above each view and drawer**

In `ConsoleShell.tsx`, immediately inside the stage box and before each view:

```tsx
          {beginner.answered && tab === 'transactions' && (
            <>
              <ViewNote id="transactions" />
              <TransactionsView ... />
            </>
          )}
```

Do the same for `blocks`, `accounts` and `watch`. For the two drawers that earn one, put the note directly under the drawer title, before the drawer body:

```tsx
            {drawer === 'send' && (
              <>
                <ViewNote id="send" />
                <SendDrawer store={accounts} contacts={contacts.contacts} />
              </>
            )}
            {drawer === 'chain' && (
              <>
                <ViewNote id="chain" />
                <ChainDrawer height={state.height} />
              </>
            )}
```

The help drawer gets no note: it is the explanation.

- [ ] **Step 4: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 5: Commit**

```bash
git add src/components/console/ViewNote.tsx src/components/console/ConsoleShell.tsx src/i18n/locales
git commit -m "feat: say what each view is before explaining its words"
```

---

### Task 9: The words, in place

**Files:**
- Modify: `src/components/console/Header.tsx`
- Modify: `src/components/console/views/TransactionRow.tsx`
- Modify: `src/components/console/views/BlocksView.tsx`
- Modify: `src/components/console/views/AccountsView.tsx`
- Modify: `src/components/console/views/AccountDetail.tsx`
- Modify: `src/components/console/drawers/forms/fields.tsx`

- [ ] **Step 1: Wrap the words the console already prints**

The rule: wrap a label that is already on screen, never add a new one. `Term` renders nothing extra outside beginner mode, so this is invisible until the mode is on.

In `Header.tsx`, the height label:

```tsx
        <span className="text-[var(--muted)]">
          <Term id="height">{t('console.chain.height')}</Term>{' '}
        </span>
```

and the forge button's own word:

```tsx
        <ConsoleButton disabled={!canForge || busy} onClick={() => void forgeClicked()}>
          ⛏ <Term id="forge">{t('console.forge.action')}</Term>
        </ConsoleButton>
```

and the forger picker's placeholder stays plain — a `Select` placeholder takes a string, not a node. Instead put the term on the label beside it if one exists; if not, leave it. Do not restructure `Select` for this.

Apply the same treatment to:

| File | Existing label | Term id |
|---|---|---|
| `views/TransactionRow.tsx` | `t('console.tx.unconfirmed')` | `unconfirmed` |
| `views/TransactionRow.tsx` | `t('console.tx.fee')` | `fee` |
| `views/BlocksView.tsx` | `t('console.blocks.forger')` | `forger` |
| `views/AccountsView.tsx` | `t('console.accounts.passphrase')` | `passphrase` |
| `views/AccountsView.tsx` | `t('console.accounts.sectionContacts')` | `contact` |
| `views/AccountDetail.tsx` | `t('console.accounts.address')` | `address` |
| `views/AccountDetail.tsx` | `t('console.accounts.publicKey')` | `publicKey` |
| `views/AccountDetail.tsx` | `t('console.accounts.holdings')` | `token` |
| `views/AccountDetail.tsx` | `t('console.accounts.aliases')` | `alias` |
| `drawers/forms/fields.tsx` | the `FeeField` label | `fee` |
| `drawers/forms/payload.tsx` | `t('console.src44.structured')` | `src44` |

- [ ] **Step 2: Check every wrapped label still renders plainly**

Run: `bun run build`
Expected: exit 0. A label that was inside an attribute (`title=`, `placeholder=`, `aria-label=`) cannot take a component — if the compiler objects, leave that one plain rather than reworking the component around it.

- [ ] **Step 3: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 4: Commit**

```bash
git add src/components/console
git commit -m "feat: put the explanations where the words already are"
```

---

### Task 10: The tour as data

**Files:**
- Create: `src/lib/consoleNav.ts`
- Modify: `src/components/console/ConsoleShell.tsx` (import the moved types, re-export them)
- Create: `src/lib/tour.ts`
- Test: `src/lib/tour.test.ts`

- [ ] **Step 1: Move the navigation types out of the component**

```ts
// src/lib/consoleNav.ts

/**
 * Which stage is showing, and which drawer is open.
 *
 * These live in a library rather than in ConsoleShell because the tour needs
 * to name a tab in its step definitions, and a pure module must not import a
 * React component to do it.
 */
export type ConsoleTab = 'transactions' | 'blocks' | 'accounts' | 'watch'
export type DrawerName = 'send' | 'chain' | 'help' | null
```

In `ConsoleShell.tsx`, replace the two type declarations with:

```tsx
import type { ConsoleTab, DrawerName } from '@/lib/consoleNav'

export type { ConsoleTab, DrawerName }
```

`src/components/console/index.ts` keeps working unchanged.

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/tour.test.ts
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
```

- [ ] **Step 3: Run it and watch it fail**

Run: `bun run test -- tour`
Expected: FAIL, `Failed to resolve import "./tour"`

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/tour.ts
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
```

- [ ] **Step 5: Run the test**

Run: `bun run test -- tour`
Expected: PASS, 15 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/tour.ts src/lib/tour.test.ts src/lib/consoleNav.ts src/components/console/ConsoleShell.tsx
git commit -m "feat: the tour is eighteen steps of data and one pure function"
```

---

### Task 11: The tour hook

**Files:**
- Create: `src/hooks/useTour.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useTour.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx, useAudio } from '@/audio'
import { TOUR_STEPS, isStepComplete, type Observation, type TourStep } from '@/lib/tour'

export interface TourStore {
  active: boolean
  step: TourStep | null
  /** 1-based, for "step 4 of 18". */
  position: number
  total: number
  start: () => void
  stop: () => void
  /** Finishes an acknowledge step. Does nothing on a step the chain must answer. */
  acknowledge: () => void
}

/**
 * Which step is showing, and when it gives way to the next.
 *
 * The hook watches the observation it is handed and advances by itself: the
 * user forges a block because they wanted to, not because a "next" button was
 * waiting. Steps that only explain something have no chain answer, so those
 * get the button instead — that is what `acknowledge` is.
 */
export function useTour(observation: Observation): TourStore {
  const [index, setIndex] = useState<number | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const { play } = useAudio()

  // The observation as it stood when this step began, so "the height rose"
  // measures from here. A ref and not state: writing it must not itself cause
  // the render that would overwrite it.
  const baseline = useRef(observation)

  const step = index === null ? null : (TOUR_STEPS[index] ?? null)

  useEffect(() => {
    if (index === null || !step) return
    if (!isStepComplete(step, observation, baseline.current, acknowledged)) return
    play(sfx.confirm)
    const next = index + 1
    if (next >= TOUR_STEPS.length) {
      setIndex(null)
      return
    }
    baseline.current = observation
    setAcknowledged(false)
    setIndex(next)
  }, [index, step, observation, acknowledged, play])

  const start = useCallback(() => {
    baseline.current = observation
    setAcknowledged(false)
    setIndex(0)
  }, [observation])

  return {
    active: index !== null,
    step,
    position: (index ?? 0) + 1,
    total: TOUR_STEPS.length,
    start,
    stop: () => setIndex(null),
    acknowledge: () => setAcknowledged(true),
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTour.ts
git commit -m "feat: the tour advances when the chain answers, not when you click"
```

---

### Task 12: The overlay

**Files:**
- Create: `src/components/console/tour/TourOverlay.tsx`
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Add the frame strings**

English, top level, beside `console`:

```ts
  tour: {
    position: 'Step {{position}} of {{total}}',
    next: 'Got it',
    finish: 'Go and build something',
    finaleFooter:
      'All of it is in the Send drawer, each with a line saying what it does. Beginner mode and this tour live behind Help, and the full JSON API is one click further.',
    stop: 'End the tour',
    waiting: 'Waiting for you…',
    step: {},
    useCase: {},
  },
```

Leave `step` and `useCase` empty for now; Task 14 fills them. Every locale gets the same five strings and the same two empty objects. An empty object flattens to no keys at all, so `locales.test.ts` stays satisfied either way.

- [ ] **Step 2: Write the overlay**

```tsx
// src/components/console/tour/TourOverlay.tsx
import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { TOUR_USE_CASES } from '@/lib/tour'
import type { TourStore } from '@/hooks/useTour'

const CALLOUT_WIDTH = 300
/** The last step is a list, not a sentence, and 300px is a column of words. */
const FINALE_WIDTH = 460
const GAP = 10

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/**
 * The ring around what the step is about, and the card that explains it.
 *
 * The ring is drawn, not dimmed: a full-screen scrim would have to let clicks
 * through to the highlighted control, and a scrim with a hole in it is a lot
 * of geometry for a console the user is meant to keep using while the tour
 * runs. Nothing here blocks the page — the card is the only thing that takes
 * a click, and even it can be walked away from.
 */
export function TourOverlay({ tour }: { tour: TourStore }) {
  const { t } = useTranslation()
  const [box, setBox] = useState<Box | null>(null)
  const target = tour.step?.target ?? null

  useLayoutEffect(() => {
    if (!target) {
      setBox(null)
      return
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`)
      if (!el) {
        setBox(null)
        return
      }
      const r = el.getBoundingClientRect()
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    // The console reflows constantly — the auto-forge cluster appears, rows
    // page, drawers open — and a ring left behind at a stale rectangle points
    // at nothing. Re-measuring on a slow interval costs a rect read per tick
    // and never goes stale.
    const timer = window.setInterval(measure, 300)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [target])

  if (!tour.active || !tour.step) return null

  const acknowledgeable = tour.step.completion.kind === 'acknowledge'
  const finale = tour.step.finale === true
  const width = finale ? FINALE_WIDTH : CALLOUT_WIDTH
  // Below the target if there is room, above it otherwise; and never off the
  // right edge. The finale has no target and centres itself.
  const below = box ? box.top + box.height + GAP : 0
  const calloutTop = box && below + 180 > window.innerHeight ? box.top - 180 : below
  const calloutLeft = box
    ? Math.min(box.left, window.innerWidth - width - GAP)
    : window.innerWidth / 2 - width / 2

  return (
    <>
      {box && (
        <div
          className="pointer-events-none fixed z-40"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
            border: '1px solid var(--blue2)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,.28)',
          }}
        />
      )}

      <div
        className="themed-scroll console-scroll fixed z-50 overflow-y-auto p-3"
        style={{
          // The finale is the one card tall enough to run off a short screen,
          // so it is pinned near the top and scrolls inside itself rather than
          // hiding its own last idea and its own button below the fold.
          top: finale ? '8vh' : box ? calloutTop : window.innerHeight / 2 - 90,
          left: calloutLeft,
          width,
          maxHeight: finale ? '84vh' : undefined,
          background: 'var(--bg2)',
          border: '1px solid var(--blue2)',
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[1px] text-[var(--blue3)]">
            {t('tour.position', { position: tour.position, total: tour.total })}
          </span>
          <RowButton className="text-[11px] text-[var(--muted)]" onClick={tour.stop}>
            ✕
          </RowButton>
        </div>

        <p
          className={finale ? 'mb-1 text-[13px] text-[var(--blue3)]' : 'mb-1 text-[11px] text-[var(--fg)]'}
        >
          {t(`tour.step.${tour.step.id}.title`)}
        </p>
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--muted)]">
          {t(`tour.step.${tour.step.id}.body`)}
        </p>

        {/*
          The list only the last step has. Two columns where there is room:
          eight ideas stacked in one column reads as a form to work through,
          and the point of this card is that it should feel like an open door.
        */}
        {finale && (
          <ul className="mb-3 grid gap-2 sm:grid-cols-2">
            {TOUR_USE_CASES.map((id) => (
              <li key={id} className="border-l pl-2" style={{ borderColor: 'var(--blue2)' }}>
                <p className="text-[10px] text-[var(--fg)]">{t(`tour.useCase.${id}.title`)}</p>
                <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                  {t(`tour.useCase.${id}.body`)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {finale && (
          <p className="mb-3 text-[10px] leading-relaxed text-[var(--muted)]">
            {t('tour.finaleFooter')}
          </p>
        )}

        {acknowledgeable ? (
          <ConsoleButton onClick={tour.acknowledge}>
            {t(finale ? 'tour.finish' : 'tour.next')}
          </ConsoleButton>
        ) : (
          <span className="text-[10px] text-[var(--blue3)]">{t('tour.waiting')}</span>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 4: Commit**

```bash
git add src/components/console/tour/TourOverlay.tsx src/i18n/locales
git commit -m "feat: a ring around what the step is about"
```

---

### Task 13: Targets and prefill

**Files:**
- Modify: `src/components/console/Header.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`
- Modify: `src/components/console/views/AccountsView.tsx`
- Modify: `src/components/console/drawers/SendDrawer.tsx`
- Modify: `src/components/console/drawers/forms/PaymentForm.tsx`

- [ ] **Step 1: Mark the targets**

`ConsoleButton`, `Select` and `Toggle` do not forward unknown props, so a `data-tour` attribute goes on a wrapping element rather than on the control. Wrap where there is no element to hang it on:

In `Header.tsx`:

```tsx
      <span className="text-[11px]" data-tour="height">
```

```tsx
        <span data-tour="forge-button">
          <ConsoleButton disabled={!canForge || busy} onClick={() => void forgeClicked()}>
            ⛏ <Term id="forge">{t('console.forge.action')}</Term>
          </ConsoleButton>
        </span>
```

```tsx
        <div className="w-36" data-tour="forger-select">
```

```tsx
        {(['send', 'chain', 'help'] as const).map((name) => (
          <span key={name} data-tour={name === 'send' ? 'send-button' : undefined}>
            <ConsoleButton onClick={() => onOpenDrawer(name)}>
              {t(`console.drawer.${name}`)}
            </ConsoleButton>
          </span>
        ))}
```

In `ConsoleShell.tsx`, on each tab button's wrapper:

```tsx
          {[...TABS, ...(watched.watchedId ? (['watch'] as const) : [])].map((name) => (
            <span key={name} data-tour={name === 'accounts' ? 'accounts-tab' : name === 'transactions' ? 'transactions-tab' : undefined}>
              <ConsoleButton ...>
```

Move the existing `key={name}` from `ConsoleButton` to the wrapping `span`.

In `AccountsView.tsx`, on the element containing the create control:

```tsx
        <div data-tour="create-account">
```

- [ ] **Step 2: Let the send drawer be pre-filled**

`SendDrawer` gains one optional prop, and passes it to the payment form only — that is the only action the tour asks for:

```tsx
export interface SendPrefill {
  signa: string
}

export function SendDrawer({
  store,
  contacts,
  prefill,
}: {
  store: AccountStore
  contacts: Contacts
  prefill?: SendPrefill
}) {
```

```tsx
      {kind === 'payment' && (
        <PaymentForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          contacts={contacts}
          initialSigna={prefill?.signa}
          onSent={onSent}
          onError={onError}
        />
      )}
```

In `PaymentForm.tsx`:

```tsx
export function PaymentForm({
  accounts,
  forgerId,
  contacts,
  initialSigna,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  forgerId: string | null
  contacts: Contacts
  /** A starting amount, for the tour. The field stays fully editable. */
  initialSigna?: string
  onSent: () => void
  onError: (message: string) => void
}) {
```

```tsx
  const [amount, setAmount] = useState(initialSigna ?? '')
```

An initial value and not a controlled override: the tour suggests an amount, it does not hold the field hostage. The recipient is deliberately left empty — the tour's point at that step is that you choose who to pay.

- [ ] **Step 3: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 4: Commit**

```bash
git add src/components/console
git commit -m "feat: name the places the tour can point at"
```

---

### Task 14: The tour's words, in ten languages

**Files:**
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Fill the English `tour.step` block**

```ts
    step: {
      welcome: {
        title: 'This chain is yours',
        body: 'It runs on your machine, it is worth nothing, and you cannot break it in a way a restart will not fix. We will make an account, forge a block and send a payment — all of it real, none of it simulated.',
      },
      openAccounts: {
        title: 'Open the Accounts tab',
        body: 'Everything starts with an account. This is where they live.',
      },
      createAccount: {
        title: 'Create an account',
        body: 'Give it a label — that name is for you, kept in this browser. The chain will not see it.',
      },
      passphraseIsTheAccount: {
        title: 'That passphrase is the account',
        body: 'It is not a password protecting an account. The address you see was calculated from those words. Type them again anywhere in the world and you get the same account back.',
      },
      passphraseIsForever: {
        title: 'Nobody can give it back to you',
        body: 'There is no reset link and no support desk. Lose the passphrase and the account is gone, with whatever was in it. That is not a flaw — it is what having no middleman costs.',
      },
      passphraseInPlainText: {
        title: 'The sandbox keeps it in the clear',
        body: 'It is sitting in this browser’s storage as readable text. That is fine here, because it guards nothing. A real wallet must never do this, and the sandbox refuses to even load these accounts if the node turns out not to be the mock chain.',
      },
      notOnChainYet: {
        title: 'It is not on the chain yet',
        body: 'The chain has never heard of this account, because nothing has ever been sent to it. Watch what happens when it earns something.',
      },
      pickForger: {
        title: 'Choose it as the forger',
        body: 'The forger is the account credited with the blocks you make. Pick the one you just created.',
      },
      forge: {
        title: 'Now forge a block',
        body: 'On the real Signum network this takes a hard drive and about four minutes. Here it takes a button.',
      },
      heightRose: {
        title: 'The height went up',
        body: 'That number is how many blocks exist. It only counts up, which makes it the chain’s clock — and the block you just made paid your account its reward.',
      },
      nowOnChain: {
        title: 'And there it is',
        body: 'The account has a balance now, so the chain knows it exists. It did not need registering; receiving something is what put it there.',
      },
      secondAccount: {
        title: 'One more account',
        body: 'You need somewhere to send money to. Make a second one — same as before.',
      },
      openSend: {
        title: 'Open the Send drawer',
        body: 'Every kind of transaction Signum can carry starts here.',
      },
      sendPayment: {
        title: 'Pay your second account',
        body: 'From the funded account, to the new one. The amount is filled in; change it if you like. The fee below is what the forger of the next block will earn for carrying it.',
      },
      unconfirmed: {
        title: 'It says unconfirmed',
        body: 'The node has your transaction but no block contains it yet, so it has not really happened. Nothing is final until it is in a block.',
      },
      forgeAgain: {
        title: 'Forge again and watch it settle',
        body: 'One more block. Your transaction goes into it, and the fee you paid comes back to you — you are the forger.',
      },
      settled: {
        title: 'That is the whole loop',
        body: 'Sign, broadcast, wait for a block, done. Every chain works this way; most just make you wait longer to see it.',
      },
      finale: {
        title: 'You can build on a blockchain now',
        body: 'That was all of it: an account, a block, a transaction, a confirmation. Everything past that is what you decide to put in the payload — and people put remarkable things in there. Eight of them, all buildable with exactly what you just did:',
      },
    },
    useCase: {
      tracing: {
        title: 'Trace a supply chain',
        body: 'Every handover is a payment carrying a structured payload. Nobody owns the record, nobody can quietly edit last month, and a partner can read it without asking you for access.',
      },
      notarising: {
        title: 'Prove something existed',
        body: 'Put a document’s fingerprint in a payload. The block it lands in is a timestamp nobody can move — a notary for a fraction of a SIGNA.',
      },
      credentials: {
        title: 'Issue certificates that verify themselves',
        body: 'A diploma, a licence, a safety inspection: issue it as a token held by its owner. Checking it is one query, and faking it is not illegal but impossible.',
      },
      tokenising: {
        title: 'Tokenise a business',
        body: 'Shares, revenue, membership. Issue the token natively, pay every holder in a single multi-out, and let a subscription handle the part that repeats.',
      },
      games: {
        title: 'Build a game with progress that is real',
        body: 'Items as tokens the player genuinely owns, achievements as payloads nobody can roll back, and a save file that outlives your servers.',
      },
      registry: {
        title: 'Run a registry with no registrar',
        body: 'Aliases are a name system inside the protocol. A name points at an account, a link or any content you choose, and ownership moves with one transaction.',
      },
      machines: {
        title: 'Let machines pay each other',
        body: 'Fees in hundredths of a SIGNA make per-use billing worth doing. A meter, a charging point or a sensor settles in seconds, with no invoice in between.',
      },
      channels: {
        title: 'Send messages no server can read',
        body: 'An encrypted payload gives two accounts a private channel that needs no backend, no sign-up and nobody’s permission to keep working.',
      },
    },
```

- [ ] **Step 2: Fill the German `tour.step` block**

```ts
    step: {
      welcome: {
        title: 'Diese Chain gehört dir',
        body: 'Sie läuft auf deinem Rechner, sie ist nichts wert, und du kannst sie nicht so kaputt machen, dass ein Neustart es nicht richtet. Wir legen ein Konto an, forgen einen Block und senden eine Zahlung — alles echt, nichts simuliert.',
      },
      openAccounts: {
        title: 'Öffne den Reiter Konten',
        body: 'Alles fängt mit einem Konto an. Hier wohnen sie.',
      },
      createAccount: {
        title: 'Lege ein Konto an',
        body: 'Gib ihm eine Bezeichnung — der Name ist für dich und bleibt in diesem Browser. Die Chain sieht ihn nicht.',
      },
      passphraseIsTheAccount: {
        title: 'Diese Passphrase ist das Konto',
        body: 'Sie ist kein Passwort, das ein Konto schützt. Die Adresse, die du siehst, wurde aus diesen Wörtern berechnet. Tippe sie irgendwo auf der Welt erneut ein und du hast dasselbe Konto wieder.',
      },
      passphraseIsForever: {
        title: 'Niemand kann sie dir zurückgeben',
        body: 'Es gibt keinen Zurücksetzen-Link und keinen Support. Ist die Passphrase weg, ist das Konto weg — mit allem, was darin lag. Das ist kein Fehler, das ist der Preis dafür, dass niemand dazwischensteht.',
      },
      passphraseInPlainText: {
        title: 'Die Sandbox speichert sie im Klartext',
        body: 'Sie liegt als lesbarer Text im Speicher dieses Browsers. Hier ist das in Ordnung, weil sie nichts bewacht. Eine echte Wallet darf das niemals tun — und die Sandbox lädt diese Konten gar nicht erst, wenn der Node sich als etwas anderes als die Mock-Chain herausstellt.',
      },
      notOnChainYet: {
        title: 'Auf der Chain steht es noch nicht',
        body: 'Die Chain hat von diesem Konto nie gehört, denn es hat noch nie etwas bekommen. Sieh zu, was passiert, sobald es etwas verdient.',
      },
      pickForger: {
        title: 'Wähle es als Forger',
        body: 'Der Forger ist das Konto, dem deine Blöcke gutgeschrieben werden. Nimm das, das du gerade angelegt hast.',
      },
      forge: {
        title: 'Jetzt forge einen Block',
        body: 'Im echten Signum-Netz braucht das eine Festplatte und etwa vier Minuten. Hier braucht es einen Knopf.',
      },
      heightRose: {
        title: 'Die Höhe ist gestiegen',
        body: 'Diese Zahl sagt, wie viele Blöcke es gibt. Sie zählt nur aufwärts und ist damit die Uhr der Chain — und der Block, den du gerade gemacht hast, hat deinem Konto seine Belohnung ausgezahlt.',
      },
      nowOnChain: {
        title: 'Und da ist es',
        body: 'Das Konto hat jetzt ein Guthaben, also weiß die Chain, dass es existiert. Angemeldet werden musste es nicht — etwas zu empfangen hat es dorthin gebracht.',
      },
      secondAccount: {
        title: 'Noch ein Konto',
        body: 'Du brauchst ein Ziel für dein Geld. Leg ein zweites an — genau wie eben.',
      },
      openSend: {
        title: 'Öffne den Senden-Dialog',
        body: 'Jede Transaktionsart, die Signum kennt, beginnt hier.',
      },
      sendPayment: {
        title: 'Bezahle dein zweites Konto',
        body: 'Vom gedeckten Konto auf das neue. Der Betrag ist vorgetragen, ändere ihn ruhig. Die Gebühr darunter ist das, was der Forger des nächsten Blocks dafür verdient, sie mitzunehmen.',
      },
      unconfirmed: {
        title: 'Da steht unbestätigt',
        body: 'Der Node hat deine Transaktion, aber kein Block enthält sie — also ist sie nicht wirklich passiert. Endgültig ist nichts, bevor es in einem Block steht.',
      },
      forgeAgain: {
        title: 'Forge nochmal und sieh zu',
        body: 'Ein Block mehr. Deine Transaktion kommt hinein, und die Gebühr, die du gezahlt hast, kommt zu dir zurück — du bist ja der Forger.',
      },
      settled: {
        title: 'Das ist der ganze Kreislauf',
        body: 'Signieren, senden, auf einen Block warten, fertig. So arbeitet jede Chain; die meisten lassen dich nur länger warten, bis du es siehst.',
      },
      finale: {
        title: 'Du kannst jetzt auf einer Blockchain bauen',
        body: 'Mehr war es nicht: ein Konto, ein Block, eine Transaktion, eine Bestätigung. Alles Weitere ist das, was du in den Payload legst — und Leute legen Erstaunliches hinein. Acht davon, alle mit genau dem baubar, was du gerade getan hast:',
      },
    },
    useCase: {
      tracing: {
        title: 'Eine Lieferkette nachvollziehen',
        body: 'Jede Übergabe ist eine Zahlung mit strukturiertem Payload. Niemandem gehört das Protokoll, niemand kann den letzten Monat still korrigieren, und ein Partner liest mit, ohne dich um Zugang zu bitten.',
      },
      notarising: {
        title: 'Beweisen, dass etwas existiert hat',
        body: 'Leg den Fingerabdruck eines Dokuments in einen Payload. Der Block, in dem er landet, ist ein Zeitstempel, den niemand verschieben kann — ein Notar für den Bruchteil eines SIGNA.',
      },
      credentials: {
        title: 'Zertifikate ausstellen, die sich selbst prüfen',
        body: 'Ein Zeugnis, eine Lizenz, eine Prüfplakette: als Token ausgeben, den der Inhaber hält. Die Prüfung ist eine Abfrage, und eine Fälschung ist nicht verboten, sondern unmöglich.',
      },
      tokenising: {
        title: 'Ein Unternehmen tokenisieren',
        body: 'Anteile, Erlöse, Mitgliedschaft. Den Token nativ ausgeben, alle Inhaber in einem einzigen Multi-Out auszahlen, und den wiederkehrenden Teil einer Subscription überlassen.',
      },
      games: {
        title: 'Ein Spiel mit echtem Fortschritt bauen',
        body: 'Gegenstände als Token, die dem Spieler wirklich gehören, Erfolge als Payload, den niemand zurückdreht, und ein Spielstand, der deine Server überlebt.',
      },
      registry: {
        title: 'Ein Register ohne Registrar führen',
        body: 'Aliasse sind ein Namenssystem im Protokoll selbst. Ein Name zeigt auf ein Konto, einen Link oder beliebigen Inhalt, und der Besitz wechselt mit einer Transaktion.',
      },
      machines: {
        title: 'Maschinen einander bezahlen lassen',
        body: 'Gebühren in Hundertstel-SIGNA machen Abrechnung pro Nutzung lohnend. Ein Zähler, eine Ladesäule oder ein Sensor rechnet in Sekunden ab, ganz ohne Rechnung dazwischen.',
      },
      channels: {
        title: 'Nachrichten senden, die kein Server liest',
        body: 'Ein verschlüsselter Payload gibt zwei Konten einen privaten Kanal — ohne Backend, ohne Anmeldung und ohne dass jemand die Erlaubnis erteilen muss.',
      },
    },
```

`passphraseIsForever` and `passphraseInPlainText` are the two that must not be softened in any of the other translations either — they are the sentences a newcomer will need outside the sandbox.

- [ ] **Step 3: Fill the remaining eight locales**

Same eighteen step ids and the same eight `useCase` ids, both keys each. `locales.test.ts` fails on any missing or extra key.

The use-case list is the one block in this plan that is marketing as much as documentation, and it is the last thing a newcomer reads. Translate it for effect, not for accuracy alone: short headlines, and a claim in each body that a reader can picture. If a sentence lands flat in the target language, rewrite it rather than transliterating the English.

- [ ] **Step 4: Verify**

Run: `bun run test`
Expected: PASS, all nine locale cases

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "feat: the tour says what it means, in ten languages"
```

---

### Task 15: Wire the tour into the console

**Files:**
- Modify: `src/components/console/ConsoleShell.tsx`

- [ ] **Step 1: Build the observation and run the tour**

```tsx
import { useTour } from '@/hooks/useTour'
import { observeFeed, type Observation } from '@/lib/tour'
import { TourOverlay } from './tour/TourOverlay'
```

After the existing hooks:

```tsx
  // Everything the tour is allowed to know, assembled from what the shell
  // already holds. No extra query: a tour that polls the node to decide
  // whether you did the thing would be a second source of truth about a chain
  // that already has one.
  const ownedIds = new Set(accounts.accounts.map((a) => a.id))
  const observation: Observation = {
    height: state.height ?? 0,
    accountCount: accounts.accounts.length,
    forgerChosen: accounts.forgerId !== null,
    ...observeFeed(feed.items, ownedIds),
    tab,
    drawer,
  }
  const tour = useTour(observation)
```

- [ ] **Step 2: Let a step open what it is about**

```tsx
  // A step that points at the Send drawer opens it. Only when the step
  // changes: reopening it on every render would make the close button useless.
  const stepId = tour.step?.id
  useEffect(() => {
    const opens = tour.step?.opens
    if (!opens) return
    if (opens.tab !== undefined) setTab(opens.tab)
    if (opens.drawer !== undefined) setDrawer(opens.drawer)
    // Keyed on the step id, not the step object, which is a fresh array entry
    // on nothing but is compared by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId])
```

Add `useEffect` to the React import.

- [ ] **Step 3: Hand the prefill to the drawer and the controls to the help drawer**

```tsx
            {drawer === 'send' && (
              <>
                <ViewNote id="send" />
                <SendDrawer
                  store={accounts}
                  contacts={contacts.contacts}
                  prefill={tour.step?.prefill}
                />
              </>
            )}
```

```tsx
            {drawer === 'help' && (
              <HelpDrawer
                beginner={beginner.beginner}
                onBeginner={beginner.setBeginner}
                tourActive={tour.active}
                onStartTour={tour.start}
                onStopTour={tour.stop}
              />
            )}
```

- [ ] **Step 4: Render the overlay, and offer the tour to someone who just said they are new**

The overlay goes last inside the provider, so it paints over everything:

```tsx
        <TourOverlay tour={tour} />
```

And the entry answer starts it:

```tsx
          {!beginner.answered && (
            <FirstVisit
              onAnswer={(isBeginner) => {
                beginner.setBeginner(isBeginner)
                if (isBeginner) tour.start()
              }}
            />
          )}
```

- [ ] **Step 5: Verify the whole thing**

Run: `bun run test && bun run build && bun run lint`
Expected: all three pass

- [ ] **Step 6: Walk it once against a running node**

Start the node with a fresh chain, clear this origin's `localStorage`, open the console and take the tour end to end. Check each of these by hand, because no test covers them:

1. The entry panel appears, and answering "I know my way around" never shows it again.
2. Beginner mode adds the `i` icons and the view notes; switching it off in Help removes both and changes no layout.
3. Every tour step's ring lands on the right control, including after the auto-forge cluster appears and reflows the header.
4. The forge step completes on a real block, not on the click.
5. The payment step completes when the transaction shows as unconfirmed, and the next one when it lands in a block.
6. Ending the tour mid-way leaves a working console.
7. Starting the tour a second time from Help, on the chain you just used, does not skip the send and forge steps — that is what the counts in `Observation` are for, and it is the case a fresh chain never exercises.

- [ ] **Step 7: Commit**

```bash
git add src/components/console/ConsoleShell.tsx
git commit -m "feat: the tour runs on the real chain"
```

---

## Notes for whoever executes this

**The console must keep working with all of it off.** Beginner mode defaults to off and the tour defaults to not running. Every component added here returns `null` or its bare children in that state. If turning beginner mode off ever changes a layout, that is a bug in this plan's execution, not a trade-off.

**Do not add jsdom.** The repo tests pure functions in `src/lib/` and does not render-test. That is why the tour's logic lives in `tour.ts` and the overlay holds only geometry. If a piece of tour behaviour feels untestable, move it into `tour.ts` rather than reaching for a renderer.

**One deliberate deviation from the spec.** The spec ends the account chapter by "funding the new account from the miner". This plan funds it by making it the forger and forging one block. It reaches the same place — an account with a balance, visible on chain — with one fewer concept and no second account to explain first, and it answers a question the spec's version leaves hanging: where the money in a chain comes from in the first place. Update the spec's "Beginner mode and the tour" section to match once this lands.

**Ten locales, every time.** `locales.test.ts` compares flattened key sets and will catch a missed one, but it cannot catch a lazy translation. These strings are the product for the audience this layer is built for.
