import { useTranslation } from 'react-i18next'
import { RowButton } from '../ConsoleButton'

/**
 * The emoji magnifier that used to sit in the placeholder rendered in the
 * system's own colour font — the one glyph on screen that ignored the theme.
 * The field says what it takes in words instead, and gains the thing it was
 * actually missing: a way to empty it again without selecting the text.
 */
export function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <span
      className="flex items-center border bg-transparent px-2 py-1"
      style={{ borderColor: 'var(--border2)', minWidth: 240 }}
    >
      <input
        className="flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('console.search.placeholder')}
      />
      {value !== '' && (
        <RowButton
          className="ml-2 text-[13px] leading-none text-[var(--muted)] hover:text-[var(--blue3)]"
          onClick={() => onChange('')}
        >
          ✕
        </RowButton>
      )}
    </span>
  )
}
