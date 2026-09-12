import { useCallback, useEffect, useState } from 'react'
import {
  addContact,
  parseContacts,
  removeContact,
  serializeContacts,
  type Contacts,
} from '@/lib/contacts'

const STORAGE_KEY = 'signum-sandbox.contacts.v1'

export interface ContactStore {
  contacts: Contacts
  add: (accountIdOrAddress: string, name: string) => void
  remove: (accountIdOrAddress: string) => void
}

/**
 * Unlike useAccounts, this does not gate on isMockNetwork. That check exists
 * because accounts carry a passphrase that is only safe to hold in plain
 * localStorage while the chain behind it is throwaway. A contact is just a
 * name for a numeric id, which is the same id on every network — so the
 * book stays useful (and harmless) however the node is connected, and there
 * is nothing here worth refusing to load.
 */
export function useContacts(): ContactStore {
  const [contacts, setContacts] = useState<Contacts>({})

  useEffect(() => {
    setContacts(parseContacts(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const persist = useCallback((next: Contacts) => {
    setContacts(next)
    window.localStorage.setItem(STORAGE_KEY, serializeContacts(next))
  }, [])

  return {
    contacts,
    add: (accountIdOrAddress, name) =>
      persist(addContact(contacts, accountIdOrAddress, name)),
    remove: (accountIdOrAddress) => persist(removeContact(contacts, accountIdOrAddress)),
  }
}
