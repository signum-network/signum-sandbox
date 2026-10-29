import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { slotReadings, type DataSlot, type KnownId, type SlotType } from '@/lib/contractData'
import type { SlotMeta } from '@/lib/contractLabels'
import { Identicon } from '@/components/Identicon'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { InspectLink } from './InspectLink'
import { WatchLink } from './WatchLink'

const TYPES: SlotType[] = ['unsigned', 'signed', 'string', 'bool', 'address']

function Reading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-[2px]">
      <span className="w-[72px] shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-all font-mono text-[12px]">{children}</span>
    </div>
  )
}

/**
 * Every reading of one slot, and the place to say what it is.
 *
 * The readings are all shown because the page cannot know which one is
 * meant. The type the person picks here is what the list shows from then
 * on, for this slot of every contract with the same code. A known account
 * id earns a suggestion, never a decision: the same number could as well
 * be a counter that happens to match.
 */
export function SlotDetail({
  slot,
  meta,
  onMeta,
  known,
  addressPrefix,
  codeHash,
}: {
  slot: DataSlot | undefined
  meta: SlotMeta | undefined
  onMeta: (index: number, patch: SlotMeta) => void
  known: Map<string, KnownId>
  addressPrefix: string
  codeHash: string
}) {
  const { t } = useTranslation()
  if (!slot) {
    return <p className="text-[var(--muted)]">{t('inspector.detail.empty')}</p>
  }

  const readings = slotReadings(slot, addressPrefix)
  const account = known.get(slot.decimal)
  const type = meta?.type

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-[2px] text-[var(--blue3)]">
        #{slot.index}
        {meta?.label ? ` · ${meta.label}` : ''}
      </div>

      <div>
        <Reading label={t('inspector.reading.unsigned')}>{readings.unsigned}</Reading>
        <Reading label={t('inspector.reading.signed')}>{readings.signed}</Reading>
        <Reading label={t('inspector.reading.string')}>
          {readings.string === null ? '—' : `"${readings.string}"`}
        </Reading>
        <Reading label={t('inspector.reading.bool')}>{String(readings.bool)}</Reading>
        <Reading label={t('inspector.reading.address')}>
          {readings.address === null ? (
            '—'
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Identicon value={readings.address} size={14} />
              {readings.address}
              {account && <span className="font-sans text-[var(--muted)]">· {account.name}</span>}
              {account &&
                (account.contract ? (
                  <InspectLink contractId={account.id} />
                ) : (
                  <WatchLink address={readings.address} />
                ))}
            </span>
          )}
        </Reading>
        <Reading label={t('inspector.reading.hex')}>{readings.hex}</Reading>
        <Reading label={t('inspector.reading.stored')}>{readings.stored}</Reading>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[var(--muted)]">{t('inspector.data.label')}</span>
        <input
          // A different slot or different code is a different label.
          key={`${codeHash}-${slot.index}`}
          className="border bg-transparent px-2 py-1 text-[13px] text-[var(--text)] outline-none"
          style={{ borderColor: 'var(--border2)' }}
          defaultValue={meta?.label ?? ''}
          placeholder={t('inspector.data.labelPlaceholder')}
          onBlur={(event) => onMeta(slot.index, { label: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[var(--muted)]">{t('inspector.type.label')}</span>
        <div className="flex flex-wrap gap-1">
          <ConsoleButton
            active={type === undefined}
            onClick={() => onMeta(slot.index, { type: undefined })}
          >
            {t('inspector.type.none')}
          </ConsoleButton>
          {TYPES.map((candidate) => (
            <ConsoleButton
              key={candidate}
              active={type === candidate}
              // Pressing the chosen type again takes it back.
              onClick={() =>
                onMeta(slot.index, { type: type === candidate ? undefined : candidate })
              }
            >
              {t(`inspector.reading.${candidate}`)}
            </ConsoleButton>
          ))}
        </div>
        {account && type === undefined && (
          <span className="text-[12px] text-[var(--muted)]">
            ◆ {t('inspector.type.suggestAddress', { name: account.name })}
          </span>
        )}
      </div>
    </div>
  )
}
