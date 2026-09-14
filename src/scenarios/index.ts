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
