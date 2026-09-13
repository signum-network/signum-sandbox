import { useTranslation } from 'react-i18next'
import type { CustomField } from '@/lib/src44'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { TextInput } from './fields'

/**
 * Custom fields as rows rather than as text to be parsed.
 *
 * The first version asked for `key = value`, one per line — a syntax to
 * remember, with an ambiguity about the second equals sign and no way to see
 * whether a line had been understood. Two inputs per row say the same thing
 * without a convention, and an empty row is simply an empty row.
 */
export function CustomFields({
  fields,
  onChange,
}: {
  fields: CustomField[]
  onChange: (fields: CustomField[]) => void
}) {
  const { t } = useTranslation()

  const set = (index: number, field: Partial<CustomField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...field } : f)))

  return (
    <div className="mb-2">
      <span className="mb-1 block text-[9px] uppercase tracking-[1px] text-[var(--muted)]">
        {t('console.src44.custom')}
      </span>

      {fields.map((field, index) => (
        <div key={index} className="mb-1 flex items-center gap-2">
          <span className="w-[38%]">
            <TextInput
              value={field.key}
              onChange={(v) => set(index, { key: v })}
              placeholder={t('console.src44.customKey')}
            />
          </span>
          <span className="flex-1">
            <TextInput
              value={field.value}
              onChange={(v) => set(index, { value: v })}
              placeholder={t('console.src44.customValue')}
            />
          </span>
          <RowButton
            className="text-[11px] leading-none text-[var(--muted)] hover:text-[var(--mag)]"
            onClick={() => onChange(fields.filter((_, i) => i !== index))}
          >
            ✕
          </RowButton>
        </div>
      ))}

      <ConsoleButton onClick={() => onChange([...fields, { key: '', value: '' }])}>
        {t('console.src44.addField')}
      </ConsoleButton>
    </div>
  )
}
