import { useQuery } from '@tanstack/react-query'
import { isContract, type Contacts } from '@/lib/contacts'
import { ledger } from '@/lib/ledger'
import { toComparableId } from '@/lib/recipient'

/**
 * Whether a "To" field holds a contract from the address book, and — once
 * the node answers — the contract itself, for its activation amount and name.
 *
 * Only contacts marked as contracts are looked up; anything else is an
 * account as far as the forms are concerned. The answer never goes stale:
 * a contract's activation amount is fixed when it is deployed.
 */
export function useContract(to: string, contacts: Contacts) {
  const toContract = isContract(contacts, to)
  const id = toContract ? toComparableId(to.trim()) : ''
  const query = useQuery({
    queryKey: ['contract', id],
    queryFn: () => ledger.contract.getContract(id),
    enabled: toContract,
    retry: false,
    staleTime: Infinity,
  })
  return { isContract: toContract, contract: toContract ? (query.data ?? null) : null }
}
