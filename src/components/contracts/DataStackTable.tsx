import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataSlot, KnownId, StackLayout } from '@/lib/contractData'
import { toAddress } from '@/lib/recipient'
import { Identicon } from '@/components/Identicon'
import { Term } from '@/components/console/Term'
import { useValueFlash } from '@/motion'
import { RowButton } from '@/components/console/ConsoleButton'
import { InspectLink } from './InspectLink'

const COLUMNS = ['index', 'label', 'raw', 'hex', 'decimal', 'signed', 'text', 'account'] as const

type Changed = { indices: Set<number>; height: number | null } | null

/**
 * One slot. It both flashes and keeps a marker, because the two answer
 * different questions: the flash shows the moment a value changes, and the
 * marker still answers "what did my last call change?" after that moment
 * has passed.
 */
function SlotRow({
  slot,
  label,
  onLabel,
  known,
  addressPrefix,
  changed,
}: {
  slot: DataSlot
  label: string
  onLabel: (index: number, label: string) => void
  known: Map<string, KnownId>
  addressPrefix: string
  changed: Changed
}) {
  const { t } = useTranslation()
  const flash = useValueFlash<HTMLTableRowElement>(slot.raw)
  const marked = changed?.indices.has(slot.index) ?? false
  const account = known.get(slot.decimal)

  return (
    <tr
      ref={flash}
      className="border-b"
      style={{
        borderColor: 'var(--border2)',
        boxShadow: marked ? 'inset 2px 0 0 var(--amber)' : undefined,
      }}
    >
      <td className="px-2 py-[2px] text-right text-[var(--muted)]">
        {marked && (
          <span
            className="mr-1 text-[var(--amber)]"
            title={t('inspector.data.changed', { height: changed?.height ?? '—' })}
          >
            Δ
          </span>
        )}
        {slot.index}
      </td>
      <td className="px-2 py-[2px]">
        <input
          className="w-[110px] bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)] placeholder:opacity-50"
          defaultValue={label}
          placeholder={t('inspector.data.labelPlaceholder')}
          onBlur={(event) => onLabel(slot.index, event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </td>
      <td className="px-2 py-[2px] text-[var(--muted)]">{slot.raw}</td>
      <td className="px-2 py-[2px]">{slot.hex}</td>
      <td className="px-2 py-[2px] text-right">{slot.decimal}</td>
      <td className="px-2 py-[2px] text-right">{slot.signed ?? ''}</td>
      <td className="px-2 py-[2px]">{slot.text === null ? '' : `"${slot.text}"`}</td>
      <td className="px-2 py-[2px]">
        {account && (
          <span className="flex items-center gap-2 font-sans">
            <Identicon value={toAddress(account.id, addressPrefix)} size={14} />
            {account.name}
            {account.contract && <InspectLink contractId={account.id} />}
          </span>
        )}
      </td>
    </tr>
  )
}

/** A row that names the part of memory the rows below it belong to. */
function GroupRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={COLUMNS.length}
        className="px-2 pb-1 pt-3 font-sans text-[11px] uppercase tracking-[1px] text-[var(--blue3)]"
      >
        {label}
      </td>
    </tr>
  )
}

/**
 * A contract's data stack, one row per 8-byte slot.
 *
 * The node hands over the whole memory, so the call and user stacks come
 * after the variables. They are what the contract was doing mid-run rather
 * than what it keeps, so they stay folded away until asked for. Without a
 * layout every slot is shown as data.
 */
export function DataStackTable({
  slots,
  layout,
  changed,
  labels,
  onLabel,
  known,
  addressPrefix,
  codeHash,
}: {
  slots: DataSlot[]
  layout: StackLayout | null
  changed: Changed
  labels: Record<number, string>
  onLabel: (index: number, label: string) => void
  known: Map<string, KnownId>
  addressPrefix: string
  codeHash: string
}) {
  const { t } = useTranslation()
  const [showStack, setShowStack] = useState(false)

  const dataCount = layout ? Math.min(layout.dataSlots, slots.length) : slots.length
  const data = slots.slice(0, dataCount)
  const callStack = layout ? slots.slice(dataCount, dataCount + layout.callStackSlots) : []
  const userStack = layout ? slots.slice(dataCount + layout.callStackSlots) : []
  const stackSlots = callStack.length + userStack.length

  const rows = (part: DataSlot[]) =>
    part.map((slot) => (
      <SlotRow
        // The code hash in the key resets the inputs when the code, and so
        // the meaning of every slot, is a different one.
        key={`${codeHash}-${slot.index}`}
        slot={slot}
        label={labels[slot.index] ?? ''}
        onLabel={onLabel}
        known={known}
        addressPrefix={addressPrefix}
        changed={changed}
      />
    ))

  return (
    <div className="mt-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[2px] text-[var(--blue3)]">
          <Term id="dataStack" />
        </span>
        <span className="flex items-baseline gap-3 text-[12px] text-[var(--muted)]">
          {stackSlots > 0
            ? t('inspector.data.sizeWithStack', {
                bytes: data.length * 8,
                slots: data.length,
                stackBytes: stackSlots * 8,
              })
            : t('inspector.data.size', { bytes: data.length * 8, slots: data.length })}
          {stackSlots > 0 && (
            <RowButton
              className="text-[var(--blue3)] underline"
              onClick={() => setShowStack((shown) => !shown)}
            >
              {t(showStack ? 'inspector.data.hideStack' : 'inspector.data.showStack')}
            </RowButton>
          )}
        </span>
      </div>
      {slots.length === 0 ? (
        <p className="text-[13px] text-[var(--muted)]">{t('inspector.data.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap font-mono text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border2)' }}>
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="px-2 py-1 text-left text-[11px] font-normal uppercase tracking-[1px] text-[var(--muted)]"
                  >
                    {t(`inspector.data.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows(data)}
              {showStack && callStack.length > 0 && (
                <>
                  <GroupRow label={t('inspector.data.callStack')} />
                  {rows(callStack)}
                </>
              )}
              {showStack && userStack.length > 0 && (
                <>
                  <GroupRow label={t('inspector.data.userStack')} />
                  {rows(userStack)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
