# Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chain that arrives already lived-in — two preset scenarios that populate the sandbox with accounts, tokens, aliases, messages and a standing order, runnable from the console with visible progress or from the terminal before anyone opens a browser.

**Architecture:** A scenario is data: a list of steps in a small vocabulary. One runner executes that list and is the only thing that knows the order of operations; it reaches the chain through an injected port, so the same runner drives the browser and a `bun` script. Everything that decides — validating a scenario, resolving a name to something created earlier, deciding whether the miner can afford a payment — is a pure function in `src/lib/`, tested without a node.

**Tech Stack:** TypeScript, SignumJS 3.3.4, React 19, i18next across ten locales, Vitest (`environment: 'node'`, no jsdom, no render tests), Bun.

**This is layer two, part two.** The newcomer layer (beginner mode, glossary, tour) is delivered. The DID resolver follows this, with its own plan.

---

## File Structure

**New — pure, tested:**
- `src/lib/scenario.ts` — the step vocabulary as a discriminated union, `Scenario`, and `validateScenario`. The vocabulary is the contract between a data file and the runner, so it lives alone.
- `src/lib/scenarioRunner.ts` — `runScenario`, the sequencing. Depends on a `ScenarioOps` port and nothing else, which is what makes it testable and what lets a terminal script reuse it.
- `src/lib/scenarioNames.ts` — the symbol table. A scenario refers to accounts and tokens by the names it gave them, and something has to turn those back into ids.

**New — adapters and data:**
- `src/lib/scenarioOps.ts` — `ScenarioOps` against a live node. The one place that touches `send.ts` and the ledger client, and therefore the only file in this feature that could not be tested without one.
- `src/scenarios/first-steps.json`, `src/scenarios/full-house.json` — the two that ship.
- `src/scenarios/index.ts` — imports both, types them as `Scenario`, exports the list.

**New — UI:**
- `src/hooks/useScenario.ts` — run state and per-step progress.
- `src/components/console/drawers/ScenarioSection.tsx` — the picker, the run button and the progress list, inside the Chain drawer.

**New — terminal:**
- `scripts/seed.ts` — argument parsing and the same runner.
- `scripts/seed.sh`, `scripts/seed.cmd` — the wrappers, matching the existing `start` pair.

**Modified:**
- `src/lib/ledger.ts` — one guard so the module can be imported outside a browser.
- `src/components/console/drawers/ChainDrawer.tsx` — hosts the new section.
- `src/i18n/locales/*.ts` — the new strings, ten times.
- `scripts/package.sh` — ship the seed scripts.
- `README.md` — the published passphrases and the addresses they produce.

**Why the port.** `src/lib/ledger.ts` builds its clients from `window.location.origin`, which is right for a page the node serves and impossible in a `bun` script. Rather than thread a client argument through the thirteen functions in `send.ts`, the runner never sees a client at all: it calls `ScenarioOps`, and each caller supplies an implementation. That also makes the runner's own tests trivial — a fake `ScenarioOps` that records calls, no node, no mocking of HTTP.

---

### Task 1: The step vocabulary

**Files:**
- Create: `src/lib/scenario.ts`
- Test: `src/lib/scenario.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenario.test.ts
import { describe, expect, it } from 'vitest'
import { validateScenario, type Scenario } from './scenario'

const good: Scenario = {
  id: 'test',
  miner: { name: 'Miner', passphrase: 'sandbox-miner' },
  steps: [
    { kind: 'createAccount', name: 'Alice', passphrase: 'sandbox-alice' },
    { kind: 'fund', account: 'Alice', signa: '1000' },
    { kind: 'payment', from: 'Alice', to: 'Miner', signa: '10' },
  ],
}

describe('validateScenario', () => {
  it('accepts a scenario whose every reference resolves', () => {
    expect(validateScenario(good)).toEqual([])
  })

  // The whole point of validating up front: a scenario that fails at step
  // eleven has already written ten steps' worth of transactions to a chain
  // that cannot be rolled back from here.
  it('rejects a reference to an account no step creates', () => {
    const broken: Scenario = {
      ...good,
      steps: [...good.steps, { kind: 'payment', from: 'Alice', to: 'Bob', signa: '1' }],
    }
    expect(validateScenario(broken)).toEqual(['payment: unknown account "Bob"'])
  })

  it('rejects a token referenced before it is issued', () => {
    const broken: Scenario = {
      ...good,
      steps: [
        ...good.steps,
        { kind: 'transferToken', from: 'Alice', to: 'Miner', token: 'PIZZA', quantity: '1' },
      ],
    }
    expect(validateScenario(broken)).toEqual(['transferToken: unknown token "PIZZA"'])
  })

  it('sees an account only after the step that creates it', () => {
    const broken: Scenario = {
      ...good,
      steps: [
        { kind: 'payment', from: 'Alice', to: 'Miner', signa: '1' },
        { kind: 'createAccount', name: 'Alice', passphrase: 'sandbox-alice' },
      ],
    }
    expect(validateScenario(broken)).toEqual(['payment: unknown account "Alice"'])
  })

  it('knows the miner without a step creating it', () => {
    const minerOnly: Scenario = {
      ...good,
      steps: [{ kind: 'fund', account: 'Miner', signa: '1' }],
    }
    expect(validateScenario(minerOnly)).toEqual([])
  })

  it('rejects two accounts with the same name, which would make a reference ambiguous', () => {
    const broken: Scenario = {
      ...good,
      steps: [...good.steps, { kind: 'createAccount', name: 'Alice', passphrase: 'other' }],
    }
    expect(validateScenario(broken)).toEqual(['createAccount: duplicate account "Alice"'])
  })

  it('reports every problem, not only the first', () => {
    const broken: Scenario = {
      ...good,
      steps: [
        { kind: 'payment', from: 'Nobody', to: 'Nowhere', signa: '1' },
        { kind: 'transferToken', from: 'Miner', to: 'Miner', token: 'NONE', quantity: '1' },
      ],
    }
    expect(validateScenario(broken)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenario`
