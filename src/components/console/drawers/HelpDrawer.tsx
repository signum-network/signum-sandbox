import { useTranslation } from 'react-i18next'

/**
 * Sound, theme and language moved into the app header, where they sit on
 * every page instead of behind a drawer on one. What is left is the way out
 * to the API documentation — and, in a later layer, beginner mode and the
 * tour, which is why the drawer stays rather than being folded away.
 */
export function HelpDrawer() {
  const { t } = useTranslation()
  return (
    <div className="mt-2 flex flex-col gap-3">
      <a
        className="text-[11px] text-[var(--blue3)] underline"
        href="/api-doc/"
        target="_blank"
        rel="noreferrer"
      >
        ↗ {t('entry.apiDocs.title')}
      </a>
    </div>
  )
}
