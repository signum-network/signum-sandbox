import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { useContacts } from '@/hooks/useContacts'
import { useWatched } from '@/hooks/useWatched'
import { useChainFeed } from '@/hooks/useChainFeed'
import { Unreachable } from '@/components/startpage'
import { AppHeader } from '@/components/AppHeader'
import { ConsoleButton, RowButton } from './ConsoleButton'
import { interpret, resolveQuery } from '@/lib/search'
import { displayName } from '@/lib/contacts'
import { useNameLookup } from '@/hooks/useNameLookup'
import { Header } from './Header'
import { AccountsView } from './views/AccountsView'
import { TransactionsView } from './views/TransactionsView'
import { BlocksView } from './views/BlocksView'
import { WatchView } from './views/WatchView'
import { SearchField } from './views/SearchField'
import { SendDrawer } from './drawers/SendDrawer'
import { ChainDrawer } from './drawers/ChainDrawer'
import { HelpDrawer } from './drawers/HelpDrawer'

export type ConsoleTab = 'transactions' | 'blocks' | 'accounts' | 'watch'
export type DrawerName = 'send' | 'chain' | 'help' | null

const TABS: ConsoleTab[] = ['transactions', 'blocks', 'accounts']

export function ConsoleShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConsoleTab>('transactions')
  const [drawer, setDrawer] = useState<DrawerName>(null)
  const { state, nodeAddress, connected } = useNodeState()
  const accounts = useAccounts()
  const contacts = useContacts()
  const watched = useWatched()
  const feed = useChainFeed(state.kind === 'ready' ? state.height : null, connected)
  const [search, setSearch] = useState('')
  const query = interpret(search)
  // Handing one transaction to the stream: the stream owns payload decoding,
  // contact saving and the raw link, so every "show me this one" gesture in
  // the console routes there rather than growing its own copy.
  const showTransaction = (transactionId: string) => {
    setSearch(transactionId)
    setTab('transactions')
  }

  const namedAccountIds = useNameLookup(query)
  // Resolved once here rather than per row: an address and a name both end up
  // meaning "this account", and only the name kind ever asks the node.
  const resolved = resolveQuery(query, accounts.accounts, contacts.contacts, namedAccountIds)

  if (state.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <AppHeader
        networkName={state.networkName}
        version={state.version}
        connection={state.connection}
        scanning={state.scanning}
        homeLink
      />

      <Header state={state} accounts={accounts} onOpenDrawer={setDrawer} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[...TABS, ...(watched.watchedId ? (['watch'] as const) : [])].map((name) => (
            <ConsoleButton
              key={name}
              active={tab === name}
              onClick={() => setTab(name)}
              style={{
                background: tab === name ? 'rgba(0,102,255,.18)' : 'transparent',
                color: tab === name ? 'var(--blue3)' : 'var(--muted)',
              }}
            >
              {name === 'watch'
                ? displayName(watched.watchedId ?? '', accounts.accounts, contacts.contacts)
                : t(`console.tab.${name}`)}
            </ConsoleButton>
          ))}
        </div>
        <SearchField value={search} onChange={setSearch} />
      </div>

      <div className="flex gap-3">
        <div className="min-h-[320px] flex-1 border p-3" style={{ borderColor: 'var(--border2)' }}>
          {tab === 'transactions' && (
            <TransactionsView
              items={feed.items}
              accounts={accounts.accounts}
              contacts={contacts.contacts}
              onAddContact={contacts.add}
              query={resolved}
            />
          )}
          {tab === 'blocks' && (
            <BlocksView
              blocks={feed.blocks}
              accounts={accounts.accounts}
              contacts={contacts.contacts}
              query={resolved}
              // The block row itself only expands in place; leaving this tab
              // is the consequence of clicking one of the transactions inside
              // it, not of clicking the block.
              onSelectTransaction={showTransaction}
            />
          )}
          {tab === 'watch' && watched.watchedId && (
            <WatchView
              accountId={watched.watchedId}
              accounts={accounts.accounts}
              contacts={contacts.contacts}
              onUnwatch={() => {
                watched.unwatch()
                setTab('accounts')
              }}
              onSelectTransaction={showTransaction}
            />
          )}
          {tab === 'accounts' && (
            <AccountsView
              store={accounts}
              contacts={contacts}
              query={query}
              watchedId={watched.watchedId}
              onWatch={watched.watch}
              onSelectTransaction={showTransaction}
            />
          )}
        </div>
        {drawer && (
          <div className="w-[34%] border p-3" style={{ borderColor: 'var(--blue2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[1px] text-[var(--blue3)]">
                {t(`console.drawer.${drawer}`)}
              </span>
              <RowButton
                className="text-[11px] text-[var(--muted)]"
                onClick={() => setDrawer(null)}
              >
                ✕
              </RowButton>
            </div>
            {drawer === 'send' && <SendDrawer store={accounts} contacts={contacts.contacts} />}
            {drawer === 'chain' && <ChainDrawer height={state.height} />}
            {drawer === 'help' && <HelpDrawer />}
          </div>
        )}
      </div>
    </div>
  )
}
