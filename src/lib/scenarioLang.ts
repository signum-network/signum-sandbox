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
        if (issuer === undefined || token === undefined) {
          return fail('token needs an issuer and a symbol')
        }
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
        return void steps.push({
          line,
          kind: 'alias',
          account,
          aliasName,
          content: unquote(content),
        })
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
