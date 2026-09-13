import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GLOSSARY_TERMS, filterGlossary, helpKey, termKey, type GlossaryTerm } from '@/lib/glossary'
import { RowButton } from '@/components/console/ConsoleButton'
import { SearchField } from '@/components/console/views/SearchField'

/**
 * The sixteen words, in one place, to look up again.
 *
 * Deliberately not gated on beginner mode. The `i` icons beside the words
 * belong to the newcomer, but a reference does not: someone who answered "I
 * know my way around" can still want to check exactly what SRC44 covers, and
 * making them switch a mode on to find out would be a strange bargain.
 *
 * Closed by default, because sixteen explanations in a narrow drawer is a
 * wall of text — but open while a search is running, since a list of matching
 * words with the matching sentences hidden would answer nothing.
 */
export function Glossary() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<GlossaryTerm | null>(null)

  const entries = GLOSSARY_TERMS.map((id) => ({
    id,
    term: t(termKey(id)),
    help: t(helpKey(id)),
  }))
  const shown = filterGlossary(entries, query)
  const searching = query.trim() !== ''

  return (
    <div>
      <p className="mb-2 text-[12px] uppercase tracking-[1px] text-[var(--blue3)]">
        {t('console.help.glossary')}
      </p>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={t('console.help.glossarySearch')}
        fill
      />

      {shown.length === 0 && (
        <p className="mt-2 text-[12px] text-[var(--muted)]">{t('console.help.glossaryNoMatch')}</p>
      )}

      <ul className="mt-2">
        {shown.map(({ id, term, help }) => {
          const open = searching || opened === id
          return (
            <li key={id} className="border-b py-1" style={{ borderColor: 'var(--border2)' }}>
              <RowButton
                className="flex w-full items-center gap-2 text-left text-[12px] text-[var(--fg)]"
                onClick={() => setOpened(opened === id ? null : id)}
              >
                <span className="text-[var(--muted)]">{open ? '▾' : '▸'}</span>
                {term}
              </RowButton>
              {open && (
                <p className="mt-1 pl-4 text-[12px] leading-relaxed text-[var(--muted)]">{help}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
