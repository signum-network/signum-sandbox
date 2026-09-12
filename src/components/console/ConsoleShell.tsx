import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useAccounts } from '@/hooks/useAccounts'
import { AccountsView } from './views/AccountsView'

export type ConsoleTab = 'transactions' | 'blocks' | 'accounts'

const TABS: ConsoleTab[] = ['transactions', 'blocks', 'accounts']

export function ConsoleShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConsoleTab>('transactions')
  const accounts = useAccounts()

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="text-[10px] tracking-[2px] text-[var(--muted)] hover:text-[var(--blue3)]">
          ← {t('console.back')}
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className="border px-3 py-1 text-[10px] font-bold uppercase tracking-[1px]"
            style={{
              borderColor: tab === name ? 'var(--blue2)' : 'var(--border2)',
              background: tab === name ? 'rgba(0,102,255,.18)' : 'transparent',
              color: tab === name ? 'var(--blue3)' : 'var(--muted)',
            }}
          >
            {t(`console.tab.${name}`)}
          </button>
        ))}
      </div>

      <div className="min-h-[320px] border p-3" style={{ borderColor: 'var(--border2)' }}>
        {tab === 'accounts' ? <AccountsView store={accounts} /> : tab}
      </div>
    </div>
  )
}
