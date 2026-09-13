import { useTranslation } from 'react-i18next'
import { useBeginnerMode } from './BeginnerMode'

/**
 * One sentence saying what you are looking at.
 *
 * Beginner mode only, and deliberately not a tooltip: a view needs its
 * context before you have decided which word you did not understand.
 */
export function ViewNote({ id }: { id: string }) {
  const beginner = useBeginnerMode()
  const { t } = useTranslation()
  if (!beginner) return null
  return (
    <p className="mb-2 shrink-0 text-[10px] leading-relaxed text-[var(--muted)]">
      {t(`console.note.${id}`)}
    </p>
  )
}
