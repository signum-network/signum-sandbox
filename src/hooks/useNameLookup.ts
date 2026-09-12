import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ledger } from '@/lib/ledger'
import type { Query } from '@/lib/search'

/**
 * How long the field has to stand still before the node is asked. Typing
 * "Alice" would otherwise fire five requests for five prefixes, four of which
 * the node answers with nothing — `getAccountsWithName` matches exactly.
 */
const SETTLE_MS = 300

function useSettled(value: string): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), SETTLE_MS)
    return () => clearTimeout(id)
  }, [value])
  return settled
}

/**
 * The account ids the node knows under this name.
 *
 * Signum accounts carry a name on chain, and `getAccountsWithName` is the only
 * way to go from one to an account — verified against v3.9.11: exact match,
 * case-insensitive, no substring. It runs only for a name query, so an address
 * or a height never touches the network.
 */
export function useNameLookup(query: Query): string[] {
  const name = query.kind === 'name' ? query.value : ''
  const settled = useSettled(name)

  const { data } = useQuery({
    queryKey: ['accountsWithName', settled],
    queryFn: () =>
      ledger.service.query<{ accounts: string[] }>('getAccountsWithName', { name: settled }),
    enabled: settled !== '',
    staleTime: Infinity,
    retry: false,
  })

  return data?.accounts ?? []
}
