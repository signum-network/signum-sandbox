import type { Contract } from '@signumjs/core'
import type { Query } from './search'

/** One page of the node's getATs, which SignumJS does not wrap. */
export interface ContractPage {
  ats: Contract[]
  /** Present while the node holds more than this page. */
  nextIndex?: number
}

/**
 * Every contract on the chain, following nextIndex until the node has no
 * more. A sandbox chain holds few, so the whole list is read and the
 * console pages it like any other.
 */
export async function fetchAllContracts(
  fetchPage: (firstIndex: number) => Promise<ContractPage>,
): Promise<Contract[]> {
  const all: Contract[] = []
  let firstIndex: number | undefined = 0
  while (firstIndex !== undefined) {
    const page: ContractPage = await fetchPage(firstIndex)
    all.push(...page.ats)
    firstIndex = page.nextIndex
  }
  return all
}

/** Newest first, by creation block; ties by id, so the order is stable. */
export function sortContracts(contracts: Contract[]): Contract[] {
  return [...contracts].sort(
    (a, b) =>
      b.creationBlock - a.creationBlock || (BigInt(b.at) > BigInt(a.at) ? 1 : -1),
  )
}

/**
 * Whether the console's search finds a contract. Its creator counts as part
 * of it: "what did Alice deploy?" is the question a name most often asks.
 */
export function matchesContract(contract: Contract, query: Query, creatorName: string): boolean {
  switch (query.kind) {
    case 'none':
      return true
    case 'name':
      return [contract.name, creatorName].some((name) => name.toLowerCase().includes(query.value))
    case 'address': {
      const address = query.value.toUpperCase()
      return contract.atRS === address || contract.creatorRS === address
    }
    case 'id':
      return [contract.at, contract.creator, contract.machineCodeHashId].includes(query.value)
    case 'height':
      return contract.creationBlock === query.height
  }
}
