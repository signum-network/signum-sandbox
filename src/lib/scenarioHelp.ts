/**
 * What each instruction takes, for a writer who is looking at a blank page.
 *
 * The parser knows this too, but only as control flow — it can say a line is
 * wrong and never what a right one looks like. This is the same knowledge
 * written down so it can be shown, and `scenarioHelp.test.ts` runs every
 * skeleton below through the parser so the two cannot drift apart.
 */
export interface Instruction {
  /** The verb, and the key the parser switches on. */
  verb: string
  /** The shape of the line, with the arguments named. */
  signature: string
  /** A line to drop into the editor, ready to be filled in. */
  skeleton: string
}

export const INSTRUCTIONS: Instruction[] = [
  { verb: 'miner', signature: 'miner <Name>', skeleton: 'miner Miner' },
  {
    verb: 'account',
    signature: 'account <Name> ["passphrase"]',
    skeleton: 'account Alice',
  },
  { verb: 'fund', signature: 'fund <Name> <signa>', skeleton: 'fund Alice 1000' },
  {
    verb: 'pay',
    signature: 'pay <From> -> <To> <signa> ["message"]',
    skeleton: 'pay Alice -> Bob 100',
  },
  { verb: 'msg', signature: 'msg <From> -> <To> "text"', skeleton: 'msg Alice -> Bob "hello"' },
  {
    verb: 'secret',
    signature: 'secret <From> -> <To> "text"',
    skeleton: 'secret Alice -> Bob "for your eyes only"',
  },
  {
    verb: 'multi',
    signature: 'multi <From> -> <To> <signa>, <To> <signa>, …',
    skeleton: 'multi Alice -> Bob 50, Carol 50',
  },
  {
    verb: 'info',
    signature: 'info <Name> "display name" ["description"]',
    skeleton: 'info Alice "Alice" "Builds things on Signum"',
  },
  {
    verb: 'token',
    signature: 'token <Issuer> <SYMBOL> <quantity> <decimals> ["description"]',
    skeleton: 'token Alice SLICE 1000 0 "One SLICE, one slice"',
  },
  {
    verb: 'transfer',
    signature: 'transfer <From> -> <To> <SYMBOL> <quantity>',
    skeleton: 'transfer Alice -> Bob SLICE 10',
  },
  {
    verb: 'alias',
    signature: 'alias <Owner> <name> "content"',
    skeleton: 'alias Alice alice "Alice on Signum"',
  },
  {
    verb: 'subscribe',
    signature: 'subscribe <From> -> <To> <signa> every <seconds>',
    skeleton: 'subscribe Alice -> Bob 12 every 3600',
  },
  { verb: 'forge', signature: 'forge [count]', skeleton: 'forge 2' },
]

const byVerb = new Map(INSTRUCTIONS.map((entry) => [entry.verb, entry]))

/**
 * The instruction the caret is sitting in, or null.
 *
 * This is the cheap half of what autocompletion would do, and the useful
 * half: with thirteen verbs the question is rarely "which verb" — the
 * reference list answers that — but "what comes after `subscribe`". Reading
 * it from the caret needs only a character offset, where a dropdown at the
 * caret would need pixel coordinates a textarea does not give out.
 */
export function instructionAt(source: string, caret: number): Instruction | null {
  const start = source.lastIndexOf('\n', Math.max(0, caret - 1)) + 1
  const end = source.indexOf('\n', caret)
  const line = source.slice(start, end === -1 ? source.length : end)
  const verb = line.trim().split(/[\s#]/)[0]
  return byVerb.get(verb) ?? null
}
