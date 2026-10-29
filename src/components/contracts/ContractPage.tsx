import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AppHeader } from '@/components/AppHeader'
import { PAGE_WIDTH } from '@/components/pageShell'
import { Unreachable } from '@/components/startpage'
import { BeginnerMode } from '@/components/console/BeginnerMode'
import { useBeginner } from '@/hooks/useBeginner'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { useContacts } from '@/hooks/useContacts'
import { useContractInspector } from '@/hooks/useContractInspector'
import { useContractLabels } from '@/hooks/useContractLabels'
import { ViewNote } from '@/components/console/ViewNote'
import { Direction } from '@/components/console/views/Direction'
import { ContractHeader } from './ContractHeader'
import { MemoryView } from './MemoryView'
import { ContractMaps } from './ContractMaps'
import { ContractTabs, type ContractTab, type TabState } from './ContractTabs'
import { knownIds, slotMatches, type DataSlot, type KnownId } from '@/lib/contractData'
import { displayName } from '@/lib/contacts'
import { toAccountId } from '@/lib/recipient'
import { cn } from '@/lib/utils'

/** The tabs that show a part of the contract's memory, in memory order. */
type Section = 'data' | 'callStack' | 'userStack'
const SECTIONS: Section[] = ['data', 'callStack', 'userStack']

/** The contract id a URL names, or null when it names none. */
function parseContractId(param: string): string | null {
  try {
    return toAccountId(param)
  } catch {
    return null
  }
}

/**
 * One tab's content. Every tab stays mounted and only the open one shows, so
 * a map lookup, a page or a selection survives a look at another tab, and a
 * tab that is not open can still count its search hits.
 */
function Pane({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={cn('min-h-0 flex-1 flex-col', open ? 'flex' : 'hidden')}>{children}</div>
}

/** A tab's content, scrolling inside the panel rather than growing the page. */
function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="themed-scroll console-scroll max-h-[60vh] min-h-0 flex-1 overflow-y-auto pr-2 md:max-h-none">
      {children}
    </div>
  )
}

/**
 * Everything below the page's own header, for an id that parses. A component
 * of its own so the queries never run for one that does not.
 */
