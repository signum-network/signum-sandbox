import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { helpKey, termKey, type GlossaryTerm } from '@/lib/glossary'
import { useBeginnerMode } from './BeginnerMode'

/**
 * A domain word, and in beginner mode the `i` that explains it.
 *
 * Outside beginner mode it renders the word and nothing else — no wrapper,
 * no spacing change — so switching the mode off leaves the console laid out
 * exactly as it was before any of this existed.
 *
 * `children` is for the places where the surrounding sentence needs its own
 * wording: the tooltip still comes from the glossary, but the visible word is
 * whatever fits the line.
 */
export function Term({ id, children }: { id: GlossaryTerm; children?: ReactNode }) {
  const { t } = useTranslation()
  const beginner = useBeginnerMode()
  const label = children ?? t(termKey(id))

  if (!beginner) return <>{label}</>

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <InfoTooltip text={t(helpKey(id))} />
    </span>
  )
}
