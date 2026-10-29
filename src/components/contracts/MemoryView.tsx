import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { slotValue, toPages, type DataSlot, type KnownId } from '@/lib/contractData'
import type { SlotMeta } from '@/lib/contractLabels'
import { RowButton } from '@/components/console/ConsoleButton'
import { useValueFlash } from '@/motion'
import { cn } from '@/lib/utils'
import { SlotDetail } from './SlotDetail'

type Changed = { indices: Set<number>; height: number | null } | null

/** The amber dot for "something here changed", the same on pages and tabs. */
export function ChangedDot() {
  return (
    <span
      className="inline-block h-[6px] w-[6px] rounded-full"
      style={{ background: 'var(--amber)' }}
    />
  )
}

/**
 * One slot in the list. It flashes when its bytes change and keeps a Δ
 * afterwards, because the flash shows the moment and the marker still
 * answers "what did my last call change?" once the moment has passed.
 */
function SlotRow({
  slot,
  meta,
  known,
  addressPrefix,
  changed,
  hit,
  selected,
  onSelect,
}: {
  slot: DataSlot
  meta: SlotMeta | undefined
  known: Map<string, KnownId>
  addressPrefix: string
  changed: Changed
  hit: boolean
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const flash = useValueFlash<HTMLLIElement>(slot.raw)
  const marked = changed?.indices.has(slot.index) ?? false
  // A hint, not a reading: the slot holds a number some known account has.
  const knownId = slot.decimal !== '0' && known.has(slot.decimal)

  return (
    <li
      ref={flash}
      data-index={slot.index}
      style={{
        background: selected ? 'rgba(0,102,255,.18)' : undefined,
        boxShadow: marked
          ? 'inset 2px 0 0 var(--amber)'
          : hit
            ? 'inset 2px 0 0 var(--blue3)'
            : undefined,
      }}
    >
      <RowButton
        className="flex w-full items-center gap-3 px-2 py-[2px] text-left font-mono text-[12px]"
        onClick={onSelect}
      >
        <span className="w-[44px] shrink-0 text-right text-[var(--muted)]">
          {marked && (
            <span
              className="mr-1 text-[var(--amber)]"
              title={t('inspector.data.changed', { height: changed?.height ?? '—' })}
            >
              Δ
            </span>
          )}
          {slot.index}
        </span>
        <span className="w-[120px] shrink-0 truncate font-sans text-[var(--text)]">
          {meta?.label ?? ''}
        </span>
        <span
          className={cn('min-w-0 flex-1 truncate', hit ? 'text-[var(--blue3)]' : 'text-[var(--text)]')}
        >
          {knownId && <span className="mr-1 text-[var(--blue3)]">◆</span>}
          {slotValue(slot, meta?.type, addressPrefix)}
        </span>
      </RowButton>
    </li>
  )
}

/**
 * One part of a contract's memory, the AT's own 256-byte pages one at a
 * time, with the selected slot opened beside the list.
 *
 * The list shows one value per slot, in the type the person set for it, or
 * hex when none is set. Guessing would be wrong too often: a slot is a long,
 * and whether it is a counter, a flag or an account only the code knows.
 */
export function MemoryView({
  slots,
  meta,
  onMeta,
  known,
  addressPrefix,
  changed,
  matches,
  query,
  codeHash,
}: {
  slots: DataSlot[]
  meta: Record<number, SlotMeta>
  onMeta: (index: number, patch: SlotMeta) => void
  known: Map<string, KnownId>
  addressPrefix: string
  changed: Changed
  matches: Set<number>
  query: string
  codeHash: string
}) {
  const { t } = useTranslation()
  const pages = toPages(slots)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)

  // A new query opens the first hit. Only a new query: the hits are counted
  // again on every block, and a refresh must not pull the list away from
  // where someone is reading.
  const list = useRef<HTMLUListElement>(null)
  // Counts jumps rather than flagging one: a jump to the slot that is already
  // selected changes no page and no selection, and must still scroll.
  const [jumps, setJumps] = useState(0)
  useEffect(() => {
    const first = slots.find((slot) => matches.has(slot.index))
    if (!first) return
    setPage(pages.findIndex((slotsOfPage) => slotsOfPage.includes(first)))
    setSelected(first.index)
    setJumps((count) => count + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  // Once the page with the hit is drawn, scroll the hit into the list's view.
  useEffect(() => {
    if (jumps === 0) return
    list.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumps])

  const current = pages[Math.min(page, pages.length - 1)] ?? []
  const selectedSlot = slots.find((slot) => slot.index === selected) ?? current[0]

  if (slots.length === 0) {
    return <p className="text-[var(--muted)]">{t('inspector.data.empty')}</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
      <div className="flex min-h-[160px] min-w-0 flex-1 flex-col">
        {pages.length > 1 && (
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="text-[var(--muted)]">{t('inspector.page')}</span>
            {pages.map((slotsOfPage, number) => {
              const hits = slotsOfPage.filter((slot) => matches.has(slot.index)).length
              const changedHere = slotsOfPage.some((slot) => changed?.indices.has(slot.index))
              return (
                <RowButton
                  key={number}
                  className={cn(
                    'flex items-center gap-1 tabular-nums',
                    number === page ? 'text-[var(--blue3)] underline' : 'text-[var(--muted)]',
                  )}
                  onClick={() => setPage(number)}
                >
                  {number}
                  {changedHere && <ChangedDot />}
                  {hits > 0 && <span className="text-[10px] text-[var(--blue3)]">{hits}</span>}
                </RowButton>
              )
            })}
          </div>
        )}
        <ul
          ref={list}
          className="themed-scroll console-scroll max-h-[50vh] min-h-0 flex-1 overflow-y-auto pr-2 md:max-h-none"
        >
          {current.map((slot) => (
            <SlotRow
              key={slot.index}
              slot={slot}
              meta={meta[slot.index]}
              known={known}
              addressPrefix={addressPrefix}
              changed={changed}
              hit={matches.has(slot.index)}
              selected={slot.index === selectedSlot?.index}
              onSelect={() => setSelected(slot.index)}
            />
          ))}
        </ul>
        <div className="mt-1 shrink-0 text-[11px] text-[var(--muted)]">
          {t('inspector.data.size', { bytes: slots.length * 8, slots: slots.length })}
        </div>
      </div>
      <div
        className="themed-scroll console-scroll shrink-0 overflow-y-auto border-t pt-3 md:w-[320px] md:border-l md:border-t-0 md:pl-3 md:pt-0"
        style={{ borderColor: 'var(--border2)' }}
      >
        <SlotDetail
          slot={selectedSlot}
          meta={selectedSlot ? meta[selectedSlot.index] : undefined}
          onMeta={onMeta}
          known={known}
          addressPrefix={addressPrefix}
          codeHash={codeHash}
        />
      </div>
    </div>
  )
}
