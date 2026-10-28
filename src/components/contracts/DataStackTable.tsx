import { useTranslation } from 'react-i18next'
import type { DataSlot, KnownId } from '@/lib/contractData'
import { toAddress } from '@/lib/recipient'
import { Identicon } from '@/components/Identicon'
import { Term } from '@/components/console/Term'
import { useValueFlash } from '@/motion'
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

/** A contract's data stack, one row per 8-byte slot. */
export function DataStackTable({
  slots,
  changed,
  labels,
  onLabel,
  known,
  addressPrefix,
  codeHash,
}: {
  slots: DataSlot[]
  changed: Changed
  labels: Record<number, string>
  onLabel: (index: number, label: string) => void
  known: Map<string, KnownId>
  addressPrefix: string
  codeHash: string
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[2px] text-[var(--blue3)]">
          <Term id="dataStack" />
        </span>
        <span className="text-[12px] text-[var(--muted)]">
          {t('inspector.data.size', { bytes: slots.length * 8, slots: slots.length })}
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
              {slots.map((slot) => (
                <SlotRow
                  // The code hash in the key resets the inputs when the code,
                  // and so the meaning of every slot, is a different one.
                  key={`${codeHash}-${slot.index}`}
                  slot={slot}
                  label={labels[slot.index] ?? ''}
                  onLabel={onLabel}
                  known={known}
                  addressPrefix={addressPrefix}
                  changed={changed}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
