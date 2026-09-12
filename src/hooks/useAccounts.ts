import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { generateMnemonic } from '@signumjs/crypto'
import { ledger } from '@/lib/ledger'
import { isMockNetwork } from '@/lib/network'
import {
  addAccount,
  deriveAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
  type SandboxAccount,
} from '@/lib/accounts'

const STORAGE_KEY = 'signum-sandbox.accounts.v1'
const FORGER_KEY = 'signum-sandbox.forger.v1'

export interface AccountStore {
  /** False when the node is not the mock network; then nothing else may be used. */
  available: boolean
  /** The network the node reported, for the message shown when unavailable. */
  networkName: string | undefined
  /** The Reed-Solomon prefix this node's addresses use, for deriving one from a bare id. */
  addressPrefix: string
  accounts: SandboxAccount[]
  forgerId: string | null
  forger: SandboxAccount | undefined
  create: (name: string) => SandboxAccount
  importPassphrase: (name: string, passphrase: string) => SandboxAccount
  remove: (id: string) => void
  setForger: (id: string) => void
}

export function useAccounts(): AccountStore {
  const network = useQuery({
    queryKey: ['networkInfo'],
    queryFn: () => ledger.network.getNetworkInfo(),
    staleTime: Infinity,
    retry: false,
  })

  const available = isMockNetwork(network.data?.networkName)
  const prefix = network.data?.addressPrefix ?? 'TS'

  const [accounts, setAccounts] = useState<SandboxAccount[]>([])
  const [forgerId, setForgerId] = useState<string | null>(null)

  // Reading storage is deferred until the network is known: on a foreign node
  // the passphrases must not even be loaded into memory.
  useEffect(() => {
    if (!available) {
      setAccounts([])
      setForgerId(null)
      return
    }
    setAccounts(parseAccounts(window.localStorage.getItem(STORAGE_KEY)))
    setForgerId(window.localStorage.getItem(FORGER_KEY))
  }, [available])

  const persist = useCallback((list: SandboxAccount[]) => {
    setAccounts(list)
    window.localStorage.setItem(STORAGE_KEY, serializeAccounts(list))
  }, [])

  const store = useCallback(
    (name: string, passphrase: string) => {
      const account = deriveAccount(name, passphrase, prefix)
      persist(addAccount(accounts, account))
      return account
    },
    [accounts, persist, prefix],
  )

  return {
    available,
    networkName: network.data?.networkName,
    addressPrefix: prefix,
    accounts,
    forgerId,
    forger: accounts.find((a) => a.id === forgerId),
    // A real mnemonic, not a toy passphrase: this is the one a person might
    // later meet outside the sandbox, and it should look like what it is.
    create: (name) => store(name, generateMnemonic()),
    importPassphrase: (name, passphrase) => store(name, passphrase),
    remove: (id) => {
      persist(removeAccount(accounts, id))
      // A forger id left pointing at a removed account would linger in
      // localStorage forever, leaving auto-forge switched on with nothing to
      // forge with and no way to tell why.
      if (id === forgerId) {
        setForgerId(null)
        window.localStorage.removeItem(FORGER_KEY)
      }
    },
    setForger: (id) => {
      setForgerId(id)
      window.localStorage.setItem(FORGER_KEY, id)
    },
  }
}
