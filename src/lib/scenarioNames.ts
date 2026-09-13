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
