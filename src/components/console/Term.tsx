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
 *
 * Several of these words are inside a button — the forge button, a row that
 * expands, a toggle — so the `i` stops the click going any further. Pressing
 * a help icon must never be pressing what it is explaining, and a newcomer
 * asking what forging is should not thereby forge.
 *
 * A word that appears once per row does not belong here. Fifty rows would
 * carry fifty identical icons explaining the same thing, which is not help
 * but wallpaper — those terms go in the view's note instead, where they are
 * said once above the list.
 */
export function Term({ id, children }: { id: GlossaryTerm; children?: ReactNode }) {
  const { t } = useTranslation()
  const beginner = useBeginnerMode()
  const label = children ?? t(termKey(id))

  if (!beginner) return <>{label}</>

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
        }}
        className="inline-flex"
        // The icon is a child of the word it explains, so it inherits the
        // word's typography — and half the labels in this console are set in
        // uppercase, which would render the lowercase "i" as an "I". The panel
        // escapes this through a portal and resets the same properties for
        // itself; this reset is for the glyph.
        style={{ textTransform: 'none', letterSpacing: 'normal' }}
      >
        <InfoTooltip text={t(helpKey(id))} />
      </span>
    </span>
  )
}