Expected: FAIL, `Failed to resolve import "./scenario"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/scenario.ts

/**
 * Everything a scenario can ask for, and nothing else.
 *
 * The vocabulary is deliberately small and deliberately the limit: anything
 * not expressible here is not a scenario. The trade is that a scenario stays
 * a data file anyone can write without touching the UI — including a
 * developer capturing their own application's starting state.
 *
 * Accounts and tokens are referred to by the name the scenario gave them.
 * Nothing here mentions an address or an asset id, because a scenario is
 * written before the chain it runs against exists.
 */
export type ScenarioStep =
  | { kind: 'createAccount'; name: string; passphrase: string }
  | { kind: 'forge'; count?: number }
  | { kind: 'fund'; account: string; signa: string }
  | { kind: 'payment'; from: string; to: string; signa: string; message?: string }
  | { kind: 'multiOut'; from: string; recipients: { to: string; signa: string }[] }
  | { kind: 'message'; from: string; to: string; text: string; encrypted?: boolean }
  | { kind: 'accountInfo'; account: string; name: string; description?: string }
  | {
      kind: 'issueToken'
      issuer: string
      token: string
      quantity: string
      decimals: number
      description?: string
    }
  | { kind: 'transferToken'; from: string; to: string; token: string; quantity: string }
  | { kind: 'alias'; account: string; aliasName: string; content: string }
  | { kind: 'subscription'; from: string; to: string; signa: string; frequencyS: number }

export interface Scenario {
  /** Also the translation key: `console.scenario.<id>.title` and `.description`. */
  id: string
  /**
   * The account that forges, named separately because every scenario needs
   * one before its first step and because `fund` pays out of it. Created by
   * the runner, so no step has to remember to.
   */
  miner: { name: string; passphrase: string }
  steps: ScenarioStep[]
}

/**
 * Every problem with a scenario, as sentences, or an empty array.
 *
 * Checked before a single transaction is sent, because there is no undo: a
 * scenario that fails at step eleven has already written ten steps' worth of
 * transactions onto a chain the console cannot roll back. Reporting all of
 * them rather than the first means one pass fixes the file.
 */
export function validateScenario(scenario: Scenario): string[] {
  const problems: string[] = []
  const accounts = new Set<string>([scenario.miner.name])
  const tokens = new Set<string>()

  const account = (kind: string, name: string) => {
    if (!accounts.has(name)) problems.push(`${kind}: unknown account "${name}"`)
  }

  for (const step of scenario.steps) {
    switch (step.kind) {
      case 'createAccount':
        if (accounts.has(step.name)) {
          problems.push(`createAccount: duplicate account "${step.name}"`)
        }
        accounts.add(step.name)
        break
      case 'forge':
        break
      case 'fund':
        account(step.kind, step.account)
        break
      case 'payment':
      case 'message':
        account(step.kind, step.from)
        account(step.kind, step.to)
        break
      case 'subscription':
        account(step.kind, step.from)
        account(step.kind, step.to)
        break
      case 'multiOut':
        account(step.kind, step.from)
        for (const recipient of step.recipients) account(step.kind, recipient.to)
        break
      case 'accountInfo':
      case 'alias':
        account(step.kind, step.account)
        break
      case 'issueToken':
        account(step.kind, step.issuer)
        if (tokens.has(step.token)) problems.push(`issueToken: duplicate token "${step.token}"`)
        tokens.add(step.token)
        break
      case 'transferToken':
        account(step.kind, step.from)
        account(step.kind, step.to)
        if (!tokens.has(step.token)) {
          problems.push(`transferToken: unknown token "${step.token}"`)
        }
        break
    }
  }

  return problems
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenario`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenario.ts src/lib/scenario.test.ts
git commit -m "feat: a scenario is eleven verbs and a miner"
```

---

### Task 2: The symbol table

**Files:**
- Create: `src/lib/scenarioNames.ts`
- Test: `src/lib/scenarioNames.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenarioNames.test.ts
import { describe, expect, it } from 'vitest'
import { Names } from './scenarioNames'

