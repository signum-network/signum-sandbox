import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Amount } from '@signumjs/util'
import type { AccountStore } from '@/hooks/useAccounts'
import { ledger } from '@/lib/ledger'
import type { Query } from '@/lib/search'
import { Identicon } from '../Identicon'

export function AccountsView({ store, query }: { store: AccountStore; query: Query }) {
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

  const shown = store.accounts.filter((account) => {
    if (query.kind === 'name') return account.name.toLowerCase().includes(query.value)
    if (query.kind === 'address') return account.address === query.value
    return true
  })

  return (
    <div>
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
          <li
            key={account.id}
            className="flex items-center gap-3 border-b py-2 text-[11px]"
            style={{ borderColor: 'var(--border2)' }}
          >
            <Identicon value={account.address} />
            <span className="font-bold text-[var(--blue3)]">{account.name}</span>
            <span className="text-[var(--muted)]">{account.address}</span>
            <span className="text-[var(--muted)]"><Balance id={account.id} /></span>
            <span className="ml-auto flex items-center gap-2">
              <button
                className={button}
                style={border}
                onClick={() => store.setForger(account.id)}
              >
                {store.forgerId === account.id ? `★ ${t('console.accounts.forger')}` : t('console.accounts.forger')}
              </button>
              <button className={button} style={border} onClick={() => store.remove(account.id)}>
                {t('console.accounts.remove')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Balance({ id }: { id: string }) {
  const { t } = useTranslation()
  const balance = useQuery({
    queryKey: ['balance', id],
    queryFn: () => ledger.account.getAccountBalance(id),
    retry: false,
  })

  // An account that has never received anything does not exist on chain yet,
  // and the node answers with an error rather than a zero balance.
  if (balance.isError) {
    return <span className="text-[var(--muted)]">{t('console.accounts.notOnChain')}</span>
  }
  if (!balance.data) return null
  return <span>{Amount.fromPlanck(balance.data.balanceNQT).getSigna()} SIGNA</span>
}
