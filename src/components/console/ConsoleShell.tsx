import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { useChainFeed } from '@/hooks/useChainFeed'
import { Unreachable } from '@/components/startpage'
import { Header } from './Header'
import { AccountsView } from './views/AccountsView'
import { TransactionsView } from './views/TransactionsView'
import { BlocksView } from './views/BlocksView'

export type ConsoleTab = 'transactions' | 'blocks' | 'accounts'
export type DrawerName = 'send' | 'chain' | 'help' | null

const TABS: ConsoleTab[] = ['transactions', 'blocks', 'accounts']

export function ConsoleShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConsoleTab>('transactions')
  const [drawer, setDrawer] = useState<DrawerName>(null)
  const { state, nodeAddress } = useNodeState()
  const accounts = useAccounts()
  const feed = useChainFeed(state.kind === 'ready' ? state.height : null)

  if (state.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-3">
        <Link to="/" className="text-[10px] tracking-[2px] text-[var(--muted)] hover:text-[var(--blue3)]">
          ← {t('console.back')}
        </Link>
      </div>

      <Header state={state} accounts={accounts} onOpenDrawer={setDrawer} />

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

      <div className="flex gap-3">
        <div className="min-h-[320px] flex-1 border p-3" style={{ borderColor: 'var(--border2)' }}>
          {tab === 'transactions' && (
            <TransactionsView items={feed.items} accounts={accounts.accounts} />
          )}
          {tab === 'blocks' && <BlocksView blocks={feed.blocks} onSelect={() => setTab('transactions')} />}
          {tab === 'accounts' && <AccountsView store={accounts} />}
        </div>
        {drawer && (
          <div className="w-[34%] border p-3" style={{ borderColor: 'var(--blue2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[1px] text-[var(--blue3)]">
                {t(`console.drawer.${drawer}`)}
              </span>
              <button className="text-[11px] text-[var(--muted)]" onClick={() => setDrawer(null)}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
