import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { useContacts } from '@/hooks/useContacts'
import { useWatched } from '@/hooks/useWatched'
import { useBeginner } from '@/hooks/useBeginner'
import { useBlockPage, useChainFeed } from '@/hooks/useChainFeed'
import { Unreachable } from '@/components/startpage'
import { AppHeader } from '@/components/AppHeader'
import { ConsoleButton, RowButton } from './ConsoleButton'
import { interpret, resolveQuery } from '@/lib/search'
import { displayName } from '@/lib/contacts'
import { cn } from '@/lib/utils'
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
import { BeginnerMode } from './BeginnerMode'
import { FirstVisit } from './FirstVisit'
import { ViewNote } from './ViewNote'
import { TourOverlay } from './tour/TourOverlay'
import { useTour } from '@/hooks/useTour'
import { useBlockChime } from '@/hooks/useBlockChime'
import { useChainPulse, SPRINGS, EASINGS, seconds } from '@/motion'
import { PAGE_WIDTH } from '@/components/pageShell'
import { observeFeed, type Observation } from '@/lib/tour'

import type { ConsoleTab, DrawerName } from '@/lib/consoleNav'

export type { ConsoleTab, DrawerName }

const TABS: ConsoleTab[] = ['transactions', 'blocks', 'accounts']