describe('Names', () => {
  it('gives back what it was given', () => {
    const names = new Names()
    names.rememberAccount('Alice', { id: '1', address: 'TS-A', passphrase: 'p', name: 'Alice' })
    expect(names.account('Alice').id).toBe('1')
  })

  it('remembers a token by the name the scenario used, not the on-chain name', () => {
    const names = new Names()
    names.rememberToken('PIZZA', '99')
    expect(names.token('PIZZA')).toBe('99')
  })

  // A validated scenario cannot reach these, which is exactly why they throw
  // rather than returning undefined: reaching one means the runner and the
  // validator disagree, and that is a bug to surface, not a value to handle.
  it('throws on a name it was never told, since validation should have caught it', () => {
    const names = new Names()
    expect(() => names.account('Bob')).toThrow('unknown account "Bob"')
    expect(() => names.token('NONE')).toThrow('unknown token "NONE"')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioNames`
Expected: FAIL, `Failed to resolve import './scenarioNames'`

- [ ] **Step 3: Write the implementation**

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

  rememberToken(name: string, assetId: string) {
    this.tokens.set(name, assetId)
  }

  account(name: string): SandboxAccount {
    const found = this.accounts.get(name)
    // validateScenario rejects a scenario that reaches here, so this firing
    // means the two disagree — a bug in one of them, not bad input.
    if (!found) throw new Error(`unknown account "${name}"`)
    return found
  }

  token(name: string): string {
    const found = this.tokens.get(name)
    if (!found) throw new Error(`unknown token "${name}"`)
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

### Task 3: The runner

**Files:**
- Create: `src/lib/scenarioRunner.ts`
- Test: `src/lib/scenarioRunner.test.ts`

The runner is the only thing that knows the order of operations. It reaches the chain solely through `ScenarioOps`, so this test needs no node and no HTTP mocking.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scenarioRunner.test.ts
import { describe, expect, it, vi } from 'vitest'
import type { Scenario } from './scenario'
import { runScenario, type ScenarioOps } from './scenarioRunner'
import type { SandboxAccount } from './accounts'

const account = (name: string): SandboxAccount => ({
  id: `id-${name}`,
  address: `TS-${name.toUpperCase()}`,
  name,
  passphrase: `sandbox-${name.toLowerCase()}`,
})

/** Records what the runner asked for, and answers plausibly. */
const fakeOps = (overrides: Partial<ScenarioOps> = {}) => {
  const calls: string[] = []
  const ops: ScenarioOps = {
    createAccount: vi.fn(async (name) => {
      calls.push(`createAccount:${name}`)
      return account(name)
    }),
    forge: vi.fn(async () => {
      calls.push('forge')
    }),
    balanceSigna: vi.fn(async () => '100000'),
    payment: vi.fn(async () => {
      calls.push('payment')
    }),
    multiOut: vi.fn(async () => {
      calls.push('multiOut')
    }),
    message: vi.fn(async () => {
      calls.push('message')
    }),
    accountInfo: vi.fn(async () => {
      calls.push('accountInfo')
    }),
    issueToken: vi.fn(async () => {
      calls.push('issueToken')
      return 'asset-1'
    }),
    transferToken: vi.fn(async () => {
      calls.push('transferToken')
    }),
    alias: vi.fn(async () => {
      calls.push('alias')
    }),
    subscription: vi.fn(async () => {
      calls.push('subscription')
    }),
    ...overrides,
  }
  return { ops, calls }
}

const scenario = (steps: Scenario['steps']): Scenario => ({
  id: 'test',
  miner: { name: 'Miner', passphrase: 'sandbox-miner' },
  steps,
})

describe('runScenario', () => {
  it('creates the miner before anything else', async () => {
    const { ops, calls } = fakeOps()
    await runScenario(scenario([{ kind: 'forge' }]), ops)
    expect(calls[0]).toBe('createAccount:Miner')
  })

  it('runs the steps in order', async () => {
    const { ops, calls } = fakeOps()
    await runScenario(
      scenario([
        { kind: 'createAccount', name: 'Alice', passphrase: 'sandbox-alice' },
        { kind: 'payment', from: 'Alice', to: 'Miner', signa: '5' },
      ]),
      ops,
    )
    expect(calls).toEqual(['createAccount:Miner', 'createAccount:Alice', 'forge', 'payment', 'forge'])
  })

  // Each step's transaction has to be in a block before the next step can
  // refer to what it made. Forging after every step is also what makes the
  // resulting chain worth looking at.
  it('forges after each step that writes something', async () => {
    const { ops } = fakeOps()
    await runScenario(scenario([{ kind: 'payment', from: 'Miner', to: 'Miner', signa: '1' }]), ops)
    expect(ops.forge).toHaveBeenCalledTimes(1)
  })

  it('reports every step as it starts and finishes', async () => {
    const { ops } = fakeOps()
    const progress = vi.fn()
    await runScenario(scenario([{ kind: 'forge' }, { kind: 'forge' }]), ops, progress)
    expect(progress).toHaveBeenCalledWith({ index: 0, total: 2, state: 'running' })
    expect(progress).toHaveBeenCalledWith({ index: 1, total: 2, state: 'done' })
  })

  // There is no rollback. A scenario that fails midway leaves what it already
  // wrote, so the one thing that must not happen is carrying on and burying
  // the failure under later steps.
  it('stops at the first failing step and says which one', async () => {
    const { ops, calls } = fakeOps({
      payment: vi.fn(async () => {
        throw new Error('Incorrect "recipient"')
      }),
    })
    const outcome = await runScenario(
      scenario([
        { kind: 'payment', from: 'Miner', to: 'Miner', signa: '1' },
        { kind: 'alias', account: 'Miner', aliasName: 'never', content: 'never' },
      ]),
      ops,
    )
    expect(outcome).toEqual({
      kind: 'failed',
      index: 0,
      step: 'payment',
      message: 'Incorrect "recipient"',
    })
    expect(calls).not.toContain('alias')
  })

  it('refuses a scenario that does not validate, before touching the chain', async () => {
    const { ops, calls } = fakeOps()
    const outcome = await runScenario(
      scenario([{ kind: 'payment', from: 'Ghost', to: 'Miner', signa: '1' }]),
      ops,
    )
    expect(outcome.kind).toBe('invalid')
    expect(calls).toEqual([])
  })

  it('resolves a token by the name the scenario gave it', async () => {
    const { ops } = fakeOps()
    await runScenario(
      scenario([
        { kind: 'issueToken', issuer: 'Miner', token: 'PIZZA', quantity: '100', decimals: 0 },
        { kind: 'transferToken', from: 'Miner', to: 'Miner', token: 'PIZZA', quantity: '5' },
      ]),
      ops,
    )
    expect(ops.transferToken).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1', quantity: '5' }),
    )
  })

  // The miner earns its funds by forging, so funding is forge-then-check, and
  // the cap is what stops a scenario asking for more than a sandbox can mint
  // from turning into an endless loop.
  it('forges until the miner can cover a funding step', async () => {
    let balance = 0
    const { ops } = fakeOps({
      balanceSigna: vi.fn(async () => String(balance)),
      forge: vi.fn(async () => {
        balance += 100
      }),
    })
    await runScenario(scenario([{ kind: 'fund', account: 'Miner', signa: '250' }]), ops)
    expect(ops.forge).toHaveBeenCalledTimes(3)
  })

  it('gives up funding rather than forging forever', async () => {
    const { ops } = fakeOps({ balanceSigna: vi.fn(async () => '0') })
    const outcome = await runScenario(
      scenario([{ kind: 'fund', account: 'Miner', signa: '1' }]),
      ops,
    )
    expect(outcome.kind).toBe('failed')
    expect((ops.forge as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(200)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarioRunner`
Expected: FAIL, `Failed to resolve import './scenarioRunner'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/scenarioRunner.ts
import type { SandboxAccount } from './accounts'
import { validateScenario, type Scenario, type ScenarioStep } from './scenario'
import { Names } from './scenarioNames'

/**
 * Everything the runner needs from a chain, and nothing about how to reach
 * one.
 *
 * `src/lib/ledger.ts` builds its clients from `window.location.origin`, which
 * is right for a page the node serves and impossible in a terminal script.
 * The runner therefore never sees a client: the console passes one
 * implementation of this, `scripts/seed.ts` passes another, and the runner's
 * own tests pass a fake that records calls.
 */
export interface ScenarioOps {
  /** Derives the account, stores it wherever the caller keeps accounts, returns it. */
  createAccount(name: string, passphrase: string): Promise<SandboxAccount>
  forge(): Promise<void>
  balanceSigna(accountId: string): Promise<string>
  payment(args: {
    from: SandboxAccount
    to: SandboxAccount
    signa: string
    message?: string
  }): Promise<void>
  multiOut(args: {
    from: SandboxAccount
    recipients: { to: SandboxAccount; signa: string }[]
  }): Promise<void>
  message(args: {
    from: SandboxAccount
    to: SandboxAccount
    text: string
    encrypted: boolean
  }): Promise<void>
  accountInfo(args: {
    account: SandboxAccount
    name: string
    description?: string
  }): Promise<void>
  /** Returns the new asset id. */
  issueToken(args: {
    issuer: SandboxAccount
    name: string
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
  subscription(args: {
    from: SandboxAccount
    to: SandboxAccount
    signa: string
    frequencyS: number
  }): Promise<void>
}

export interface Progress {
  index: number
  total: number
  state: 'running' | 'done'
}

export type Outcome =
  | { kind: 'completed' }
  | { kind: 'invalid'; problems: string[] }
  | { kind: 'failed'; index: number; step: ScenarioStep['kind']; message: string }

/**
 * How many blocks the runner will forge chasing one funding step before it
 * decides the amount is not reachable. Generous enough for the two scenarios
 * that ship, finite so a mistyped amount fails in a minute instead of spinning
 * until someone closes the tab.
 */
const MAX_FUNDING_BLOCKS = 200

export async function runScenario(
  scenario: Scenario,
  ops: ScenarioOps,
  onProgress?: (progress: Progress) => void,
): Promise<Outcome> {
  // Before anything is written, because nothing written can be taken back.
  const problems = validateScenario(scenario)
  if (problems.length > 0) return { kind: 'invalid', problems }

  const names = new Names()
  const total = scenario.steps.length

  try {
    const miner = await ops.createAccount(scenario.miner.name, scenario.miner.passphrase)
    names.rememberAccount(scenario.miner.name, miner)

    for (const [index, step] of scenario.steps.entries()) {
      onProgress?.({ index, total, state: 'running' })
      try {
        await perform(step, ops, names, miner)
      } catch (error) {
        return {
          kind: 'failed',
          index,
          step: step.kind,
          message: error instanceof Error ? error.message : String(error),
        }
      }
      onProgress?.({ index, total, state: 'done' })
    }
  } catch (error) {
    return {
      kind: 'failed',
      index: -1,
      step: 'createAccount',
      message: error instanceof Error ? error.message : String(error),
    }
  }

  return { kind: 'completed' }
}

/**
 * One step, and the block that settles it.
 *
 * Every step that writes is followed by a forge, because the next step may
 * refer to what this one made and an unconfirmed transaction has made
 * nothing yet. It also gives the finished chain a block per step, which is
 * what makes the block list worth opening.
 */
async function perform(
  step: ScenarioStep,
  ops: ScenarioOps,
  names: Names,
  miner: SandboxAccount,
): Promise<void> {
  switch (step.kind) {
    case 'createAccount':
      names.rememberAccount(step.name, await ops.createAccount(step.name, step.passphrase))
      // Deriving an account writes nothing to the chain, so nothing to settle.
      return

    case 'forge':
      for (let i = 0; i < (step.count ?? 1); i += 1) await ops.forge()
      return

    case 'fund': {
      const target = names.account(step.account)
      await forgeUntilAffordable(ops, miner, step.signa)
      if (target.id !== miner.id) {
        await ops.payment({ from: miner, to: target, signa: step.signa })
        await ops.forge()
      }
      return
    }

    case 'payment':
      await ops.payment({
        from: names.account(step.from),
        to: names.account(step.to),
        signa: step.signa,
        message: step.message,
      })
      break

    case 'multiOut':
      await ops.multiOut({
        from: names.account(step.from),
        recipients: step.recipients.map((r) => ({ to: names.account(r.to), signa: r.signa })),
      })
      break

    case 'message':
      await ops.message({
        from: names.account(step.from),
        to: names.account(step.to),
        text: step.text,
        encrypted: step.encrypted === true,
      })
      break

    case 'accountInfo':
      await ops.accountInfo({
        account: names.account(step.account),
        name: step.name,
        description: step.description,
      })
      break

    case 'issueToken':
      names.rememberToken(
        step.token,
        await ops.issueToken({
          issuer: names.account(step.issuer),
          name: step.token,
          quantity: step.quantity,
          decimals: step.decimals,
          description: step.description,
        }),
      )
      break

    case 'transferToken':
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

    case 'subscription':
      await ops.subscription({
        from: names.account(step.from),
        to: names.account(step.to),
        signa: step.signa,
        frequencyS: step.frequencyS,
      })
      break
  }

  await ops.forge()
}

/**
 * The miner mints its own funds by forging, so funding is forge-and-check
 * rather than a transfer from somewhere.
 *
 * The cap matters: a scenario asking for more SIGNA than a sandbox can produce
 * would otherwise forge forever, and the failure a user needs to see is "this
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
    `the miner could not reach ${signa} SIGNA in ${MAX_FUNDING_BLOCKS} blocks — is the amount too large for a sandbox?`,
  )
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test -- scenarioRunner`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenarioRunner.ts src/lib/scenarioRunner.test.ts
git commit -m "feat: one runner, reaching the chain through a port"
```

---

### Task 4: The two scenarios

**Files:**
- Create: `src/scenarios/first-steps.json`
- Create: `src/scenarios/full-house.json`
- Create: `src/scenarios/index.ts`
- Test: `src/scenarios/scenarios.test.ts`

Passphrases are deliberately fake and published, so the addresses are the same on every machine and can be written into an application's configuration. They are prefixed `sandbox-` for the same reason: nobody should be able to mistake one for a real secret.

- [ ] **Step 1: Write the failing test**

```ts
// src/scenarios/scenarios.test.ts
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { SCENARIOS } from './index'
import { validateScenario } from '@/lib/scenario'

describe('the scenarios that ship', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s validates', (_id, scenario) => {
    expect(validateScenario(scenario)).toEqual([])
  })

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s is translated', (id) => {
    const copy = (
      en as unknown as {
        console: { scenario: Record<string, { title?: string; description?: string }> }
      }
    ).console.scenario
    expect(copy[id]?.title, `${id}.title`).toBeTruthy()
    expect(copy[id]?.description, `${id}.description`).toBeTruthy()
  })

  // Published addresses only stay stable if the passphrases do, and a
  // passphrase that does not announce itself as a toy is one somebody will
  // eventually paste somewhere real.
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s uses only sandbox passphrases', (_id, s) => {
    const phrases = [
      s.miner.passphrase,
      ...s.steps.flatMap((step) => (step.kind === 'createAccount' ? [step.passphrase] : [])),
    ]
    for (const phrase of phrases) expect(phrase).toMatch(/^sandbox-/)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test -- scenarios`
Expected: FAIL, `Failed to resolve import './index'`

- [ ] **Step 3: Write `first-steps.json`**

Three accounts, a handful of payments, one plain message. The starting point for someone who wants to see what a block is, and for a developer who just needs funded accounts.

```json
{
  "id": "firstSteps",
  "miner": { "name": "Miner", "passphrase": "sandbox-miner" },
  "steps": [
    { "kind": "createAccount", "name": "Alice", "passphrase": "sandbox-alice" },
    { "kind": "createAccount", "name": "Bob", "passphrase": "sandbox-bob" },
    { "kind": "fund", "account": "Alice", "signa": "1000" },
    { "kind": "fund", "account": "Bob", "signa": "500" },
    { "kind": "payment", "from": "Alice", "to": "Bob", "signa": "120" },
    { "kind": "payment", "from": "Bob", "to": "Alice", "signa": "35" },
    {
      "kind": "payment",
      "from": "Alice",
      "to": "Bob",
      "signa": "10",
      "message": "Thanks for lunch"
    },
    { "kind": "message", "from": "Bob", "to": "Alice", "text": "Any time. Same again Friday?" },
    { "kind": "forge", "count": 2 }
  ]
}
```

- [ ] **Step 4: Write `full-house.json`**

A chain that looks lived-in: profiles on every account, a token distributed across several holders, aliases, an encrypted message, a payroll multi-out and a running subscription. Roughly twenty steps, and the chain on which every view has something to show.

```json
{
  "id": "fullHouse",
  "miner": { "name": "Miner", "passphrase": "sandbox-miner" },
  "steps": [
    { "kind": "createAccount", "name": "Alice", "passphrase": "sandbox-alice" },
    { "kind": "createAccount", "name": "Bob", "passphrase": "sandbox-bob" },
    { "kind": "createAccount", "name": "Carol", "passphrase": "sandbox-carol" },
    { "kind": "createAccount", "name": "Pizzeria", "passphrase": "sandbox-pizzeria" },
    { "kind": "fund", "account": "Alice", "signa": "5000" },
    { "kind": "fund", "account": "Bob", "signa": "2000" },
    { "kind": "fund", "account": "Carol", "signa": "2000" },
    { "kind": "fund", "account": "Pizzeria", "signa": "3000" },
    {
      "kind": "accountInfo",
      "account": "Alice",
      "name": "Alice",
      "description": "Builds things on Signum"
    },
    { "kind": "accountInfo", "account": "Bob", "name": "Bob", "description": "Reads the docs" },
    {
      "kind": "accountInfo",
      "account": "Carol",
      "name": "Carol",
      "description": "Runs the numbers"
    },
    {
      "kind": "accountInfo",
      "account": "Pizzeria",
      "name": "Pizzeria Vesuvio",
      "description": "Wood-fired since 1998"
    },
    {
      "kind": "issueToken",
      "issuer": "Pizzeria",
      "token": "SLICE",
      "quantity": "10000",
      "decimals": 0,
      "description": "One SLICE, one slice. Redeemable at the counter."
    },
    { "kind": "transferToken", "from": "Pizzeria", "to": "Alice", "token": "SLICE", "quantity": "40" },
    { "kind": "transferToken", "from": "Pizzeria", "to": "Bob", "token": "SLICE", "quantity": "15" },
    { "kind": "transferToken", "from": "Pizzeria", "to": "Carol", "token": "SLICE", "quantity": "8" },
    {
      "kind": "alias",
      "account": "Pizzeria",
      "aliasName": "vesuvio",
      "content": "https://example.invalid/vesuvio"
    },
    { "kind": "alias", "account": "Alice", "aliasName": "alice", "content": "Alice on Signum" },
    {
      "kind": "multiOut",
      "from": "Alice",
      "recipients": [
        { "to": "Bob", "signa": "250" },
        { "to": "Carol", "signa": "250" },
        { "to": "Pizzeria", "signa": "60" }
      ]
    },
    {
      "kind": "message",
      "from": "Alice",
      "to": "Bob",
      "text": "The keys are under the mat. Do not tell Carol.",
      "encrypted": true
    },
    { "kind": "message", "from": "Carol", "to": "Alice", "text": "I can read the block list, you know." },
    {
      "kind": "payment",
      "from": "Bob",
      "to": "Pizzeria",
      "signa": "24",
      "message": "Two margheritas, no anchovies"
    },
    {
      "kind": "subscription",
      "from": "Alice",
      "to": "Pizzeria",
      "signa": "12",
      "frequencyS": 3600
    },
    { "kind": "forge", "count": 3 }
  ]
}
```

- [ ] **Step 5: Write the index**

```ts
// src/scenarios/index.ts
import type { Scenario } from '@/lib/scenario'
import firstSteps from './first-steps.json'
import fullHouse from './full-house.json'

/**
 * The scenarios that ship, in the order they are offered: the short one
 * first, because someone who has never seen a block should not be handed
 * twenty transactions to make sense of.
 *
 * They are JSON rather than TypeScript so that writing one needs no build and
 * no knowledge of this codebase — a developer capturing their own
 * application's starting state should be able to copy a file and edit it.
 * The cast is the price of that: `validateScenario` is what actually checks
 * them, and scenarios.test.ts runs it over both.
 */
export const SCENARIOS: Scenario[] = [firstSteps as Scenario, fullHouse as Scenario]
```

If `tsc` objects to importing JSON, add `"resolveJsonModule": true` to the `compilerOptions` in `tsconfig.app.json`.

- [ ] **Step 6: Run the test**

Run: `bun run test -- scenarios`
Expected: the validation and passphrase cases PASS; the translation case FAILS until Task 6 adds the strings.

- [ ] **Step 7: Commit**

```bash
git add src/scenarios tsconfig.app.json
git commit -m "feat: first steps, and a full house"
```

---

### Task 5: The operations, against a real node

**Files:**
- Create: `src/lib/scenarioOps.ts`
- Modify: `src/lib/ledger.ts`

No test: this is the adapter, and every decision it could get wrong lives in the runner, which is tested. What it does have is one shape worth stating — it is built from a client passed in, never from the module-level singleton, because `scripts/seed.ts` has no browser to take an origin from.

- [ ] **Step 1: Make the ledger module importable outside a browser**

`__NODE_ADDRESS__` is a Vite define. In any other runtime it is an undeclared identifier and reading it throws before a single line of the module runs.

```ts
// src/lib/ledger.ts — replace the nodeAddress line
/**
 * The address to name when nothing answers. It differs from nodeHost only in
 * development, where the page comes from the dev server and telling the user to
 * look for a node there would send them to the wrong place.
 *
 * Guarded because this module is also imported by `scripts/seed.ts`, which runs
 * under Bun with no Vite define to replace the identifier.
 */
export const nodeAddress =
  (typeof __NODE_ADDRESS__ === 'undefined' ? null : __NODE_ADDRESS__) ?? window.location.origin
```

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
 * `ScenarioOps` against a live node.
 *
 * Which node is decided in exactly one place, and it is not here: `ledger.ts`
 * resolves it from `window.location.origin`, and `scripts/seed.ts` sets that
 * origin before importing anything. An earlier draft of this took a
 * `LedgerClient` argument, which read as though the caller chose the node —
 * but every write below goes through `send.ts`, which uses the same singleton
 * regardless, so the argument would have been honoured for one balance read
 * and quietly ignored for the other eleven operations. One seam, named where
 * it is, beats two that disagree.
 *
 * `onAccount` is where a derived account goes: into the browser's account
 * store, or onto stdout. Deriving is deterministic and `addAccount` replaces
 * by id, so running a scenario twice yields the same accounts rather than
 * duplicates.
 */
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
      if (minerPassphrase === '') minerPassphrase = passphrase
      onAccount(account)
      return account
    },

    async forge() {
      await forgeBlock(minerPassphrase)
    },

    async balanceSigna(accountId) {
      try {
        const account = await ledger.account.getAccount({ accountId })
        return Amount.fromPlanck(account.balanceNQT ?? '0').getSigna()
      } catch {
        // An account the chain has never seen has no balance rather than an
        // error worth propagating — that is the ordinary state of a freshly
        // derived account, and the caller's next move is to forge anyway.
        return '0'
      }
    },

    async payment({ from, to, signa, message }) {
      await sendPayment({
        from,
        to: to.address,
        signa,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
        message,
        fee: feeFor('payment'),
      })
    },

    async multiOut({ from, recipients }) {
      await sendMultiOut({
        from,
        recipients: recipients.map((r) => ({ address: r.to.address, signa: r.signa })),
        fee: feeFor('multiOut'),
      })
    },

    async message({ from, to, text, encrypted }) {
      const recipientPublicKey = await resolveRecipientPublicKey(to.address, [from, to])
      if (encrypted) {
        await sendEncryptedMessage({
          from,
          to: to.address,
          message: text,
          recipientPublicKey,
          fee: feeFor('message'),
        })
        return
      }
      await sendPlainMessage({
        from,
        to: to.address,
        message: text,
        recipientPublicKey,
        fee: feeFor('message'),
      })
    },

    async accountInfo({ account, name, description }) {
      await setAccountInfo({ account, name, description, fee: feeFor('accountInfo') })
    },

    async issueToken({ issuer, name, quantity, decimals, description }) {
      const { transaction } = await issueToken({
        issuer,
        name,
        quantity,
        decimals,
        description,
        fee: feeFor('issueAsset'),
      })
      // The asset id is the issuance transaction's id. It is not readable
      // until the transaction is in a block, which is why the runner forges
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

    async subscription({ from, to, signa, frequencyS }) {
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

**Check every call against the real signatures in `src/lib/send.ts` before you write this.** The names above are taken from its exports, but the argument names are what matter and they are the authority — `issueToken`'s return shape in particular decides whether `transaction` is the right field for the asset id. If a signature differs, follow `send.ts`, not this plan.

- [ ] **Step 3: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/scenarioOps.ts src/lib/ledger.ts
git commit -m "feat: the scenario operations, against a node passed in"
```

---

### Task 6: The strings

**Files:**
- Modify: `src/i18n/locales/*.ts` (all ten)

- [ ] **Step 1: Add the English block**

Inside `console`:

```ts
    scenario: {
      section: 'Load a scenario',
      note: 'Adds accounts and transactions to the chain you already have. Nothing is removed, and running one twice just adds more.',
      run: 'Load',
      running: 'Step {{index}} of {{total}}',
      completed: 'Loaded — {{count}} steps',
      failed: 'Stopped at step {{index}}: {{message}}',
      invalid: 'This scenario does not describe a chain that can be built',
      firstSteps: {
        title: 'First steps',
        description: 'Three accounts, a few payments and a message. Enough to see what a block is.',
      },
      fullHouse: {
        title: 'Full house',
        description:
          'Profiles, a token spread across four holders, aliases, an encrypted message, a payroll and a standing order. Every view has something to show.',
      },
    },
```

- [ ] **Step 2: Add the German block**

```ts
    scenario: {
      section: 'Szenario laden',
      note: 'Fügt der bestehenden Chain Konten und Transaktionen hinzu. Es wird nichts entfernt, und zweimal laden fügt einfach mehr hinzu.',
      run: 'Laden',
      running: 'Schritt {{index}} von {{total}}',
      completed: 'Geladen — {{count}} Schritte',
      failed: 'Bei Schritt {{index}} gestoppt: {{message}}',
      invalid: 'Dieses Szenario beschreibt keine Chain, die sich bauen lässt',
      firstSteps: {
        title: 'Erste Schritte',
        description:
          'Drei Konten, ein paar Zahlungen und eine Nachricht. Genug, um zu sehen, was ein Block ist.',
      },
      fullHouse: {
        title: 'Volles Haus',
        description:
          'Profile, ein Token auf vier Halter verteilt, Aliasse, eine verschlüsselte Nachricht, eine Sammelzahlung und ein Dauerauftrag. Jede Ansicht hat etwas zu zeigen.',
      },
    },
```

- [ ] **Step 3: Translate the same key set into the remaining eight**

`es`, `pt`, `uk`, `ru`, `zh`, `ja`, `ko`, `hi`. Every domain word must be the one that locale file already uses — check the existing `console.*` and `glossary.*` keys before choosing. `locales.test.ts` compares flattened key sets against English and fails on any difference.

- [ ] **Step 4: Run the tests**

Run: `bun run test`
Expected: PASS, including the scenario translation case from Task 4

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "feat: name the two scenarios, in ten languages"
```

---

### Task 7: Running one from the console

**Files:**
- Create: `src/hooks/useScenario.ts`
- Create: `src/components/console/drawers/ScenarioSection.tsx`
- Modify: `src/components/console/drawers/ChainDrawer.tsx`

The Chain drawer is the home for this: winding back, emptying and populating are the three things that shape a chain, and they belong together.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useScenario.ts
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createScenarioOps } from '@/lib/scenarioOps'
import { runScenario, type Outcome, type Progress } from '@/lib/scenarioRunner'
import type { Scenario } from '@/lib/scenario'
import type { AccountStore } from '@/hooks/useAccounts'

export interface ScenarioRun {
  busy: boolean
  progress: Progress | null
  outcome: Outcome | null
  run: (scenario: Scenario) => Promise<void>
}

/**
 * Running a scenario from the console.
 *
 * Accounts the scenario creates go into the same store the Accounts tab uses,
 * so a loaded scenario leaves you holding its passphrases rather than a chain
 * full of strangers.
 */
export function useScenario(accounts: AccountStore): ScenarioRun {
  const client = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const run = useCallback(
    async (scenario: Scenario) => {
      setBusy(true)
      setOutcome(null)
      setProgress(null)
      const ops = createScenarioOps({
        addressPrefix: accounts.addressPrefix,
        onAccount: (account) => accounts.importPassphrase(account.name, account.passphrase),
      })
      const result = await runScenario(scenario, ops, setProgress)
      setOutcome(result)
      setBusy(false)
      // Everything on screen is now out of date: height, accounts, the feed.
      void client.invalidateQueries()
    },
    [accounts, client],
  )

  return { busy, progress, outcome, run }
}
```

- [ ] **Step 2: Write the section**

```tsx
// src/components/console/drawers/ScenarioSection.tsx
import { useTranslation } from 'react-i18next'
import { SCENARIOS } from '@/scenarios'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { useScenario } from '@/hooks/useScenario'
import type { AccountStore } from '@/hooks/useAccounts'

/**
 * Loading a scenario, with the step it is on named as it happens.
 *
 * That watching is half the explanation for a newcomer: blocks appearing in
 * the stream while a list of steps ticks past is the clearest statement this
 * console can make about what a chain is.
 */
export function ScenarioSection({ accounts }: { accounts: AccountStore }) {
  const { t } = useTranslation()
  const { busy, progress, outcome, run } = useScenario(accounts)

  if (!accounts.available) return null

  return (
    <div className="border-t pt-3" style={{ borderColor: 'var(--border2)' }}>
      <p className="text-[12px] uppercase tracking-[1px] text-[var(--blue3)]">
        {t('console.scenario.section')}
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">{t('console.scenario.note')}</p>

      {SCENARIOS.map((scenario) => (
        <div key={scenario.id} className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-[var(--fg)]">
              {t(`console.scenario.${scenario.id}.title`)}
            </span>
            <ConsoleButton disabled={busy} onClick={() => void run(scenario)}>
              {t('console.scenario.run')}
            </ConsoleButton>
          </div>
          <p className="text-[12px] leading-relaxed text-[var(--muted)]">
            {t(`console.scenario.${scenario.id}.description`)}
          </p>
        </div>
      ))}

      {busy && progress && (
        <p className="mt-2 text-[12px] text-[var(--blue3)]">
          {t('console.scenario.running', { index: progress.index + 1, total: progress.total })}
        </p>
      )}

      {outcome?.kind === 'completed' && (
        <p className="mt-2 text-[12px] text-[var(--blue3)]">
          {t('console.scenario.completed', { count: progress?.total ?? 0 })}
        </p>
      )}
      {outcome?.kind === 'failed' && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--mag)' }}>
          {t('console.scenario.failed', { index: outcome.index + 1, message: outcome.message })}
        </p>
      )}
      {outcome?.kind === 'invalid' && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--mag)' }}>
          {t('console.scenario.invalid')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Host it in the Chain drawer**

`ChainDrawer` currently takes only `height`. Give it the account store, since the scenario needs somewhere to put the accounts it creates:

```tsx
export function ChainDrawer({ height, accounts }: { height: number | null; accounts: AccountStore }) {
```

Render `<ScenarioSection accounts={accounts} />` after the existing "An empty chain" block, and pass `accounts={accounts}` from `ConsoleShell.tsx` where `<ChainDrawer height={state.height} />` is rendered today.

- [ ] **Step 4: Verify**

Run: `bun run test && bun run build`
Expected: both pass

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScenario.ts src/components/console
git commit -m "feat: load a scenario and watch it land"
```

---

### Task 8: Running one from the terminal

**Files:**
- Create: `scripts/seed.ts`
- Create: `scripts/seed.sh`, `scripts/seed.cmd`
- Modify: `scripts/package.sh`

- [ ] **Step 1: Write the script**

```ts
// scripts/seed.ts
/**
 * Populates a running sandbox node from the terminal, so a deliverable can
 * arrive with the chain already interesting and a developer never waits.
 *
 * The window shim below is not decoration. `src/lib/ledger.ts` reads
 * `window.location.origin` at import time, because in the browser the node is
 * whatever origin served the page — the right answer there and an impossible
 * one here. Rather than thread a client through the thirteen functions in
 * send.ts, this names the node once, before anything is imported.
 */
const nodeUrl = process.env.SANDBOX_NODE_URL ?? 'http://localhost:6876'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = { location: { origin: nodeUrl } }

const { SCENARIOS } = await import('../src/scenarios/index')
const { createScenarioOps } = await import('../src/lib/scenarioOps')
const { runScenario } = await import('../src/lib/scenarioRunner')
const { ledger } = await import('../src/lib/ledger')
const { isMockNetwork } = await import('../src/lib/network')

const wanted = process.argv[2]
const scenario = SCENARIOS.find((s) => s.id === wanted)
if (!scenario) {
  console.error(`seed: unknown scenario "${wanted ?? ''}"`)
  console.error(`seed: available — ${SCENARIOS.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

// The same rail the console has. A script that writes passphrases onto a real
// network because someone pointed SANDBOX_NODE_URL at one would be the worst
// bug in this repository.
const { networkName, addressPrefix } = await ledger.network.getNetworkInfo()
if (!isMockNetwork(networkName)) {
  console.error(`seed: ${nodeUrl} reports "${networkName}", which is not the sandbox network`)
  process.exit(1)
}

const outcome = await runScenario(
  scenario,
  createScenarioOps({
    // Read from the node rather than assumed: the prefix is what turns an
    // account id into the address printed below, and a wrong one would
    // publish addresses nobody can use.
    addressPrefix,
    onAccount: (account) => console.log(`seed: ${account.name} ${account.address}`),
  }),
  ({ index, total }) => process.stdout.write(`\rseed: step ${index + 1} of ${total}   `),
)

process.stdout.write('\n')
if (outcome.kind !== 'completed') {
  console.error(`seed: ${JSON.stringify(outcome)}`)
  process.exit(1)
}
console.log(`seed: ${scenario.id} loaded`)
```

- [ ] **Step 2: Write the wrappers**

```sh
#!/bin/sh
# scripts/seed.sh — loads a scenario into a running sandbox node.
# Windows counterpart is seed.cmd; keep them in sync.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

[ $# -ge 1 ] || { echo "usage: ./scripts/seed.sh <firstSteps|fullHouse>" >&2; exit 1; }

exec bun run scripts/seed.ts "$1"
```

```cmd
@echo off
REM scripts\seed.cmd - loads a scenario into a running sandbox node.
REM Unix counterpart is seed.sh; keep them in sync.
setlocal
set "ROOT=%~dp0.."
pushd "%ROOT%" >nul || exit /b 1
if "%~1"=="" (
  echo usage: .\scripts\seed.cmd ^<firstSteps^|fullHouse^> 1>&2
  popd >nul
  exit /b 1
)
bun run scripts/seed.ts %1
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul
exit /b %EXIT_CODE%
```

Make `seed.sh` executable: `chmod +x scripts/seed.sh`.

- [ ] **Step 3: Ship them**

Add `seed.sh` and `seed.cmd` to the file list in `scripts/package.sh`, beside the two start scripts.

- [ ] **Step 4: Verify against a running node**

With the node running:

```bash
./scripts/seed.sh firstSteps
```

Expected: the accounts print with their addresses, the step counter runs to the end, and the console shows the new blocks. Then run it a second time and confirm it adds transactions rather than failing — that is the cumulative behaviour the spec calls for.

- [ ] **Step 5: Commit**

```bash
git add scripts
git commit -m "feat: seed the chain before anyone opens a browser"
```

---

### Task 9: Publish the addresses

**Files:**
- Modify: `README.md`

The point of fixed passphrases is that the addresses can be written into an application's configuration and its test fixtures. That only works if they are written down.

- [ ] **Step 1: Add the section**

Under a heading like "Scenario accounts", list each name, its passphrase and the address it derives to on the sandbox network. Get the addresses by running `./scripts/seed.sh fullHouse` and copying what it prints, rather than deriving them by hand.

State plainly that these passphrases are public, worthless, and must never be used anywhere but here.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: the scenario accounts, and the addresses they always produce"
```

---

## Notes for whoever executes this

**There is no undo.** The console cannot empty a chain, so a scenario that fails halfway leaves what it already wrote. That is why `validateScenario` runs before the first transaction and why the runner stops at the first failure instead of pressing on. Do not add a "continue anyway" path.

**The port is the design, not a detail.** If you find yourself importing `signingLedger` inside `scenarioRunner.ts`, stop: that is the line that makes the terminal script impossible and the runner's tests need a node. The adapter may import it; the runner may not.

**One seam for "which node".** `ledger.ts` answers that from `window.location.origin`, and the seed script sets that origin before importing anything. Do not add a second way to say it — a client argument that `send.ts` ignores is worse than no argument, because it looks like it works.

**Ten locales, every time.** `locales.test.ts` catches a missing key but cannot catch a lazy translation.

**Do not add jsdom, and do not run prettier.** The repo tests pure functions only, and has no prettier config — its defaults will rewrite whole files.
