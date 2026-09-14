import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Contacts } from '@/lib/contacts'
import { matchesAccountQuery, type Query } from '@/lib/search'
import { Identicon } from '../Identicon'
import { ConsoleButton } from '../ConsoleButton'
import { Term } from '../Term'
import { toAddress } from '@/lib/recipient'


export function ContactList({
  contacts,
  addressPrefix,
  query,
  onAdd,
  onRemove,
  onWatch,
  watchedId,
}: {
  contacts: Contacts
  addressPrefix: string
  query: Query
  onAdd: (accountIdOrAddress: string, name: string) => void
  onRemove: (accountIdOrAddress: string) => void
  onWatch: (accountIdOrAddress: string) => void
  watchedId: string | null
}) {
  const { t } = useTranslation()
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')

  const field = 'border bg-transparent px-2 py-1 text-[13px] text-[var(--fg)]'
  const border = { borderColor: 'var(--border2)' }

  const entries = Object.entries(contacts)
    .map(([id, contactName]) => ({ id, name: contactName, address: toAddress(id, addressPrefix) }))
    .filter((c) => matchesAccountQuery(c.name, c.address, query))

  return (
    <div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--border2)' }}>
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[var(--muted)]">
        <Term id="contact">{t('console.accounts.sectionContacts')}</Term>
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
        <ConsoleButton
          onClick={() => {
            if (!address.trim() || !name.trim()) return
            onAdd(address.trim(), name.trim())
            setAddress('')
            setName('')
          }}
        >
          {t('console.accounts.addContact')}
        </ConsoleButton>
      </div>

      {entries.length === 0 && (
        <p className="text-[13px] text-[var(--muted)]">{t('console.accounts.noContacts')}</p>
      )}

      <ul>
        {entries.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 border-b py-2 text-[13px]"
            style={{ borderColor: 'var(--border2)' }}
          >
            <Identicon value={c.address} />
            <span className="font-bold text-[var(--fg)]">{c.name}</span>
            <span className="text-[var(--muted)]">{c.address}</span>
            <span className="ml-auto flex items-center gap-2">
              <ConsoleButton active={watchedId === c.id} onClick={() => onWatch(c.id)}>
                {t('console.watch.watch')}
              </ConsoleButton>
              <ConsoleButton onClick={() => onRemove(c.id)}>
                {t('console.accounts.remove')}
              </ConsoleButton>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