export function ConsoleShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConsoleTab>('transactions')
  const [drawer, setDrawer] = useState<DrawerName>(null)
  const { state, nodeAddress, connected } = useNodeState()
  const accounts = useAccounts()
  const contacts = useContacts()
  const watched = useWatched()
  const beginner = useBeginner()
  const feed = useChainFeed(state.kind === 'ready' ? state.height : null, connected)
  // One observation per screen. The beat in the logomark, the flash on the
  // chain bar and this chime all hang off it.
  const pulse = useChainPulse(state.kind === 'ready' ? (state.height ?? null) : null)
  useBlockChime(pulse)
  const [search, setSearch] = useState('')
  const [txPage, setTxPage] = useState(0)
  const [blockPage, setBlockPage] = useState(0)
  const [hideEmptyBlocks, setHideEmptyBlocks] = useState(false)
  // A page index belongs to the list it indexed. Narrowing the filter makes
  // the old position meaningless, so it goes back to the top rather than
  // leaving someone on an empty page wondering where the rows went.
  const changeSearch = (value: string) => {
    setSearch(value)
    setTxPage(0)
    setBlockPage(0)
  }
  const query = interpret(search)
  // Handing one transaction to the stream: the stream owns payload decoding,
  // contact saving and the raw link, so every "show me this one" gesture in
  // the console routes there rather than growing its own copy.
  const showTransaction = (transactionId: string) => {
    changeSearch(transactionId)
    setTab('transactions')
  }

  const namedAccountIds = useNameLookup(query)
  // Resolved once here rather than per row: an address and a name both end up
  // meaning "this account", and only the name kind ever asks the node.
  const resolved = resolveQuery(query, accounts.accounts, contacts.contacts, namedAccountIds)

  // The Blocks tab walks the whole chain, so it fetches its own page rather
  // than sharing the stream's fixed window at the tip.
  const blocks = useBlockPage(blockPage, connected, state.kind === 'ready')

  // Everything the tour is allowed to know, assembled from what the shell
  // already holds. No extra query: a tour that polls the node to decide
  // whether you did the thing would be a second source of truth about a chain
  // that already has one.
  const ownedIds = new Set(accounts.accounts.map((a) => a.id))
  const observation: Observation = {
    // Assembled above the unreachable guard, like every other hook here, so
    // the height has to be read the same defensive way the feed reads it.
    height: state.kind === 'ready' ? (state.height ?? 0) : 0,
    accountIds: ownedIds,
    forgerId: accounts.forgerId,
    ...observeFeed(feed.items, ownedIds),
    tab,
    drawer,
  }
  const tour = useTour(observation)

  // A step that points at the Send drawer opens it. Only when the step
  // changes: reopening it on every render would make the close button useless.
  const stepId = tour.step?.id
  useEffect(() => {
    const opens = tour.step?.opens
    if (!opens) return
    if (opens.tab !== undefined) setTab(opens.tab)
    if (opens.drawer !== undefined) setDrawer(opens.drawer)
    // Keyed on the step id, not the step object, which is a fresh array entry
    // on every render and would re-fire this on nothing but identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId])

  if (state.kind === 'unreachable') {
    return (
      <div className={cn('mx-auto p-6', PAGE_WIDTH)}>
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <BeginnerMode on={beginner.beginner}>
      <div className={cn('mx-auto flex h-screen flex-col p-6', PAGE_WIDTH)}>
        <AppHeader
          networkName={state.networkName}
          version={state.version}
          connection={state.connection}
          scanning={state.scanning}
          beat={pulse}
          homeLink
        />

        <Header state={state} accounts={accounts} pulse={pulse} onOpenDrawer={setDrawer} />

        <div className="mb-3 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            {[...TABS, ...(watched.watchedId ? (['watch'] as const) : [])].map((name) => (
              <span
                key={name}
                className="relative flex"
                data-tour={
                  name === 'accounts'
                    ? 'accounts-tab'
                    : name === 'transactions'
                      ? 'transactions-tab'
                      : undefined
                }
              >
                {/*
                  One marker for the whole row: layoutId makes Framer treat the
                  instance under the old tab and the one under the new tab as
                  the same object, so it travels between them instead of
                  disappearing here and appearing there. Behind the button, so
                  the label is never painted over.
                */}
                {tab === name && (
                  <motion.span
                    layoutId="console-tab-marker"
                    className="absolute inset-0"
                    style={{ background: 'rgba(0,102,255,.18)', zIndex: -1 }}
                    transition={SPRINGS.panel}
                  />
                )}
                <ConsoleButton
                  active={tab === name}
                  onClick={() => setTab(name)}
                  style={{
                    background: 'transparent',
                    color: tab === name ? 'var(--blue3)' : 'var(--muted)',
                  }}
                >
                  {name === 'watch'
                    ? displayName(watched.watchedId ?? '', accounts.accounts, contacts.contacts)
                    : t(`console.tab.${name}`)}
                </ConsoleButton>
              </span>
            ))}
          </div>
          <SearchField value={search} onChange={changeSearch} />
        </div>

        {/*
          min-h-0 is what lets a flex child shrink below its content and hand the
          overflow to the scroll container inside it; without it the list would
          push the page taller again and nothing would scroll in place.
        */}
        <div className="flex min-h-0 flex-1 gap-3">
          <div
            className="flex min-h-[200px] min-w-0 flex-1 flex-col border p-3"
            style={{ borderColor: 'var(--border2)' }}
          >
            {!beginner.answered && (
              <FirstVisit
                onAnswer={(isBeginner) => {
                  beginner.setBeginner(isBeginner)
                  // Saying "I am new" is the one moment the tour is certainly
                  // wanted, so it starts rather than waiting to be found.
                  if (isBeginner) tour.start()
                }}
              />
            )}
            {beginner.answered && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  className="flex min-h-0 flex-1 flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: seconds('instant') }}
                >
                  {tab === 'transactions' && (
                    <>
                      <ViewNote id="transactions" terms={['block', 'unconfirmed']} />
                      <TransactionsView
                        items={feed.items}
                        accounts={accounts.accounts}
                        contacts={contacts.contacts}
                        onAddContact={contacts.add}
                        query={resolved}
                        page={txPage}
                        onPage={setTxPage}
                      />
                    </>
                  )}
                  {tab === 'blocks' && (
                    <>
                      <ViewNote id="blocks" terms={['block', 'forger']} />
                      <BlocksView
                        blocks={blocks.data ?? []}
                        accounts={accounts.accounts}
                        contacts={contacts.contacts}
                        query={resolved}
                        page={blockPage}
                        onPage={setBlockPage}
                        chainLength={state.height ?? 0}
                        hideEmpty={hideEmptyBlocks}
                        onHideEmpty={setHideEmptyBlocks}
                        // The block row itself only expands in place; leaving this tab
                        // is the consequence of clicking one of the transactions inside
                        // it, not of clicking the block.
                        onSelectTransaction={showTransaction}
                      />
                    </>
                  )}
                  {tab === 'watch' && watched.watchedId && (
                    <>
                      <ViewNote id="watch" />
                      <div className="themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto pr-2">
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
                      </div>
                    </>
                  )}
                  {tab === 'accounts' && (
                    <>
                      <ViewNote id="accounts" />
                      <div className="themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto pr-2">
                        <AccountsView
                        store={accounts}
                        contacts={contacts}
                        query={query}
                          watchedId={watched.watchedId}
                          onWatch={watched.watch}
                          onSelectTransaction={showTransaction}
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          <AnimatePresence initial={false}>
            {drawer && (
              <motion.div
                key="drawer"
                className="themed-scroll console-scroll overflow-y-auto border"
                style={{ borderColor: 'var(--blue2)' }}
                initial={{ width: 0, opacity: 0, paddingLeft: 0, paddingRight: 0 }}
                animate={{ width: '34%', opacity: 1, paddingLeft: 12, paddingRight: 12 }}
                exit={{ width: 0, opacity: 0, paddingLeft: 0, paddingRight: 0 }}
                transition={{ duration: seconds('base'), ease: EASINGS.out }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] uppercase tracking-[1px] text-[var(--blue3)]">
                    {t(`console.drawer.${drawer}`)}
                  </span>
                  <RowButton
                    className="text-[13px] text-[var(--muted)]"
                    onClick={() => setDrawer(null)}
                  >
                    ✕
                  </RowButton>
                </div>
                {drawer === 'send' && (
                  <>
                    <ViewNote id="send" />
                    <SendDrawer
                      store={accounts}
                      contacts={contacts.contacts}
                      prefill={tour.step?.prefill}
                    />
                  </>
                )}
                {drawer === 'chain' && (
                  <>
                    <ViewNote id="chain" />
                    <ChainDrawer height={state.height} />
                  </>
                )}
                {drawer === 'help' && (
                  <HelpDrawer
                    beginner={beginner.beginner}
                    onBeginner={beginner.setBeginner}
                    tourActive={tour.active}
                    onStartTour={tour.start}
                    onStopTour={tour.stop}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Last inside the provider, so the ring and the callout paint over
            everything the step might be pointing at. */}
        <TourOverlay tour={tour} />
      </div>
    </BeginnerMode>
  )
}
