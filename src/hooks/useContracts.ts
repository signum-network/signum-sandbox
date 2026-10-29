import { useQuery } from '@tanstack/react-query'
import { ledger } from '@/lib/ledger'
import { fetchAllContracts, sortContracts, type ContractPage } from '@/lib/contractList'

/** How many contracts one request asks for. */
const BATCH = 100

/**
 * Every contract on the chain, newest first. In STALE_ON_BLOCK: a block can
 * deploy one or change one's status.
 */
export function useContracts(enabled: boolean) {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () =>
      fetchAllContracts((firstIndex) =>
        ledger.service.query<ContractPage>('getATs', {
          includeDetails: false,
          firstIndex,
          lastIndex: firstIndex + BATCH - 1,
        }),
      ).then(sortContracts),
    enabled,
    retry: false,
  })
}
