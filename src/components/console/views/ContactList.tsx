import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Address } from '@signumjs/core'
import type { Contacts } from '@/lib/contacts'
import { matchesAccountQuery, type Query } from '@/lib/search'
import { Identicon } from '../Identicon'

/**
 * A contact only ever stores an id (see Contacts in src/lib/contacts.ts); the
 * address shown is derived from it on the fly with the node's own prefix,
 * rather than stored a second time, so there is exactly one place that could
 * ever go stale if a node's prefix changed. Falls back to the bare id on the
 * off chance a stored key isn't a valid numeric id (hand-edited storage).
 */
function addressFromId(id: string, addressPrefix: string): string {
  try {
    return Address.fromNumericId(id, addressPrefix).getReedSolomonAddress(true)
  } catch {
    return id
  }
}

export function ContactList({
  contacts,
  addressPrefix,
  query,
  onAdd,
  onRemove,
}: {
  contacts: Contacts
  addressPrefix: string
  query: Query
  onAdd: (accountIdOrAddress: string, name: string) => void
  onRemove: (accountIdOrAddress: string) => void
}) {
  const { t } = useTranslation()
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')

  const field = 'border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]'
  const button = 'border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]'
  const border = { borderColor: 'var(--border2)' }

  const entries = Object.entries(contacts)
    .map(([id, contactName]) => ({ id, name: contactName, address: addressFromId(id, addressPrefix) }))
    .filter((c) => matchesAccountQuery(c.name, c.address, query))

  return (
    <div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--border2)' }}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-[var(--muted)]">
        {t('console.accounts.sectionContacts')}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={field}
          style={border}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('console.accounts.contactAddress')}
        />
        <input
          className={field}
          style={border}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('console.accounts.localLabel')}
        />
        <button
          className={button}
          style={border}
          onClick={() => {
            if (!address.trim() || !name.trim()) return
            onAdd(address.trim(), name.trim())
            setAddress('')
            setName('')
          }}
        >
          {t('console.accounts.addContact')}
        </button>
      </div>

      {entries.length === 0 && (
        <p className="text-[11px] text-[var(--muted)]">{t('console.accounts.noContacts')}</p>
      )}

      <ul>
        {entries.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 border-b py-2 text-[11px]"
            style={{ borderColor: 'var(--border2)' }}
          >
            <Identicon value={c.address} />
            <span className="font-bold text-[var(--fg)]">{c.name}</span>
            <span className="text-[var(--muted)]">{c.address}</span>
            <button
              className={`${button} ml-auto`}
              style={border}
              onClick={() => onRemove(c.id)}
            >
              {t('console.accounts.remove')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
