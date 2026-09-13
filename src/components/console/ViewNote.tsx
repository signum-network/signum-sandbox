import { useTranslation } from 'react-i18next'
import type { GlossaryTerm } from '@/lib/glossary'
import { useBeginnerMode } from './BeginnerMode'
import { Term } from './Term'

/**
 * One sentence saying what you are looking at, and the words this view uses
 * that a newcomer may not have.
 *
 * Beginner mode only, and deliberately not a tooltip: a view needs its
 * context before you have decided which word you did not understand.
 *
 * `terms` is where the vocabulary of a list lives. A word that appears in
 * every row cannot carry its own icon — fifty rows would repeat the same
 * explanation fifty times — so the list says it once, up here, above the rows
 * that use it.
 */
export function ViewNote({ id, terms = [] }: { id: string; terms?: GlossaryTerm[] }) {
  const beginner = useBeginnerMode()
  const { t } = useTranslation()
  if (!beginner) return null

  return (
    <div className="mb-2 shrink-0">
      <p className="text-[12px] leading-relaxed text-[var(--muted)]">
        {t(`console.note.${id}`)}
      </p>
      {terms.length > 0 && (
        <p
          className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--muted)]"
        >
          {terms.map((term) => (
            <Term key={term} id={term} />
          ))}
        </p>
      )}
    </div>
  )
}
