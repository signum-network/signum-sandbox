import { useTranslation } from 'react-i18next'

export function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <input
      className="border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      style={{ borderColor: 'var(--border2)', minWidth: 220 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`🔍 ${t('console.search.placeholder')}`}
    />
  )
}
