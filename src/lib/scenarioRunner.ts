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
    `the miner could not reach ${signa} SIGNA in ${MAX_FUNDING_BLOCKS} blocks` +
      ' — too large for a sandbox?',
  )
}
