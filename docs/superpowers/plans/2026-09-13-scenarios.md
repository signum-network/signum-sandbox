# Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A small language for describing a chain, an editor for it in the console, and four scenarios written in it that populate the sandbox on one click.

**Architecture:** A scenario is text. One parser turns it into steps and reports problems by line; one checker resolves the references between those steps; one runner executes them against a port. The console holds the ledger already, so nothing runs outside the browser. Parser, checker and runner are pure functions in `src/lib/`, tested without a node.

**Tech Stack:** TypeScript, SignumJS 3.3.4, React 19, i18next across ten locales, Vitest (`environment: 'node'`, no jsdom, no render tests).

---

## The language

One step per line. Blank lines and anything after `#` are ignored. A word is a run of non-space characters; a quoted string may contain spaces and runs to the closing `"` — there are no escapes, which is a limit worth having over a syntax nobody can read.

```
miner     <Name>
account   <Name> ["passphrase"]
fund      <Name> <signa>
pay       <From> -> <To> <signa> ["message"]
msg       <From> -> <To> "text"
secret    <From> -> <To> "text"
multi     <From> -> <To> <signa>, <To> <signa>, …
info      <Name> "display name" ["description"]
token     <Issuer> <SYMBOL> <quantity> <decimals> ["description"]
transfer  <From> -> <To> <SYMBOL> <quantity>
alias     <Owner> <name> "content"
subscribe <From> -> <To> <signa> every <seconds>
forge     [count]
```

**Passphrases are derived from the name.** `account Alice` uses `sandbox-alice`, so the same scenario produces the same addresses on every machine and they can be published and written into an application's fixtures. A second argument overrides it for anyone who needs a specific one.

**`->` rather than a comma between the parties**, because a transaction has a direction and the line should show it.

**`decimals` is required on `token`** even though nearly every scenario wants `0`. With it optional, `token P SLICE 10000 "…"` and `token P SLICE 10000 2` would need the parser to guess from the argument's shape, and a language that guesses is a language that guesses wrong in front of a newcomer.

**Quantities are written the way they are read.** `token T ORBIT 10000 2` issues ten thousand ORBIT and `transfer T -> A ORBIT 250.5` moves two hundred and fifty and a half of them. The chain counts in the token's smallest unit — a hundredth here — and the runner converts before it speaks to the node. An earlier draft of this plan had the scenario write smallest units directly, and every worked example in its own prose miscounted them by a factor of a hundred, which is the argument. An amount finer than the token can hold is refused by the checker, on its line, rather than rounded away.

---

## File Structure

**New — pure, tested:**
- `src/lib/scenarioLang.ts` — `tokenize`, `parseScenario`. Text in, steps and per-line problems out. Knows nothing about chains.
- `src/lib/scenarioCheck.ts` — `checkScenario`. Steps in, per-line problems out: references that resolve to nothing, a missing miner, a duplicate name.
- `src/lib/scenarioNames.ts` — the symbol table the runner fills in as it goes.
- `src/lib/scenarioRunner.ts` — `runScenario`, the sequencing, against a `ScenarioOps` port.

**New — adapter and data:**
- `src/lib/scenarioOps.ts` — `ScenarioOps` against the ledger. The one file here that could not be tested without a node.
- `src/scenarios/*.scenario` — four scenarios, as text.
- `src/scenarios/index.ts` — imports them with Vite's `?raw` and exports `{ id, source }`.

**New — UI:**
- `src/hooks/useScenario.ts` — parse, check, run, progress.
- `src/components/console/drawers/ScenarioSection.tsx` — the picker, the editor, the run button, the problems and the progress, inside the Chain drawer.

**Modified:**
- `src/components/console/drawers/ChainDrawer.tsx` — hosts the section.
- `src/i18n/locales/*.ts` — the new strings, ten times.
- `README.md` — the language reference and the addresses the scenarios produce.

**One path, not two.** The built-in scenarios are text loaded into the editor, not a separate "run this preset" route. That is what makes the editor mode a later addition rather than a later rewrite: saving and importing a scenario becomes storage and a file dialog around the same text box, with no second interpretation of the language to keep in step.

**Nothing runs outside the browser.** An earlier draft of this plan shipped a `bun` seed script, which meant a port that could be pointed at a node from a command line and a shim for `window.location.origin`. The console has the ledger; the script bought a populated chain without opening a browser, and that is not worth a second runtime. The port stays, because it is what lets the runner be tested without a node.

---

### Task 1: The tokenizer

**Files:**
- Create: `src/lib/scenarioLang.ts`
- Test: `src/lib/scenarioLang.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenarioLang.test.ts
import { describe, expect, it } from 'vitest'
import { tokenize } from './scenarioLang'

describe('tokenize', () => {
  it('splits a line into words', () => {
    expect(tokenize('fund Alice 1000')).toEqual(['fund', 'Alice', '1000'])
  })

  it('keeps a quoted string together, spaces and all', () => {
    expect(tokenize('msg Bob -> Alice "see you Friday"')).toEqual([
      'msg',
      'Bob',
      '->',
      'Alice',
      '"see you Friday"',
    ])
  })

  it('treats the arrow and the comma as tokens of their own', () => {
    expect(tokenize('multi A -> B 1, C 2')).toEqual(['multi', 'A', '->', 'B', '1', ',', 'C', '2'])
  })

  it('drops a comment and the whitespace around everything', () => {
    expect(tokenize('  forge 2   # two empty blocks ')).toEqual(['forge', '2'])
    expect(tokenize('# nothing but a comment')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })

  // A '#' inside a quoted string is text, not the start of a comment. Getting
  // this wrong would silently truncate any message that mentions one.
  it('does not see a comment inside a string', () => {
    expect(tokenize('msg A -> B "meet at #3"')).toEqual(['msg', 'A', '->', 'B', '"meet at #3"'])
  })

  it('keeps an unterminated string as one token, for the parser to complain about', () => {
    expect(tokenize('msg A -> B "unfinished')).toEqual(['msg', 'A', '->', 'B', '"unfinished'])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioLang`
Expected: FAIL, `Failed to resolve import './scenarioLang'`

- [ ] **Step 3: Write the tokenizer**

```ts
// src/lib/scenarioLang.ts

/**
 * One line of scenario source, split into words, quoted strings and the two
 * punctuation marks the language uses.
 *
 * A quoted token keeps its quotes so the parser can tell `"120"` from `120`
 * without a second type — a message that happens to be a number is still a
 * message. There are no escapes inside a string: a scenario is meant to be
 * read at a glance, and a backslash rule earns its keep only in languages
 * people write far more of than this.
 */
export function tokenize(line: string): string[] {
  const tokens: string[] = []
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === '#') break
    if (char === ' ' || char === '\t') {
      i += 1
      continue
    }
    if (char === ',') {
      tokens.push(',')
      i += 1
      continue
    }
    if (line.startsWith('->', i)) {
      tokens.push('->')
      i += 2
      continue
    }
    if (char === '"') {
      const end = line.indexOf('"', i + 1)
      // Unterminated: take the rest of the line and let the parser say so
      // with a line number, which is more use than throwing from here.
      if (end === -1) {
        tokens.push(line.slice(i))
        break
      }
      tokens.push(line.slice(i, end + 1))
      i = end + 1
      continue
    }

    let end = i
    while (end < line.length && !' \t,#"'.includes(line[end]) && !line.startsWith('->', end)) {
      end += 1
    }
    tokens.push(line.slice(i, end))
    i = end
  }

  return tokens
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenarioLang`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenarioLang.ts src/lib/scenarioLang.test.ts
git commit -m "feat: one line of scenario source, split into its parts"
```

---

### Task 2: The parser

**Files:**
- Modify: `src/lib/scenarioLang.ts`
- Modify: `src/lib/scenarioLang.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/scenarioLang.test.ts`:

```ts
import { parseScenario, type ScenarioStep } from './scenarioLang'