function ContractBody({ contractId, height }: { contractId: string; height: number | null }) {
  const { t } = useTranslation()
  const { accounts, addressPrefix } = useAccounts()
  const { contacts } = useContacts()
  const inspector = useContractInspector(contractId, height)
  const contract = inspector.contract
  const { meta, setMeta } = useContractLabels(contract?.machineCodeHashId ?? null)
  // The contract itself and its creator, on top of what the console knows.
  const known = useMemo(
    () =>
      contract
        ? knownIds(accounts, contacts, [
            { id: contract.at, name: contract.name, contract: true },
            {
              id: contract.creator,
              name: displayName(contract.creatorRS, accounts, contacts),
              contract: false,
            },
          ])
        : new Map<string, KnownId>(),
    [contract, accounts, contacts],
  )

  const [tab, setTab] = useState<ContractTab>('data')
  const [query, setQuery] = useState('')

  // The node hands over the whole memory; the creation header says where the
  // variables end and the two stacks begin. Without it all of it is data.
  const sections = useMemo(() => {
    const slots = inspector.slots
    const layout = inspector.layout
    const dataCount = layout ? Math.min(layout.dataSlots, slots.length) : slots.length
    const callEnd = layout ? dataCount + layout.callStackSlots : dataCount
    return {
      data: slots.slice(0, dataCount),
      callStack: slots.slice(dataCount, callEnd),
      userStack: slots.slice(callEnd),
    } satisfies Record<Section, DataSlot[]>
  }, [inspector.slots, inspector.layout])

  // Which slots of each section a query finds, labels included.
  const find = useCallback(
    (slots: DataSlot[], search: string) =>
      new Set(
        slots
          .filter((slot) =>
            slotMatches(slot, search, { addressPrefix, known, label: meta[slot.index]?.label }),
          )
          .map((slot) => slot.index),
      ),
    [addressPrefix, known, meta],
  )
  const matches = useMemo(
    () => ({
      data: find(sections.data, query),
      callStack: find(sections.callStack, query),
      userStack: find(sections.userStack, query),
    }),
    [sections, query, find],
  )

  // The selected slot of each memory tab, kept here so a search can move it.
  const [selected, setSelected] = useState<Record<Section, number | null>>({
    data: null,
    callStack: null,
    userStack: null,
  })
  const [jump, setJump] = useState(0)

  // A new query selects the first hit of each memory tab, and leaves the
  // open tab as it is. The hits are counted again on every block; only a
  // new query moves the selection, so a block never pulls the list away.
  const changeQuery = (next: string) => {
    setQuery(next)
    setSelected((previous) => {
      const moved = { ...previous }
      for (const section of SECTIONS) {
        const [first] = find(sections[section], next)
        if (first !== undefined) moved[section] = first
      }
      return moved
    })
    setJump((count) => count + 1)
  }

  const [mapHits, setMapHits] = useState(0)

  if (inspector.notFound) {
    return <p className="text-[13px] text-[var(--muted)]">{t('inspector.notFound')}</p>
  }
  if (!contract) {
    return <p className="text-[13px] text-[var(--muted)]">…</p>
  }

  // A stack tab only for a stack the contract has.
  const changedIn = (slots: DataSlot[]) =>
    slots.some((slot) => inspector.changed?.indices.has(slot.index))
  const tabs: TabState[] = [
    { id: 'data', changed: changedIn(sections.data), hits: matches.data.size },
    ...(sections.callStack.length > 0
      ? [
          {
            id: 'callStack' as const,
            changed: changedIn(sections.callStack),
            hits: matches.callStack.size,
          },
        ]
      : []),
    ...(sections.userStack.length > 0
      ? [
          {
            id: 'userStack' as const,
            changed: changedIn(sections.userStack),
            hits: matches.userStack.size,
          },
        ]
      : []),
    { id: 'maps', hits: mapHits },
    { id: 'activity' },
  ]
  const shown = tabs.some((entry) => entry.id === tab) ? tab : 'data'

  // The note speaks of the contract's variables, which only the data tab holds.
  const memory = (section: Section, note: boolean) => (
    <Pane open={shown === section}>
      {note && <ViewNote id="contractData" terms={['dataStack']} />}
      <MemoryView
        slots={sections[section]}
        meta={meta}
        onMeta={setMeta}
        known={known}
        addressPrefix={addressPrefix}
        changed={inspector.changed}
        matches={matches[section]}
        selected={selected[section]}
        onSelect={(index) => setSelected((previous) => ({ ...previous, [section]: index }))}
        jump={jump}
        codeHash={contract.machineCodeHashId}
      />
    </Pane>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[13px]">
      <div className="shrink-0">
        <ViewNote id="contract" terms={['contract', 'activation', 'codeHash']} />
        <ContractHeader
          contract={contract}
          account={inspector.account}
          accounts={accounts}
          contacts={contacts}
        />
      </div>
      <div
        className="mt-4 flex min-h-[320px] flex-1 flex-col border p-3"
        style={{ borderColor: 'var(--border2)' }}
      >
        <ContractTabs
          tabs={tabs}
          active={shown}
          onSelect={setTab}
          query={query}
          onQuery={changeQuery}
        />
        {memory('data', true)}
        {sections.callStack.length > 0 && memory('callStack', false)}
        {sections.userStack.length > 0 && memory('userStack', false)}
        <Pane open={shown === 'maps'}>
          <Scroll>
            <ViewNote id="contractMaps" terms={['contractMap']} />
            <ContractMaps
              contractId={contractId}
              known={known}
              addressPrefix={addressPrefix}
              query={query}
              onHits={setMapHits}
            />
          </Scroll>
        </Pane>
        <Pane open={shown === 'activity'}>
          <Scroll>
            <div className="flex flex-wrap gap-6">
              <Direction
                direction="incoming"
                label={t('console.watch.incoming')}
                transactions={inspector.incoming}
                accounts={accounts}
                contacts={contacts}
              />
              <Direction
                direction="outgoing"
                label={t('console.watch.outgoing')}
                transactions={inspector.outgoing}
                accounts={accounts}
                contacts={contacts}
              />
            </div>
          </Scroll>
        </Pane>
      </div>
    </div>
  )
}

/**
 * One contract, on a page of its own.
 *
 * A route rather than a console tab: the tabs are state inside the console,
 * and a contract is something worth a link. The page keeps its own eye on
 * the chain through useNodeState, so everything below refreshes on a block
 * the same way the console does.
 */
export function ContractPage({ param }: { param: string }) {
  const { t } = useTranslation()
  const { state, nodeAddress } = useNodeState()
  const beginner = useBeginner()
  const contractId = parseContractId(param)

  if (state.kind === 'unreachable') {
    return (
      <div className={cn('mx-auto p-6', PAGE_WIDTH)}>
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <BeginnerMode on={beginner.beginner}>
      {/*
        Full height like the console from md up, so the tab panel scrolls in
        place. Below that the header alone fills the screen, so the page
        flows and each list scrolls within a height of its own instead.
      */}
      <div className={cn('mx-auto flex flex-col p-6 md:h-screen', PAGE_WIDTH)}>
        <AppHeader
          networkName={state.networkName}
          version={state.version}
          connection={state.connection}
          scanning={state.scanning}
          homeLink
        />
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] uppercase tracking-[1px] text-[var(--blue3)]">
            {t('inspector.title')}
          </span>
          <span className="flex items-center gap-3 text-[13px]">
            <span>
              <span className="text-[var(--muted)]">{t('console.chain.height')} </span>
              <span className="font-bold text-[var(--blue3)]">{state.height ?? '—'}</span>
            </span>
            <Link className="text-[var(--blue3)] underline" to="/console">
              {t('inspector.back')}
            </Link>
          </span>
        </div>
        {contractId === null ? (
          <p className="text-[13px] text-[var(--muted)]">{t('inspector.notFound')}</p>
        ) : (
          // Keyed by the contract: moving to another one through a link must
          // not carry over the search, the open map lookup, or the slots that
          // the next block's changes are measured against.
          <ContractBody key={contractId} contractId={contractId} height={state.height ?? null} />
        )}
      </div>
    </BeginnerMode>
  )
}
