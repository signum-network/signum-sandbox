import { useCallback, useEffect, useState } from 'react'
import {
  addContact,
  parseContacts,
  removeContact,
  resolveContact,
  serializeContacts,
  type Contacts,
  type ResolveContactError,
} from '@/lib/contacts'
import { ledger } from '@/lib/ledger'

const STORAGE_KEY = 'signum-sandbox.contacts.v1'

export interface ContactStore {
  contacts: Contacts
  /** Resolves to null once saved, or to why it was not. */
  add: (accountIdOrAddress: string, name: string) => Promise<ResolveContactError | null>
  remove: (accountIdOrAddress: string) => void
}

const lookupAccount = (accountId: string) => ledger.account.getAccount({ accountId })

/**
 * Unlike useAccounts, this does not gate on isMockNetwork. That check exists
 * because accounts carry a passphrase that is only safe to hold in plain
 * localStorage while the chain behind it is throwaway. A contact is just a
 * name for a numeric id, which is the same id on every network — so the
 * book stays useful (and harmless) however the node is connected, and there
 * is nothing here worth refusing to load.
 *
 * Adding asks the node first, so a write lands after an await. It goes
 * through a functional update for that reason: the book captured when the
 * button was pressed may no longer be the book by the time the node answers.
 */
export function useContacts(): ContactStore {
  const [contacts, setContacts] = useState<Contacts>({})

  useEffect(() => {
    setContacts(parseContacts(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const update = useCallback((change: (previous: Contacts) => Contacts) => {
    setContacts((previous) => {
      const next = change(previous)
      window.localStorage.setItem(STORAGE_KEY, serializeContacts(next))
      return next
    })
  }, [])

  return {
    contacts,
    add: async (accountIdOrAddress, name) => {
      const resolved = await resolveContact(accountIdOrAddress, lookupAccount)
      if ('error' in resolved) return resolved.error
      update((previous) => addContact(previous, resolved.id, { name, kind: resolved.kind }))
      return null
    },
    remove: (accountIdOrAddress) => update((previous) => removeContact(previous, accountIdOrAddress)),
  }
}