const parse = (source: string) => parseScenario(source)

describe('parseScenario', () => {
  it('reads a whole scenario', () => {
    const { steps, problems } = parse(`
      # a small chain
      miner Miner
      account Alice
      fund Alice 1000
      pay Alice -> Miner 10 "thanks"
      forge 2
    `)
    expect(problems).toEqual([])
    expect(steps).toEqual<ScenarioStep[]>([
      { line: 3, kind: 'miner', name: 'Miner' },
      { line: 4, kind: 'account', name: 'Alice' },
      { line: 5, kind: 'fund', account: 'Alice', signa: '1000' },
      { line: 6, kind: 'pay', from: 'Alice', to: 'Miner', signa: '10', message: 'thanks' },
      { line: 7, kind: 'forge', count: 2 },
    ])
  })

  it('carries the line number, since that is what the editor points at', () => {
    const { problems } = parse('miner Miner\n\nnonsense here')
    expect(problems).toEqual([{ line: 3, message: 'unknown instruction "nonsense"' }])
  })

  it('names the argument that is missing rather than saying the line is wrong', () => {
    expect(parse('fund Alice').problems).toEqual([{ line: 1, message: 'fund needs an amount' }])
    expect(parse('pay Alice -> Bob').problems).toEqual([{ line: 1, message: 'pay needs an amount' }])
  })

  it('insists on the arrow, so a direction is never guessed', () => {
    expect(parse('pay Alice Bob 10').problems).toEqual([
      { line: 1, message: 'pay needs "->" between the two accounts' },
    ])
  })

  it('rejects an unterminated string where it starts', () => {
    expect(parse('msg A -> B "unfinished').problems).toEqual([
      { line: 1, message: 'a quoted text is missing its closing quote' },
    ])
  })

  it('rejects an amount that is not a number', () => {
    expect(parse('fund Alice lots').problems).toEqual([
      { line: 1, message: '"lots" is not an amount' },
    ])
  })

  it('reports every bad line, so one pass fixes the file', () => {
    expect(parse('fund Alice\nwhat\npay A -> B 1').problems).toHaveLength(2)
  })

  it('reads a multi-out with any number of recipients', () => {
    const { steps } = parse('multi Alice -> Bob 250, Carol 250, Dave 60')
    expect(steps[0]).toEqual({
      line: 1,
      kind: 'multi',
      from: 'Alice',
      recipients: [
        { to: 'Bob', signa: '250' },
        { to: 'Carol', signa: '250' },
        { to: 'Dave', signa: '60' },
      ],
    })
  })

  it('reads the two message kinds as one step with a flag', () => {
    expect(parse('msg A -> B "hello"').steps[0]).toMatchObject({ kind: 'msg', encrypted: false })
    expect(parse('secret A -> B "hello"').steps[0]).toMatchObject({ kind: 'msg', encrypted: true })
  })

  it('reads a subscription and its interval', () => {
    expect(parse('subscribe A -> B 12 every 3600').steps[0]).toEqual({
      line: 1,
      kind: 'subscribe',
      from: 'A',
      to: 'B',
      signa: '12',
      frequencyS: 3600,
    })
  })

  it('derives a passphrase from the name, and lets one be given instead', () => {
    expect(parse('account Alice').steps[0]).toEqual({ line: 1, kind: 'account', name: 'Alice' })
    expect(parse('account Alice "my own words"').steps[0]).toEqual({
      line: 1,
      kind: 'account',
      name: 'Alice',
      passphrase: 'my own words',
    })
  })

  it('defaults forge to a single block', () => {
    expect(parse('forge').steps[0]).toEqual({ line: 1, kind: 'forge', count: 1 })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioLang`
Expected: FAIL, `parseScenario is not a function`

- [ ] **Step 3: Write the parser**

Append to `src/lib/scenarioLang.ts`:

```ts
/**
 * A problem the editor can point at. The line is one-based, because that is
 * how an editor counts and this exists to be shown next to one.
 */
export interface Problem {
  line: number
  message: string
}

/**
 * Every instruction the language has, and nothing else.
 *
 * The vocabulary is deliberately the limit: anything not expressible here is
 * not a scenario. Each step carries the line it came from, so a failure
 * halfway through a run can say where in the source it stopped.
 *
 * Accounts and tokens are named, never addressed — a scenario is written
 * before the chain it describes exists.
 */
export type ScenarioStep = { line: number } & (
  | { kind: 'miner'; name: string }
  | { kind: 'account'; name: string; passphrase?: string }
  | { kind: 'fund'; account: string; signa: string }
  | { kind: 'pay'; from: string; to: string; signa: string; message?: string }
  | { kind: 'msg'; from: string; to: string; text: string; encrypted: boolean }
  | { kind: 'multi'; from: string; recipients: { to: string; signa: string }[] }
  | { kind: 'info'; account: string; name: string; description?: string }
  | {
      kind: 'token'
      issuer: string
      token: string
      quantity: string
      decimals: number
      description?: string
    }
  | { kind: 'transfer'; from: string; to: string; token: string; quantity: string }
  | { kind: 'alias'; account: string; aliasName: string; content: string }
  | { kind: 'subscribe'; from: string; to: string; signa: string; frequencyS: number }
  | { kind: 'forge'; count: number }
)

export interface ParseResult {
  steps: ScenarioStep[]
  problems: Problem[]
}

const isQuoted = (token: string | undefined) =>
  token !== undefined && token.startsWith('"') && token.endsWith('"') && token.length >= 2

const unquote = (token: string) => token.slice(1, -1)

const isAmount = (token: string | undefined) =>
  token !== undefined && /^\d+(\.\d+)?$/.test(token)

/**
 * Source in, steps and problems out. Never throws: a scenario is edited in a
 * text box, so half of what this sees will be half-written, and the useful
 * answer is always a list of lines to look at.
 *
 * A line that fails to parse contributes a problem and no step. The caller
 * runs nothing while `problems` is non-empty, so a partial step list is never
 * executed — it exists only so a later line's problems are reported too, in
 * the same pass.
 */
export function parseScenario(source: string): ParseResult {
  const steps: ScenarioStep[] = []
  const problems: Problem[] = []

  source.split('\n').forEach((text, index) => {
    const line = index + 1
    const tokens = tokenize(text)
    if (tokens.length === 0) return

    const fail = (message: string) => {
      problems.push({ line, message })
    }

    // An unterminated string reaches here as a token that opens but does not
    // close. Caught once, before any instruction has to think about it.
    if (tokens.some((t) => t.startsWith('"') && !isQuoted(t))) {
      fail('a quoted text is missing its closing quote')
      return
    }

    const [verb, ...rest] = tokens

    /** `A -> B` at the head of the arguments, which most instructions take. */
    const parties = (): { from: string; to: string; tail: string[] } | null => {
      if (rest[1] !== '->') {
        fail(`${verb} needs "->" between the two accounts`)
        return null
      }
      if (rest[0] === undefined || rest[2] === undefined) {
        fail(`${verb} needs two accounts`)
        return null
      }
      return { from: rest[0], to: rest[2], tail: rest.slice(3) }
    }

    switch (verb) {
      case 'miner':
      case 'account': {
        const name = rest[0]
        if (name === undefined) return fail(`${verb} needs a name`)
        if (verb === 'miner') return void steps.push({ line, kind: 'miner', name })
        const passphrase = isQuoted(rest[1]) ? unquote(rest[1]) : undefined
        return void steps.push({ line, kind: 'account', name, ...(passphrase && { passphrase }) })
      }

      case 'fund': {
        const account = rest[0]
        if (account === undefined) return fail('fund needs a name')
        if (rest[1] === undefined) return fail('fund needs an amount')
        if (!isAmount(rest[1])) return fail(`"${rest[1]}" is not an amount`)
        return void steps.push({ line, kind: 'fund', account, signa: rest[1] })
      }

      case 'pay': {
        const p = parties()
        if (!p) return
        const [signa, message] = p.tail
        if (signa === undefined) return fail('pay needs an amount')
        if (!isAmount(signa)) return fail(`"${signa}" is not an amount`)
        return void steps.push({
          line,
          kind: 'pay',
          from: p.from,
          to: p.to,
          signa,
          ...(isQuoted(message) && { message: unquote(message) }),
        })
      }

      case 'msg':
      case 'secret': {
        const p = parties()
        if (!p) return
        if (!isQuoted(p.tail[0])) return fail(`${verb} needs a quoted text`)
        return void steps.push({
          line,
          kind: 'msg',
          from: p.from,
          to: p.to,
          text: unquote(p.tail[0]),
          encrypted: verb === 'secret',
        })
      }

      case 'multi': {
        const p = parties()
        if (!p) return
        const recipients: { to: string; signa: string }[] = []
        // The arrow already consumed the first recipient's name, so the tail
        // reads amount, then comma-separated name-amount pairs.
        let cursor = [p.to, ...p.tail]
        while (cursor.length > 0) {
          const [to, signa, ...remainder] = cursor
          if (signa === undefined) return fail('multi needs an amount for every recipient')
          if (!isAmount(signa)) return fail(`"${signa}" is not an amount`)
          recipients.push({ to, signa })
          if (remainder.length === 0) break
          if (remainder[0] !== ',') return fail('multi separates recipients with a comma')
          cursor = remainder.slice(1)
          if (cursor.length === 0) return fail('multi has a trailing comma')
        }
        return void steps.push({ line, kind: 'multi', from: p.from, recipients })
      }

      case 'info': {
        const account = rest[0]
        if (account === undefined) return fail('info needs a name')
        if (!isQuoted(rest[1])) return fail('info needs a quoted display name')
        return void steps.push({
          line,
          kind: 'info',
          account,
          name: unquote(rest[1]),
          ...(isQuoted(rest[2]) && { description: unquote(rest[2]) }),
        })
      }

      case 'token': {
        const [issuer, token, quantity, decimals, description] = rest
        if (issuer === undefined || token === undefined) return fail('token needs an issuer and a symbol')
        if (!isAmount(quantity)) return fail('token needs a quantity')
        if (!isAmount(decimals)) return fail('token needs a number of decimals')
        return void steps.push({
          line,
          kind: 'token',
          issuer,
          token,
          quantity,
          decimals: Number(decimals),
          ...(isQuoted(description) && { description: unquote(description) }),
        })
      }

      case 'transfer': {
        const p = parties()
        if (!p) return
        const [token, quantity] = p.tail
        if (token === undefined) return fail('transfer needs a token')
        if (!isAmount(quantity)) return fail('transfer needs a quantity')
        return void steps.push({ line, kind: 'transfer', from: p.from, to: p.to, token, quantity })
      }

      case 'alias': {
        const [account, aliasName, content] = rest
        if (account === undefined || aliasName === undefined) {
          return fail('alias needs an owner and a name')
        }
        if (!isQuoted(content)) return fail('alias needs quoted content')
        return void steps.push({ line, kind: 'alias', account, aliasName, content: unquote(content) })
      }

      case 'subscribe': {
        const p = parties()
        if (!p) return
        const [signa, every, seconds] = p.tail
        if (!isAmount(signa)) return fail('subscribe needs an amount')
        if (every !== 'every' || !isAmount(seconds)) {
          return fail('subscribe needs "every <seconds>"')
        }
        return void steps.push({
          line,
          kind: 'subscribe',
          from: p.from,
          to: p.to,
          signa,
          frequencyS: Number(seconds),
        })
      }

      case 'forge': {
        if (rest[0] !== undefined && !isAmount(rest[0])) return fail(`"${rest[0]}" is not a count`)
        return void steps.push({ line, kind: 'forge', count: Number(rest[0] ?? 1) })
      }

      default:
        return fail(`unknown instruction "${verb}"`)
    }
  })

  return { steps, problems }
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenarioLang`
Expected: PASS, 18 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenarioLang.ts src/lib/scenarioLang.test.ts
git commit -m "feat: a scenario language that says which line is wrong"
```

---

### Task 3: The reference check

**Files:**
- Create: `src/lib/scenarioCheck.ts`
- Test: `src/lib/scenarioCheck.test.ts`

Parsing says a line is well formed. This says the lines agree with each other.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenarioCheck.test.ts
import { describe, expect, it } from 'vitest'
import { parseScenario } from './scenarioLang'
import { checkScenario } from './scenarioCheck'

const check = (source: string) => checkScenario(parseScenario(source).steps)

describe('checkScenario', () => {
  it('passes a scenario whose every reference resolves', () => {
    expect(
      check(`
        miner Miner
        account Alice
        fund Alice 100
        pay Alice -> Miner 10
      `),
    ).toEqual([])
  })

  // Without a miner nothing can be forged, and without forging nothing
  // settles -- so this is not a detail to discover at step one of a run.
  it('insists on a miner', () => {
    expect(check('account Alice')).toEqual([
      { line: 1, message: 'this scenario has no "miner" line, so nothing can forge' },
    ])
  })

  it('names an account no line creates', () => {
    expect(check('miner M\npay Alice -> M 1')).toEqual([
      { line: 2, message: 'unknown account "Alice"' },
    ])
  })

  it('sees an account only after the line that creates it', () => {
    expect(check('miner M\npay Alice -> M 1\naccount Alice')).toEqual([
      { line: 2, message: 'unknown account "Alice"' },
    ])
  })

  it('names a token used before it is issued', () => {
    expect(check('miner M\ntransfer M -> M SLICE 1')).toEqual([
      { line: 2, message: 'unknown token "SLICE"' },
    ])
  })

  it('rejects a name given twice, which would make every later line ambiguous', () => {
    expect(check('miner M\naccount Alice\naccount Alice')).toEqual([
      { line: 3, message: 'account "Alice" is already taken' },
    ])
  })

  it('knows the miner without an account line for it', () => {
    expect(check('miner Miner\nfund Miner 10')).toEqual([])
  })

  it('checks every recipient of a multi-out', () => {
    expect(check('miner M\nmulti M -> M 1, Ghost 2')).toEqual([
      { line: 2, message: 'unknown account "Ghost"' },
    ])
  })

  it('reports every problem, not only the first', () => {
    expect(check('miner M\npay A -> B 1\ntransfer M -> M X 1')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioCheck`
Expected: FAIL, `Failed to resolve import './scenarioCheck'`

- [ ] **Step 3: Write the checker**

```ts
// src/lib/scenarioCheck.ts
import type { Problem, ScenarioStep } from './scenarioLang'

/**
 * Whether the lines agree with each other, once each of them is well formed.
 *
 * Run before a single transaction is sent, because there is no undo: a
 * scenario that fails at line eleven has already written ten lines' worth of
 * transactions onto a chain the console cannot roll back. Every problem is
 * reported rather than the first, so one pass fixes the file.
 */
export function checkScenario(steps: ScenarioStep[]): Problem[] {
  const problems: Problem[] = []
  const accounts = new Set<string>()
  const tokens = new Set<string>()
  let miner: string | null = null

  const account = (line: number, name: string) => {
    if (!accounts.has(name)) problems.push({ line, message: `unknown account "${name}"` })
  }

  const claim = (line: number, name: string) => {
    if (accounts.has(name)) problems.push({ line, message: `account "${name}" is already taken` })
    accounts.add(name)
  }

  for (const step of steps) {
    switch (step.kind) {
      case 'miner':
        if (miner !== null) {
          problems.push({ line: step.line, message: 'this scenario names a miner twice' })
        }
        miner = step.name
        claim(step.line, step.name)
        break
      case 'account':
        claim(step.line, step.name)
        break
      case 'fund':
        account(step.line, step.account)
        break
      case 'pay':
      case 'msg':
      case 'subscribe':
        account(step.line, step.from)
        account(step.line, step.to)
        break
      case 'multi':
        account(step.line, step.from)
        for (const recipient of step.recipients) account(step.line, recipient.to)
        break
      case 'info':
      case 'alias':
        account(step.line, step.account)
        break
      case 'token':
        account(step.line, step.issuer)
        if (tokens.has(step.token)) {
          problems.push({ line: step.line, message: `token "${step.token}" is already issued` })
        }
        tokens.add(step.token)
        break
      case 'transfer':
        account(step.line, step.from)
        account(step.line, step.to)
        if (!tokens.has(step.token)) {
          problems.push({ line: step.line, message: `unknown token "${step.token}"` })
        }
        break
      case 'forge':
        break
    }
  }

  if (miner === null) {
    problems.unshift({
      line: steps[0]?.line ?? 1,
      message: 'this scenario has no "miner" line, so nothing can forge',
    })
  }

  return problems
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenarioCheck`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenarioCheck.ts src/lib/scenarioCheck.test.ts
git commit -m "feat: check that the lines of a scenario agree with each other"
```

---

### Task 4: The symbol table

**Files:**
- Create: `src/lib/scenarioNames.ts`
- Test: `src/lib/scenarioNames.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenarioNames.test.ts
import { describe, expect, it } from 'vitest'
import { Names } from './scenarioNames'

const account = { id: '1', address: 'TS-A', name: 'Alice', passphrase: 'sandbox-alice' }

describe('Names', () => {
  it('gives back the account it was given', () => {
    const names = new Names()
    names.rememberAccount('Alice', account)
    expect(names.account('Alice').id).toBe('1')
  })

  it('remembers a token by the symbol the scenario used', () => {
    const names = new Names()
    names.rememberToken('SLICE', '99')
    expect(names.token('SLICE')).toBe('99')
  })

  // checkScenario rejects a scenario that could reach these, which is why
  // they throw rather than returning undefined: reaching one means the
  // checker and the runner disagree, and that is a bug to surface.
  it('throws on a name it was never told', () => {
    const names = new Names()
    expect(() => names.account('Bob')).toThrow('unknown account "Bob"')
    expect(() => names.token('NONE')).toThrow('unknown token "NONE"')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioNames`
Expected: FAIL, `Failed to resolve import './scenarioNames'`

- [ ] **Step 3: Write it**

```ts
// src/lib/scenarioNames.ts
import type { SandboxAccount } from './accounts'

/**
 * What the scenario called things, and what the chain called them back.
 *
 * A scenario is written before the chain exists, so it can only refer to an
 * account or a token by a name it made up. The runner fills this in as it
 * goes and reads out of it on every later step.
 */
export class Names {
  private readonly accounts = new Map<string, SandboxAccount>()
  private readonly tokens = new Map<string, string>()

  rememberAccount(name: string, account: SandboxAccount) {
    this.accounts.set(name, account)
  }

  rememberToken(symbol: string, assetId: string) {
    this.tokens.set(symbol, assetId)
  }

  account(name: string): SandboxAccount {
    const found = this.accounts.get(name)
    if (!found) throw new Error(`unknown account "${name}"`)
    return found
  }

  token(symbol: string): string {
    const found = this.tokens.get(symbol)
    if (!found) throw new Error(`unknown token "${symbol}"`)
    return found
  }
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenarioNames`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenarioNames.ts src/lib/scenarioNames.test.ts
git commit -m "feat: what the scenario called things, and what the chain called them back"
```

---

### Task 5: The runner

**Files:**
- Create: `src/lib/scenarioRunner.ts`
- Test: `src/lib/scenarioRunner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenarioRunner.test.ts
import { describe, expect, it, vi } from 'vitest'
import { parseScenario } from './scenarioLang'
import { runScenario, type ScenarioOps } from './scenarioRunner'
import type { SandboxAccount } from './accounts'

const asAccount = (name: string): SandboxAccount => ({
  id: `id-${name}`,
  address: `TS-${name.toUpperCase()}`,
  name,
  passphrase: `sandbox-${name.toLowerCase()}`,
})

const fakeOps = (overrides: Partial<ScenarioOps> = {}) => {
  const calls: string[] = []
  const ops: ScenarioOps = {
    createAccount: vi.fn(async (name: string) => {
      calls.push(`account:${name}`)
      return asAccount(name)
    }),
    setMiner: vi.fn(() => {
      calls.push('miner')
    }),
    forge: vi.fn(async () => {
      calls.push('forge')
    }),
    balanceSigna: vi.fn(async () => '100000'),
    pay: vi.fn(async () => {
      calls.push('pay')
    }),
    multi: vi.fn(async () => {
      calls.push('multi')
    }),
    message: vi.fn(async () => {
      calls.push('message')
    }),
    info: vi.fn(async () => {
      calls.push('info')
    }),
    issueToken: vi.fn(async () => {
      calls.push('token')
      return 'asset-1'
    }),
    transferToken: vi.fn(async () => {
      calls.push('transfer')
    }),
    alias: vi.fn(async () => {
      calls.push('alias')
    }),
    subscribe: vi.fn(async () => {
      calls.push('subscribe')
    }),
    ...overrides,
  }
  return { ops, calls }
}

const run = (source: string, ops: ScenarioOps, onProgress?: Parameters<typeof runScenario>[2]) =>
  runScenario(parseScenario(source).steps, ops, onProgress)

describe('runScenario', () => {
  it('runs the steps in order and settles each one', async () => {
    const { ops, calls } = fakeOps()
    await run('miner M\naccount Alice\npay Alice -> M 5', ops)
    expect(calls).toEqual(['account:M', 'miner', 'account:Alice', 'pay', 'forge'])
  })

  // Creating an account writes nothing to the chain, so there is nothing to
  // settle and no block to waste on it.
  it('does not forge for a step that writes nothing', async () => {
    const { ops } = fakeOps()
    await run('miner M\naccount Alice', ops)
    expect(ops.forge).not.toHaveBeenCalled()
  })

  it('reports each step as it starts and finishes', async () => {
    const { ops } = fakeOps()
    const progress = vi.fn()
    await run('miner M\nforge\nforge', ops, progress)
    expect(progress).toHaveBeenCalledWith({ index: 0, total: 3, line: 1, state: 'running' })
    expect(progress).toHaveBeenCalledWith({ index: 2, total: 3, line: 3, state: 'done' })
  })

  // There is no rollback. The one thing that must not happen is carrying on
  // and burying the failure under later steps.
  it('stops at the first failing step and says which line', async () => {
    const { ops, calls } = fakeOps({
      pay: vi.fn(async () => {
        throw new Error('Incorrect "recipient"')
      }),
    })
    const outcome = await run('miner M\npay M -> M 1\nalias M x "y"', ops)
    expect(outcome).toEqual({ kind: 'failed', line: 2, message: 'Incorrect "recipient"' })
    expect(calls).not.toContain('alias')
  })

  it('resolves a token by the symbol the scenario gave it', async () => {
    const { ops } = fakeOps()
    await run('miner M\ntoken M SLICE 100 0\ntransfer M -> M SLICE 5', ops)
    expect(ops.transferToken).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1', quantity: '5' }),
    )
  })

  // The miner earns its funds by forging, so funding is forge-and-check.
  it('forges until the miner can cover a funding step', async () => {
    let balance = 0
    const { ops } = fakeOps({
      balanceSigna: vi.fn(async () => String(balance)),
      forge: vi.fn(async () => {
        balance += 100
      }),
    })
    await run('miner M\nfund M 250', ops)
    expect(ops.forge).toHaveBeenCalledTimes(3)
  })

  it('gives up funding rather than forging forever', async () => {
    const { ops } = fakeOps({ balanceSigna: vi.fn(async () => '0') })
    const outcome = await run('miner M\nfund M 1', ops)
    expect(outcome.kind).toBe('failed')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioRunner`
Expected: FAIL, `Failed to resolve import './scenarioRunner'`

- [ ] **Step 3: Write the runner**

```ts
// src/lib/scenarioRunner.ts
import type { SandboxAccount } from './accounts'
import type { ScenarioStep } from './scenarioLang'
import { Names } from './scenarioNames'

/**
 * Everything the runner needs from a chain, and nothing about how to reach
 * one.
 *
 * The console is the only caller, so this is not about supporting a second
 * runtime — it is what lets the sequencing be tested at all. A fake that
 * records calls answers every question this file's tests ask, with no node,
 * no HTTP and no clock.
 */
export interface ScenarioOps {
  /** Derives the account, stores it wherever the caller keeps accounts, returns it. */
  createAccount(name: string, passphrase: string): Promise<SandboxAccount>
  /** Designates the account that forges and pays for funding. */
  setMiner(account: SandboxAccount): void
  forge(): Promise<void>
  balanceSigna(accountId: string): Promise<string>
  pay(args: {
    from: SandboxAccount
    to: SandboxAccount
    signa: string
    message?: string
  }): Promise<void>
  multi(args: {
    from: SandboxAccount
    recipients: { to: SandboxAccount; signa: string }[]
  }): Promise<void>
  message(args: {
    from: SandboxAccount
    to: SandboxAccount
    text: string
    encrypted: boolean
  }): Promise<void>
  info(args: { account: SandboxAccount; name: string; description?: string }): Promise<void>
  /** Returns the new asset id. */
  issueToken(args: {
    issuer: SandboxAccount
    symbol: string
    quantity: string
    decimals: number
    description?: string
  }): Promise<string>
  transferToken(args: {
    from: SandboxAccount
    to: SandboxAccount
    assetId: string
    quantity: string
  }): Promise<void>
  alias(args: { account: SandboxAccount; aliasName: string; content: string }): Promise<void>
  subscribe(args: {
    from: SandboxAccount
    to: SandboxAccount
    signa: string
    frequencyS: number
  }): Promise<void>
}

export interface Progress {
  index: number
  total: number
  line: number
  state: 'running' | 'done'
}

export type Outcome = { kind: 'completed' } | { kind: 'failed'; line: number; message: string }

/**
 * How many blocks the runner will forge chasing one `fund` line before it
 * decides the amount is not reachable. Finite so a mistyped amount fails in
 * a minute rather than spinning until someone closes the tab.
 */
const MAX_FUNDING_BLOCKS = 200

/** The passphrase an account gets when the scenario does not name one. */
export const derivedPassphrase = (name: string) => `sandbox-${name.toLowerCase()}`

/**
 * Executes steps that have already been parsed and checked.
 *
 * It does not parse and does not check: by the time anything reaches here the
 * caller has established that the lines are well formed and agree with each
 * other, because the first transaction cannot be taken back.
 */
export async function runScenario(
  steps: ScenarioStep[],
  ops: ScenarioOps,
  onProgress?: (progress: Progress) => void,
): Promise<Outcome> {
  const names = new Names()
  const total = steps.length
  let miner: SandboxAccount | null = null

  for (const [index, step] of steps.entries()) {
    onProgress?.({ index, total, line: step.line, state: 'running' })
    try {
      miner = (await perform(step, ops, names, miner)) ?? miner
    } catch (error) {
      return {
        kind: 'failed',
        line: step.line,
        message: error instanceof Error ? error.message : String(error),
      }
    }
    onProgress?.({ index, total, line: step.line, state: 'done' })
  }

  return { kind: 'completed' }
}

/**
 * One step, and the block that settles it.
 *
 * Every step that writes is followed by a forge, because the next step may
 * refer to what this one made and an unconfirmed transaction has made nothing
 * yet. It also gives the finished chain a block per step, which is what makes
 * the block list worth opening.
 *
 * Returns the miner when it has just been designated, so the caller can hold
 * on to it without this reaching back up.
 */
async function perform(
  step: ScenarioStep,
  ops: ScenarioOps,
  names: Names,
  miner: SandboxAccount | null,
): Promise<SandboxAccount | undefined> {
  switch (step.kind) {
    case 'miner': {
      const account = await ops.createAccount(step.name, derivedPassphrase(step.name))
      names.rememberAccount(step.name, account)
      ops.setMiner(account)
      return account
    }

    case 'account':
      names.rememberAccount(
        step.name,
        await ops.createAccount(step.name, step.passphrase ?? derivedPassphrase(step.name)),
      )
      return

    case 'forge':
      for (let i = 0; i < step.count; i += 1) await ops.forge()
      return

    case 'fund': {
      if (!miner) throw new Error('no miner')
      const target = names.account(step.account)
      await forgeUntilAffordable(ops, miner, step.signa)
      if (target.id !== miner.id) {
        await ops.pay({ from: miner, to: target, signa: step.signa })
        await ops.forge()
      }
      return
    }

    case 'pay':
      await ops.pay({
        from: names.account(step.from),
        to: names.account(step.to),
        signa: step.signa,
        message: step.message,
      })
      break

    case 'multi':
      await ops.multi({
        from: names.account(step.from),
        recipients: step.recipients.map((r) => ({ to: names.account(r.to), signa: r.signa })),
      })
      break

    case 'msg':
      await ops.message({
        from: names.account(step.from),
        to: names.account(step.to),
        text: step.text,
        encrypted: step.encrypted,
      })
      break

    case 'info':
      await ops.info({
        account: names.account(step.account),
        name: step.name,
        description: step.description,
      })
      break

    case 'token':
      names.rememberToken(
        step.token,
        await ops.issueToken({
          issuer: names.account(step.issuer),
          symbol: step.token,
          quantity: step.quantity,
          decimals: step.decimals,
          description: step.description,
        }),
      )
      break

    case 'transfer':
      await ops.transferToken({
        from: names.account(step.from),
        to: names.account(step.to),
        assetId: names.token(step.token),
        quantity: step.quantity,
      })
      break

    case 'alias':
      await ops.alias({
        account: names.account(step.account),
        aliasName: step.aliasName,
        content: step.content,
      })
      break

    case 'subscribe':
      await ops.subscribe({
        from: names.account(step.from),
        to: names.account(step.to),
        signa: step.signa,
        frequencyS: step.frequencyS,
      })
      break
  }

  await ops.forge()
  return
}

/**
 * The miner mints its own funds by forging, so funding is forge-and-check
 * rather than a transfer from somewhere.
 *
 * The cap matters: a scenario asking for more SIGNA than a sandbox can produce
 * would otherwise forge forever, and what the user needs to see is "this
 * amount is not reachable", not a spinner.
 */
async function forgeUntilAffordable(
  ops: ScenarioOps,
  miner: SandboxAccount,
  signa: string,
): Promise<void> {
  const wanted = Number(signa)
  for (let blocks = 0; blocks < MAX_FUNDING_BLOCKS; blocks += 1) {
    if (Number(await ops.balanceSigna(miner.id)) >= wanted) return
    await ops.forge()
  }
  throw new Error(
    `the miner could not reach ${signa} SIGNA in ${MAX_FUNDING_BLOCKS} blocks — too large for a sandbox?`,
  )
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenarioRunner`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenarioRunner.ts src/lib/scenarioRunner.test.ts
git commit -m "feat: run a scenario, one block per step that writes"
```

---

### Task 6: The four scenarios

**Files:**
- Create: `src/scenarios/first-steps.scenario`
- Create: `src/scenarios/full-house.scenario`
- Create: `src/scenarios/token-launch.scenario`
- Create: `src/scenarios/busy-chain.scenario`
- Create: `src/scenarios/index.ts`
- Test: `src/scenarios/scenarios.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/scenarios/scenarios.test.ts
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { SCENARIOS } from './index'
import { parseScenario } from '@/lib/scenarioLang'
import { checkScenario } from '@/lib/scenarioCheck'

describe('the scenarios that ship', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s parses and checks clean', (_id, s) => {
    const { steps, problems } = parseScenario(s.source)
    expect(problems).toEqual([])
    expect(checkScenario(steps)).toEqual([])
  })

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s is named in English', (id) => {
    const copy = (
      en as unknown as {
        console: { scenario: Record<string, { title?: string; description?: string }> }
      }
    ).console.scenario
    expect(copy[id]?.title, `${id}.title`).toBeTruthy()
    expect(copy[id]?.description, `${id}.description`).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarios`
Expected: FAIL, `Failed to resolve import './index'`

- [ ] **Step 3: Write `first-steps.scenario`**

```
# First steps — enough to see what a block is.

miner   Miner
account Alice
account Bob

fund Alice 1000
fund Bob    500

pay Alice -> Bob   120
pay Bob   -> Alice 35
pay Alice -> Bob   10 "Thanks for lunch"
msg Bob   -> Alice "Any time. Same again Friday?"

forge 2
```

- [ ] **Step 4: Write `full-house.scenario`**

```
# Full house — a chain that looks lived-in. Every view has something to show.

miner   Miner
account Alice
account Bob
account Carol
account Pizzeria

fund Alice    5000
fund Bob      2000
fund Carol    2000
fund Pizzeria 3000

info Alice    "Alice"            "Builds things on Signum"
info Bob      "Bob"              "Reads the docs"
info Carol    "Carol"            "Runs the numbers"
info Pizzeria "Pizzeria Vesuvio" "Wood-fired since 1998"

token    Pizzeria SLICE 10000 0 "One SLICE, one slice. Redeemable at the counter."
transfer Pizzeria -> Alice SLICE 40
transfer Pizzeria -> Bob   SLICE 15
transfer Pizzeria -> Carol SLICE 8

alias Pizzeria vesuvio "https://example.invalid/vesuvio"
alias Alice    alice   "Alice on Signum"

multi Alice -> Bob 250, Carol 250, Pizzeria 60

secret Alice -> Bob   "The keys are under the mat. Do not tell Carol."
msg    Carol -> Alice "I can read the block list, you know."
pay    Bob   -> Pizzeria 24 "Two margheritas, no anchovies"

subscribe Alice -> Pizzeria 12 every 3600

forge 3
```

- [ ] **Step 5: Write `token-launch.scenario`**

For someone building against tokens: one issuance and a distribution wide enough that holdings, transfers and balances all have something in them.

```
# Token launch — one asset, spread across five holders.

miner   Miner
account Treasury
account Ana
account Ben
account Cleo
account Dev

fund Treasury 4000
fund Ana 200
fund Ben 200
fund Cleo 200
fund Dev 200

info  Treasury "Orbit Labs" "Issuer of ORBIT"
token Treasury ORBIT 1000000 2 "Governance token for the Orbit network"

transfer Treasury -> Ana  ORBIT 25000
transfer Treasury -> Ben  ORBIT 12500
transfer Treasury -> Cleo ORBIT 6000
transfer Treasury -> Dev  ORBIT 1500

transfer Ana -> Ben  ORBIT 500
transfer Ben -> Cleo ORBIT 250

alias Treasury orbit "Orbit Labs — ORBIT token"

forge 2
```

- [ ] **Step 6: Write `busy-chain.scenario`**

For testing against volume: enough transactions and blocks that the lists paginate and the search has something to narrow.

```
# Busy chain — volume, for testing lists, paging and search.

miner   Miner
account Ada
account Bo
account Cy

fund Ada 3000
fund Bo  3000
fund Cy  3000

pay Ada -> Bo 11
pay Bo  -> Cy 12
pay Cy  -> Ada 13
pay Ada -> Cy 14
pay Bo  -> Ada 15
pay Cy  -> Bo 16
pay Ada -> Bo 17 "again"
pay Bo  -> Cy 18 "and again"
pay Cy  -> Ada 19
pay Ada -> Bo 20
pay Bo  -> Cy 21
pay Cy  -> Ada 22

multi Ada -> Bo 5, Cy 5
multi Bo  -> Ada 5, Cy 5
multi Cy  -> Ada 5, Bo 5

forge 40
```

- [ ] **Step 7: Write the index**

```ts
// src/scenarios/index.ts
import firstSteps from './first-steps.scenario?raw'
import fullHouse from './full-house.scenario?raw'
import tokenLaunch from './token-launch.scenario?raw'
import busyChain from './busy-chain.scenario?raw'

export interface BuiltInScenario {
  /** Also the translation key: `console.scenario.<id>.title` and `.description`. */
  id: string
  source: string
}

/**
 * The scenarios that ship, shortest first: someone who has never seen a block
 * should not be handed twenty transactions to make sense of.
 *
 * They are source text, not parsed data, because loading one means putting it
 * in the editor. There is exactly one way to run a scenario in this console —
 * parse what is in the text box — and that is what makes an editor mode with
 * saving and importing a later addition rather than a later rewrite.
 */
export const SCENARIOS: BuiltInScenario[] = [
  { id: 'firstSteps', source: firstSteps },
  { id: 'tokenLaunch', source: tokenLaunch },
  { id: 'fullHouse', source: fullHouse },
  { id: 'busyChain', source: busyChain },
]
```

Vite serves `?raw` imports without configuration, but TypeScript needs to be told. Add to `src/vite-env.d.ts`:

```ts
declare module '*.scenario?raw' {
  const content: string
  export default content
}
```

- [ ] **Step 8: Run the test**

Run: `bun run test -- scenarios`
Expected: the parse-and-check cases PASS; the naming case FAILS until Task 8 adds the strings.

- [ ] **Step 9: Commit**

```bash
git add src/scenarios src/vite-env.d.ts
git commit -m "feat: four scenarios, written in the language"
```

---

### Task 7: The operations, against a real node

**Files:**
- Create: `src/lib/scenarioOps.ts`

No test: every decision this could get wrong lives in the runner, which is tested. What it must get right is the mapping onto `send.ts`, and the way to get that right is to read `send.ts` rather than trust this plan.

**`forge()` is the one operation with a contract the type cannot express.** It must not return until the chain has actually grown — see the doc comment on `ScenarioOps.forge` in `src/lib/scenarioRunner.ts`. The runner's fake satisfies the signature trivially, so nothing in the test suite will catch an implementation that only submits; the failure appears as a transfer rejected for an unknown asset, reported against a line that is not at fault.

- [ ] **Step 1: Read the real signatures**

Open `src/lib/send.ts` and note the exact argument names of `sendPayment`, `sendMultiOut`, `sendPlainMessage`, `sendEncryptedMessage`, `setAccountInfo`, `issueToken`, `transferToken`, `setAlias`, `createSubscription`, and what `issueToken` returns — the asset id is the issuance transaction's id, and the field it arrives in decides one line below. Also `feeFor` in `src/lib/fees.ts` and `forge` in `src/lib/chainAdmin.ts`.

- [ ] **Step 2: Write the adapter**

```ts
// src/lib/scenarioOps.ts
import { Amount } from '@signumjs/util'
import { deriveAccount, type SandboxAccount } from './accounts'
import { ledger } from './ledger'
import { feeFor } from './fees'
import { forge as forgeBlock } from './chainAdmin'
import {
  createSubscription,
  issueToken,
  resolveRecipientPublicKey,
  sendEncryptedMessage,
  sendMultiOut,
  sendPayment,
  sendPlainMessage,
  setAccountInfo,
  setAlias,
  transferToken,
} from './send'
import type { ScenarioOps } from './scenarioRunner'

/**
 * `ScenarioOps` against the node the console is already talking to.
 *
 * `onAccount` is where a derived account goes — into the account store the
 * Accounts tab reads, so a loaded scenario leaves you holding its passphrases
 * rather than looking at a chain full of strangers. Deriving is deterministic
 * and `addAccount` replaces by id, so running the same scenario twice yields
 * the same accounts rather than duplicates.
 */
/** How long to wait between asking the node whether the block arrived. */
const FORGE_POLL_MS = 250
/** Give up after this many, so a node that stops forging fails rather than hangs. */
const FORGE_ATTEMPTS = 40

export function createScenarioOps({
  addressPrefix,
  onAccount,
}: {
  addressPrefix: string
  onAccount: (account: SandboxAccount) => void
}): ScenarioOps {
  let minerPassphrase = ''

  return {
    async createAccount(name, passphrase) {
      const account = deriveAccount(name, passphrase, addressPrefix)
      onAccount(account)
      return account
    },

    setMiner(account) {
      minerPassphrase = account.passphrase
    },

    async forge() {
      // Submitting is not forging. `submitNonce` answers success for the
      // request, not for a block — two calls close together compete for the
      // same height and the node answers both while producing one. The runner
      // forges back to back with no delay, so without this wait a transaction
      // would be broadcast before its predecessor settled, and `token` then
      // `transfer` would fail with "Unknown asset" on the transfer line, which
      // is not the guilty one.
      const before = (await ledger.block.getBlockchainStatus()).numberOfBlocks
      await forgeBlock(minerPassphrase)
      for (let attempt = 0; attempt < FORGE_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, FORGE_POLL_MS))
        if ((await ledger.block.getBlockchainStatus()).numberOfBlocks > before) return
      }
      throw new Error('the node accepted the request but produced no block')
    },

    async balanceSigna(accountId) {
      try {
        const account = await ledger.account.getAccount({ accountId })
        return Amount.fromPlanck(account.balanceNQT ?? '0').getSigna()
      } catch {
        // An account the chain has never seen has no balance rather than an
        // error worth propagating — the ordinary state of a freshly derived
        // account, and the caller's next move is to forge anyway.
        return '0'
      }
    },

    async pay({ from, to, signa, message }) {
      await sendPayment({
        from,
        to: to.address,
        signa,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
        message,
        fee: feeFor('payment'),
      })
    },

    async multi({ from, recipients }) {
      await sendMultiOut({
        from,
        recipients: recipients.map((r) => ({ address: r.to.address, signa: r.signa })),
        fee: feeFor('multiOut'),
      })
    },

    async message({ from, to, text, encrypted }) {
      const recipientPublicKey = await resolveRecipientPublicKey(to.address, [from, to])
      const args = { from, to: to.address, message: text, recipientPublicKey, fee: feeFor('message') }
      if (encrypted) await sendEncryptedMessage(args)
      else await sendPlainMessage(args)
    },

    async info({ account, name, description }) {
      await setAccountInfo({ account, name, description, fee: feeFor('accountInfo') })
    },

    async issueToken({ issuer, symbol, quantity, decimals, description }) {
      const { transaction } = await issueToken({
        issuer,
        name: symbol,
        quantity,
        decimals,
        description,
        fee: feeFor('issueAsset'),
      })
      // The asset id is the issuance transaction's id, and it is not usable
      // until that transaction is in a block — which is why the runner forges
      // after every step that writes.
      return transaction
    },

    async transferToken({ from, to, assetId, quantity }) {
      await transferToken({
        from,
        to: to.address,
        assetId,
        quantity,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
        fee: feeFor('transferAsset'),
      })
    },

    async alias({ account, aliasName, content }) {
      await setAlias({ account, aliasName, content, fee: feeFor('alias') })
    },

    async subscribe({ from, to, signa, frequencyS }) {
      await createSubscription({
        from,
        to: to.address,
        signa,
        frequencyS,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
        fee: feeFor('subscription'),
      })
    },
  }
}
```

- [ ] **Step 3: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/scenarioOps.ts
git commit -m "feat: the scenario operations, against the node the console already has"
```

---

### Task 8: The strings

**Files:**
- Modify: `src/i18n/locales/*.ts` (all ten)

- [ ] **Step 1: Add the English block**

Inside `console`:

```ts
    scenario: {
      section: 'Scenarios',
      note: 'A scenario describes a chain in a line or two per transaction. Load one, change it if you like, and run it — it adds to the chain you already have.',
      load: 'Load',
      run: 'Run',
      running: 'Line {{line}} — step {{index}} of {{total}}',
      completed: 'Done — {{count}} steps',
      failed: 'Stopped at line {{line}}: {{message}}',
      problems: '{{count}} problems',
      empty: 'Load one above, or write your own.',
      firstSteps: {
        title: 'First steps',
        description: 'Three accounts, a few payments and a message. Enough to see what a block is.',
      },
      tokenLaunch: {
        title: 'Token launch',
        description: 'One asset issued and spread across five holders, with balances worth looking at.',
      },
      fullHouse: {
        title: 'Full house',
        description:
          'Profiles, a token, aliases, an encrypted message, a payroll and a standing order. Every view has something to show.',
      },
      busyChain: {
        title: 'Busy chain',
        description: 'Volume, for testing what lists, paging and search do when there is a lot.',
      },
    },
```

- [ ] **Step 2: Add the German block**

```ts
    scenario: {
      section: 'Szenarien',
      note: 'Ein Szenario beschreibt eine Chain, eine Zeile oder zwei je Transaktion. Lade eins, ändere es nach Belieben und führ es aus — es kommt zur bestehenden Chain hinzu.',
      load: 'Laden',
      run: 'Ausführen',
      running: 'Zeile {{line}} — Schritt {{index}} von {{total}}',
      completed: 'Fertig — {{count}} Schritte',
      failed: 'Bei Zeile {{line}} gestoppt: {{message}}',
      problems: '{{count}} Probleme',
      empty: 'Lade oben eins, oder schreib dein eigenes.',
      firstSteps: {
        title: 'Erste Schritte',
        description:
          'Drei Konten, ein paar Zahlungen und eine Nachricht. Genug, um zu sehen, was ein Block ist.',
      },
      tokenLaunch: {
        title: 'Token-Start',
        description:
          'Ein Token ausgegeben und auf fünf Halter verteilt, mit Beständen, die sich anzusehen lohnen.',
      },
      fullHouse: {
        title: 'Volles Haus',
        description:
          'Profile, ein Token, Aliasse, eine verschlüsselte Nachricht, eine Sammelzahlung und ein Dauerauftrag. Jede Ansicht hat etwas zu zeigen.',
      },
      busyChain: {
        title: 'Volle Chain',
        description:
          'Menge — um zu sehen, was Listen, Blättern und Suche tun, wenn viel da ist.',
      },
    },
```

- [ ] **Step 3: Translate the same key set into the remaining eight**

`es`, `pt`, `uk`, `ru`, `zh`, `ja`, `ko`, `hi`. Every domain word must be the one that locale file already uses — check the existing `console.*` and `glossary.*` keys first. `locales.test.ts` compares flattened key sets against English and fails on any difference.

- [ ] **Step 4: Run the tests**

Run: `bun run test`
Expected: PASS, including the naming case from Task 6

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "feat: name the four scenarios, in ten languages"
```

---

### Task 9: The editor

**Files:**
- Create: `src/hooks/useScenario.ts`
- Create: `src/components/console/drawers/ScenarioSection.tsx`
- Modify: `src/components/console/drawers/ChainDrawer.tsx`
- Modify: `src/components/console/ConsoleShell.tsx`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useScenario.ts
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parseScenario } from '@/lib/scenarioLang'
import { checkScenario } from '@/lib/scenarioCheck'
import { createScenarioOps } from '@/lib/scenarioOps'
import { runScenario, type Outcome, type Progress } from '@/lib/scenarioRunner'
import type { AccountStore } from '@/hooks/useAccounts'

/**
 * The scenario in the editor: what it says, what is wrong with it, and how
 * far a run of it has got.
 *
 * Parsing and checking happen on every keystroke rather than on a button,
 * because a language nobody has written before needs to answer "is this
 * right?" while it is being typed, not after.
 */
export function useScenario(accounts: AccountStore) {
  const client = useQueryClient()
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const { steps, problems } = useMemo(() => {
    const parsed = parseScenario(source)
    // Reference problems are only meaningful once the lines they refer to
    // parsed, so a file with syntax errors reports those alone rather than
    // burying them under complaints about names it could not read.
    if (parsed.problems.length > 0) return parsed
    return { steps: parsed.steps, problems: checkScenario(parsed.steps) }
  }, [source])

  const run = useCallback(async () => {
    setBusy(true)
    setOutcome(null)
    setProgress(null)
    const ops = createScenarioOps({
      addressPrefix: accounts.addressPrefix,
      onAccount: (account) => accounts.importPassphrase(account.name, account.passphrase),
    })
    setOutcome(await runScenario(steps, ops, setProgress))
    setBusy(false)
    // Height, accounts and the feed are all out of date now.
    void client.invalidateQueries()
  }, [accounts, client, steps])

  return {
    source,
    setSource,
    steps,
    problems,
    busy,
    progress,
    outcome,
    runnable: steps.length > 0 && problems.length === 0 && !busy,
    run,
  }
}
```

- [ ] **Step 2: Write the section**

```tsx
// src/components/console/drawers/ScenarioSection.tsx
import { useTranslation } from 'react-i18next'
import { SCENARIOS } from '@/scenarios'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { useScenario } from '@/hooks/useScenario'
import type { AccountStore } from '@/hooks/useAccounts'

/**
 * The scenario editor: pick one, read it, change it, run it.
 *
 * The built-in scenarios load into the same text box anything else would be
 * typed into — there is no second path that runs a preset directly. That is
 * what makes saving and importing a later addition rather than a later
 * rewrite, and it is also the honest arrangement: what runs is what you can
 * see.
 */
export function ScenarioSection({ accounts }: { accounts: AccountStore }) {
  const { t } = useTranslation()
  const scenario = useScenario(accounts)

  if (!accounts.available) return null

  return (
    <div className="border-t pt-3" style={{ borderColor: 'var(--border2)' }}>
      <p className="text-[12px] uppercase tracking-[1px] text-[var(--blue3)]">
        {t('console.scenario.section')}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
        {t('console.scenario.note')}
      </p>

      <div className="mt-2 flex flex-col gap-1">
        {SCENARIOS.map(({ id, source }) => (
          <div key={id} className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-[var(--fg)]">
              {t(`console.scenario.${id}.title`)}
            </span>
            <RowButton
              className="shrink-0 text-[12px] text-[var(--blue3)] underline"
              onClick={() => scenario.setSource(source)}
            >
              {t('console.scenario.load')}
            </RowButton>
          </div>
        ))}
      </div>

      <textarea
        className="themed-scroll console-scroll mt-2 h-56 w-full resize-y border bg-transparent p-2 font-mono text-[12px] leading-relaxed text-[var(--fg)] outline-none"
        style={{ borderColor: 'var(--border2)' }}
        spellCheck={false}
        value={scenario.source}
        placeholder={t('console.scenario.empty')}
        onChange={(event) => scenario.setSource(event.target.value)}
      />

      {/*
        Every problem, each against its line, because the editor is where they
        get fixed and "something is wrong" is not a fix.
      */}
      {scenario.problems.length > 0 && (
        <ul className="mt-1">
          {scenario.problems.map((problem) => (
            <li
              key={`${problem.line}-${problem.message}`}
              className="text-[12px]"
              style={{ color: 'var(--mag)' }}
            >
              {problem.line}: {problem.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center gap-2">
        <ConsoleButton disabled={!scenario.runnable} onClick={() => void scenario.run()}>
          {t('console.scenario.run')}
        </ConsoleButton>

        {scenario.busy && scenario.progress && (
          <span className="text-[12px] text-[var(--blue3)]">
            {t('console.scenario.running', {
              line: scenario.progress.line,
              index: scenario.progress.index + 1,
              total: scenario.progress.total,
            })}
          </span>
        )}
        {scenario.outcome?.kind === 'completed' && (
          <span className="text-[12px] text-[var(--blue3)]">
            {t('console.scenario.completed', { count: scenario.progress?.total ?? 0 })}
          </span>
        )}
        {scenario.outcome?.kind === 'failed' && (
          <span className="text-[12px]" style={{ color: 'var(--mag)' }}>
            {t('console.scenario.failed', {
              line: scenario.outcome.line,
              message: scenario.outcome.message,
            })}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Host it in the Chain drawer**

Winding back, emptying and populating are the three things that shape a chain, so they belong together. `ChainDrawer` gains the account store, because a scenario needs somewhere to put the accounts it creates:

```tsx
export function ChainDrawer({
  height,
  accounts,
}: {
  height: number | null
  accounts: AccountStore
}) {
```

Render `<ScenarioSection accounts={accounts} />` after the existing "An empty chain" block, and pass `accounts={accounts}` from `ConsoleShell.tsx`, where `<ChainDrawer height={state.height} />` is rendered today.

- [ ] **Step 4: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 5: Walk it once against a running node**

Start the node, open the console, open the Chain drawer, and check by hand — no test covers any of this:

1. Loading a scenario fills the editor with its text.
2. Deleting a character mid-word shows a problem against the right line, and fixing it clears the problem.
3. Running "First steps" produces the accounts in the Accounts tab and the transactions in the stream, with the line counter moving.
4. Running it a second time adds transactions rather than failing — the accounts derive to the same addresses.
5. A scenario with a problem cannot be run: the button is disabled.
6. "Busy chain" fills the lists far enough to page through.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useScenario.ts src/components/console
git commit -m "feat: write a scenario, or load one, and watch it land"
```

---

### Task 10: The language, written down

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the reference**

A section documenting every instruction — the same table as the top of this plan — plus the derived-passphrase rule and the addresses the shipped scenarios produce. Get the addresses by running "Full house" and copying them out of the Accounts tab, rather than deriving them by hand.

State plainly that these passphrases are public, worthless, and must never be used anywhere but here.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: the scenario language, and the addresses it always produces"
```

---

## Notes for whoever executes this

**There is no undo.** The console cannot empty a chain, so a scenario that fails halfway leaves what it already wrote. That is why parsing and checking both happen before the run and why the runner stops at the first failure. Do not add a "continue anyway" path.

**One way to run a scenario.** What executes is what is in the text box. If you find yourself adding a code path that runs a built-in scenario without loading it into the editor, stop — that is the second interpretation of the language that the editor mode was designed to avoid.

**"Stopped at line N" is the honest phrasing, not "line N failed".** A step whose transaction was broadcast and whose settling block then failed is reported against that line, but the chain accepted it. There is no undo, so the wording is the only place this can be told truthfully.

**A scenario is reproducible in its addresses, not in its chain.** Accounts derive from fixed passphrases, so the same text always names the same accounts — that is what makes them publishable as fixtures. Heights and balances depend on what was already there, because scenarios load cumulatively and nothing resets first.

**Errors carry lines, all the way through.** The parser, the checker and the runner all report a line number, because all three are read by someone looking at a text box. A message without one is a bug.

**Do not add jsdom, and do not run prettier.** The repo tests pure functions only, and has no prettier config — its defaults will rewrite whole files.
