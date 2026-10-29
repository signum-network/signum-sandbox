import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { SearchField } from '@/components/console/views/SearchField'
import { SPRINGS } from '@/motion'
import { ChangedDot } from './MemoryView'

export type ContractTab = 'data' | 'callStack' | 'userStack' | 'maps' | 'activity'

export interface TabState {
  id: ContractTab
  /** Search hits in this tab; nothing is shown for 0. */
  hits?: number
  /** Whether a slot in this tab changed in the last block that changed any. */
  changed?: boolean
}

/**
 * The contract page's tab bar, built like the console's: the same buttons,
 * a marker that travels between them, and the search field on the right.
 * Each tab says how many search hits it holds and whether something in it
 * just changed, so a hit or a change in a tab that is not open is not lost.
 */
export function ContractTabs({
  tabs,
  active,
  onSelect,
  query,
  onQuery,
  hitCount,
  onStep,
}: {
  tabs: TabState[]
  active: ContractTab
  onSelect: (tab: ContractTab) => void
  query: string
  onQuery: (query: string) => void
  /** Where the selection stands among the memory's hits, while a query is set. */
  hitCount: { position: number | null; total: number }
  onStep: (direction: 1 | -1) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(({ id, hits, changed }) => (
          <span key={id} className="relative flex">
            {active === id && (
              <motion.span
                layoutId="contract-tab-marker"
                className="absolute inset-0"
                style={{ background: 'rgba(0,102,255,.18)', zIndex: -1 }}
                transition={SPRINGS.panel}
              />
            )}
            <ConsoleButton
              active={active === id}
              onClick={() => onSelect(id)}
              style={{
                background: 'transparent',
                color: active === id ? 'var(--blue3)' : 'var(--muted)',
              }}
            >
              <span className="flex items-center gap-2">
                {t(`inspector.tab.${id}`)}
                {changed && <ChangedDot />}
                {hits ? (
                  <span className="tabular-nums text-[var(--blue3)]">{hits}</span>
                ) : null}
              </span>
            </ConsoleButton>
          </span>
        ))}
      </div>
      <span className="flex items-center gap-2">
        <SearchField
          value={query}
          onChange={onQuery}
          placeholder={t('inspector.search')}
          onEnter={(backwards) => onStep(backwards ? -1 : 1)}
        />
        {query.trim() !== '' && (
          <>
            <span className="min-w-[48px] text-right text-[12px] tabular-nums text-[var(--muted)]">
              {hitCount.position ?? '–'} / {hitCount.total}
            </span>
            <ConsoleButton
              disabled={hitCount.total === 0}
              title={t('inspector.hit.previous')}
              onClick={() => onStep(-1)}
            >
              ▲
            </ConsoleButton>
            <ConsoleButton
              disabled={hitCount.total === 0}
              title={t('inspector.hit.next')}
              onClick={() => onStep(1)}
            >
              ▼
            </ConsoleButton>
          </>
        )}
      </span>
    </div>
  )
}
