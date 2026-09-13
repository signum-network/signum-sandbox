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
  placeholder,
  fill,
}: {
  value: string
  onChange: (value: string) => void
  /** Overrides the stream's own wording. */
  placeholder?: string
  /** Takes the full width instead of the 240px the tab bar gives it. */
  fill?: boolean
}) {
  const { t } = useTranslation()

  return (
    <span
      className={`flex items-center border bg-transparent px-2 py-1${fill ? ' w-full' : ''}`}
      style={{ borderColor: 'var(--border2)', ...(fill ? {} : { minWidth: 240 }) }}
    >
      <input
        className="flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('console.search.placeholder')}
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
