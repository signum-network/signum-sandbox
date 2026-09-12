import { useQuery } from '@tanstack/react-query'
import { ChainTime } from '@signumjs/util'
import type { BlockchainStatus } from '@signumjs/core'
import { ledger, nodeAddress } from '@/lib/ledger'
import { deriveNodeState, type NodeState } from '@/lib/nodeState'
import { useNodeSocket } from './useNodeSocket'

/**
 * The node returns lastBlockTimestamp - verified against v3.9.11 - but the
 * SignumJS BlockchainStatus type omits it. This is the one place that knows,
 * so the cast does not spread through the codebase.
 */
type StatusWithTimestamp = BlockchainStatus & { lastBlockTimestamp: number }
const asStatus = (s: BlockchainStatus) => s as StatusWithTimestamp

export function useNodeState(): { state: NodeState; nodeAddress: string } {
  const { connected } = useNodeSocket()

  const status = useQuery({
    queryKey: ['blockchainStatus'],
    queryFn: () => ledger.network.getBlockchainStatus(),
    refetchInterval: connected ? false : 10_000,
    retry: false,
  })

  const network = useQuery({
    queryKey: ['networkInfo'],
    queryFn: () => ledger.network.getNetworkInfo(),
    staleTime: Infinity,
    retry: false,
  })

  const lastBlockMs = status.data
    ? ChainTime.fromChainTimestamp(asStatus(status.data).lastBlockTimestamp).getDate().getTime()
    : undefined

  return {
    nodeAddress,
    state: deriveNodeState({
      status: status.data
        ? {
            numberOfBlocks: status.data.numberOfBlocks,
            version: status.data.version,
            cumulativeDifficulty: status.data.cumulativeDifficulty,
            isScanning: status.data.isScanning,
          }
        : undefined,
      lastBlockMs,
      networkName: network.data?.networkName,
      statusFailed: status.isError,
      socketConnected: connected,
      now: Date.now(),
    }),
  }
}
