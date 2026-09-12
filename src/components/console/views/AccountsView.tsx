import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountStore } from '@/hooks/useAccounts'
import type { ContactStore } from '@/hooks/useContacts'
import { matchesAccountQuery, type Query } from '@/lib/search'
import { AccountRow } from './AccountRow'
import { ContactList } from './ContactList'

export function AccountsView({
  store,
  contacts,
  query,
}: {
  store: AccountStore
  contacts: ContactStore
  query: Query
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')

  if (!store.available) {
    return (
      <div className="p-4">
        <p className="text-[12px] font-bold text-[var(--blue3)]">{t('console.guard.title')}</p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          {t('console.guard.description', { network: store.networkName ?? '—' })}
        </p>
      </div>
    )
  }

  const field = 'border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]'
  const button = 'border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]'
  const border = { borderColor: 'var(--border2)' }

  const shown = store.accounts.filter((account) =>
    matchesAccountQuery(account.name, account.address, query),
  )

  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-[var(--blue3)]">
        {t('console.accounts.sectionOwned')}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={field}
          style={border}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('console.accounts.name')}
        />
        <button
          className={button}
          style={border}
          onClick={() => {
            if (!name.trim()) return
            store.create(name.trim())
            setName('')
          }}
        >
          {t('console.accounts.create')}
        </button>
        <input
          className={field}
          style={border}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={t('console.accounts.passphrase')}
        />
        <button
          className={button}
          style={border}
          onClick={() => {
            if (!name.trim() || !passphrase.trim()) return
            store.importPassphrase(name.trim(), passphrase.trim())
            setName('')
            setPassphrase('')
          }}
        >
          {t('console.accounts.import')}
        </button>
      </div>

      {shown.length === 0 && (
        <p className="text-[11px] text-[var(--muted)]">{t('console.accounts.none')}</p>
      )}

      <ul>
        {shown.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            isForger={store.forgerId === account.id}
            onSetForger={() => store.setForger(account.id)}
            onRemove={() => store.remove(account.id)}
          />
        ))}
      </ul>

      <ContactList
        contacts={contacts.contacts}
        addressPrefix={store.addressPrefix}
        query={query}
        onAdd={contacts.add}
        onRemove={contacts.remove}
      />
    </div>
  )
}
