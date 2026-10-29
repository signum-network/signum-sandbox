import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  moveSlot,
  PAGE_SLOTS,
  slotValue,
  toPages,
  type DataSlot,
  type KnownId,
} from '@/lib/contractData'
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
 *
 * The page shown is the one holding the selected slot, so the detail panel
 * never shows a slot from a page out of sight.
 */
export function MemoryView({
  slots,
  meta,
  onMeta,
  known,
  addressPrefix,
  changed,
  matches,
  selected,
  onSelect,
  jump,
  codeHash,
}: {
  slots: DataSlot[]
  meta: Record<number, SlotMeta>
  onMeta: (index: number, patch: SlotMeta) => void
  known: Map<string, KnownId>
  addressPrefix: string
  changed: Changed
  matches: Set<number>
  /** The selected slot's index; null selects the first one. */
  selected: number | null
  onSelect: (index: number) => void
  /**
   * Counts jumps from outside, to a search hit. A jump to the slot that is
   * already selected changes nothing else and must still scroll.
   */
  jump: number
  codeHash: string
}) {
  const { t } = useTranslation()
  const pages = toPages(slots)
  const position = Math.max(
    0,
    slots.findIndex((slot) => slot.index === selected),
  )
  const selectedSlot = slots[position]
  const page = Math.floor(position / PAGE_SLOTS)
  const current = pages[page] ?? []

  // Keep the selected row in the list's view, whether the selection came
  // from a key, a page number or a search. A new block selects nothing and
  // so never pulls the list away from where someone is reading.
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${selectedSlot?.index}"]`)
      ?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot?.index, jump])

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const next = moveSlot(slots.length, position, event.key)
    if (next === null) return
    event.preventDefault()
    // The focused row may be on the page that is about to go; the list
    // keeps the focus so the next key still arrives.
    list.current?.focus({ preventScroll: true })
    onSelect(slots[next].index)
  }

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
                  onClick={() => onSelect(slotsOfPage[0].index)}
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
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="themed-scroll console-scroll max-h-[50vh] min-h-0 flex-1 overflow-y-auto pr-2 outline-none md:max-h-none"
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
              onSelect={() => onSelect(slot.index)}
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
