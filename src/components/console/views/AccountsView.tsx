import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountStore } from '@/hooks/useAccounts'
import type { ContactStore } from '@/hooks/useContacts'
import { matchesAccountQuery, type Query } from '@/lib/search'
import { AccountRow } from './AccountRow'
import { ConsoleButton } from '../ConsoleButton'
import { ContactList } from './ContactList'

export function AccountsView({
  store,
  contacts,
  query,
  watchedId,
  onWatch,
  onSelectTransaction,
}: {
  store: AccountStore
  contacts: ContactStore
  query: Query
  watchedId: string | null
  onWatch: (accountIdOrAddress: string) => void
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()
  // Two separate fields, not one shared between the two actions below: typing
  // a label to create an account and typing one to import a passphrase are
  // different intents, and sharing state made it look like one was feeding
  // the other.
  const [createName, setCreateName] = useState('')
  const [importName, setImportName] = useState('')
  const [passphrase, setPassphrase] = useState('')

  if (!store.available) {
    return (
      <div className="p-4">
        <p className="text-[14px] font-bold text-[var(--blue3)]">{t('console.guard.title')}</p>
        <p className="mt-2 text-[13px] text-[var(--muted)]">
          {t('console.guard.description', { network: store.networkName ?? '—' })}
        </p>
      </div>
    )
  }

  const field = 'border bg-transparent px-2 py-1 text-[13px] text-[var(--fg)]'
  const border = { borderColor: 'var(--border2)' }

  const shown = store.accounts.filter((account) =>
    matchesAccountQuery(account.name, account.address, query),
  )

  return (
    <div>
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[var(--blue3)]">
        {t('console.accounts.sectionOwned')}
      </div>

      {/*
        A name typed here never reaches the chain — it is the same kind of
        private label a contact gets, just for an address the sandbox also
        holds the passphrase for. Said once, plainly, rather than left for
        the reader to guess from an unlabelled input.
      */}
      <p className="mb-2 text-[12px] text-[var(--muted)]">{t('console.accounts.nameHint')}</p>

      {/*
        Two stacked, dividing-lined rows rather than one wrapping line: create
        and import are unrelated actions that happened to share a row before,
        which read as one blended action. Stacking with a rule between them
        costs one extra line of height and buys the two an obvious boundary.
      */}
      <div className="mb-3 flex flex-wrap items-center gap-2" data-tour="create-account">
        <input
          className={field}
          style={border}
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder={t('console.accounts.localLabel')}
        />
        <ConsoleButton
          onClick={() => {
            if (!createName.trim()) return
            store.create(createName.trim())
            setCreateName('')
          }}
        >
          {t('console.accounts.create')}
        </ConsoleButton>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-t pt-2" style={border}>
        <input
          className={field}
          style={border}
          value={importName}
          onChange={(e) => setImportName(e.target.value)}
          placeholder={t('console.accounts.localLabel')}
        />
        <input
          className={field}
          style={border}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={t('console.accounts.passphrase')}
        />
        <ConsoleButton
          onClick={() => {
            if (!importName.trim() || !passphrase.trim()) return
            store.importPassphrase(importName.trim(), passphrase.trim())
            setImportName('')
            setPassphrase('')
          }}
        >
          {t('console.accounts.import')}
        </ConsoleButton>
      </div>

      {shown.length === 0 && (
        <p className="text-[13px] text-[var(--muted)]">{t('console.accounts.none')}</p>
      )}

      <ul>
        {shown.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            accounts={store.accounts}
            contacts={contacts.contacts}
            onSelectTransaction={onSelectTransaction}
            isForger={store.forgerId === account.id}
            isWatched={watchedId === account.id}
            onWatch={() => onWatch(account.id)}
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
        onWatch={onWatch}
        watchedId={watchedId}
      />
    </div>
  )
}
