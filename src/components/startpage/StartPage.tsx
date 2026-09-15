import { useNodeState } from '@/hooks/useNodeState'
import { useBlockChime } from '@/hooks/useBlockChime'
import { useChainPulse } from '@/motion'
import { StatusHeader } from './StatusHeader'
import { NodeStatePanel } from './NodeStatePanel'
import { EntryList } from './EntryList'
import { Unreachable } from './Unreachable'

export function StartPage() {
  const { state, nodeAddress } = useNodeState()
  const pulse = useChainPulse(state.kind === 'ready' ? (state.height ?? null) : null)
  useBlockChime(pulse)

  if (state.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <StatusHeader
        networkName={state.networkName}
        version={state.version}
        connection={state.connection}
        scanning={state.scanning}
      />
      <div className="grid gap-3 md:grid-cols-[1.1fr_.9fr]">
        <NodeStatePanel
          height={state.height}
          lastBlockAgeMs={state.lastBlockAgeMs}
        />
        <EntryList />
      </div>
    </div>
  )
}
