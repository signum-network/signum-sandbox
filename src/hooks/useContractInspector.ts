import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ledger } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { changedSlots, toDataSlots, type DataSlot } from '@/lib/contractData'

/** How much of each direction the page shows, the same as the watch view. */
const RECENT = 10

/**
 * Everything the inspector shows about one contract, and what changed.
 *
 * Every key here is in STALE_ON_BLOCK, so a new block refetches all of it.
 * Most refetches answer what is already on screen, so the marker is replaced
 * only when a slot actually differs. Otherwise "changed in block N" would be
 * wiped by the next quiet block, before anyone could read it.
 *
 * The account, sentBy and receivedBy keys are the watch view's, so watching
 * a contract and inspecting it share one cache.
 */
export function useContractInspector(contractId: string, height: number | null) {
  const state = useQuery({
    queryKey: ['contractState', contractId],
    queryFn: () => ledger.contract.getContract(contractId),
    retry: false,
  })

  const found = state.isSuccess
  const account = useQuery({
    queryKey: ['account', contractId],
    queryFn: () => ledger.account.getAccount({ accountId: contractId }),
    enabled: found,
    retry: false,
  })
  const incoming = useQuery({
    queryKey: ['receivedBy', contractId],
    queryFn: () =>
      ledger.account.getAccountTransactionsToRecipient({
        recipientId: contractId,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: found,
    retry: false,
  })
  const outgoing = useQuery({
    queryKey: ['sentBy', contractId],
    queryFn: () =>
      ledger.account.getAccountTransactionsFromSender({
        senderId: contractId,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: found,
    retry: false,
  })

  const machineData = state.data?.machineData ?? ''
  const slots = useMemo(() => toDataSlots(machineData), [machineData])

  const previous = useRef<DataSlot[] | null>(null)
  const [changed, setChanged] = useState<{ indices: Set<number>; height: number | null } | null>(
    null,
  )
  useEffect(() => {
    if (!state.data) return
    const indices = changedSlots(previous.current, slots)
    previous.current = slots
    if (indices.size > 0) setChanged({ indices, height })
    // height is read, not watched: a new height with the same data is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, state.data])

  return {
    contract: state.data,
    // "Unknown at" is error code 5, the same code isUnknownAccount checks.
    notFound: state.isError && isUnknownAccount(state.error),
    account: account.data,
    incoming: incoming.data?.transactions,
    outgoing: outgoing.data?.transactions,
    slots,
    changed,
  }
}
