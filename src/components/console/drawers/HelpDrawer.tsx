import { useTranslation } from 'react-i18next'
import { Toggle } from '@/components/console/Toggle'
import { ConsoleButton } from '@/components/console/ConsoleButton'

/**
 * Sound, theme and language moved into the app header, where they sit on
 * every page instead of behind a drawer on one. What is left is the way out
 * to the API documentation, and the two controls the first-visit question
 * sets by proxy — both reachable here forever after, because an answer given
 * once should never be a decision you are stuck with.
 */
export function HelpDrawer({
  beginner,
  onBeginner,
  tourActive,
  onStartTour,
  onStopTour,
}: {
  beginner: boolean
  onBeginner: (on: boolean) => void
  tourActive: boolean
  onStartTour: () => void
  onStopTour: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div>
        <Toggle checked={beginner} onChange={onBeginner} label={t('console.help.beginner')} />
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
          {t('console.help.beginnerNote')}
        </p>
      </div>

      <div>
        <ConsoleButton onClick={tourActive ? onStopTour : onStartTour}>
          {t(tourActive ? 'console.help.tourStop' : 'console.help.tour')}
        </ConsoleButton>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
          {t('console.help.tourNote')}
        </p>
      </div>

      <a
        className="text-[13px] text-[var(--blue3)] underline"
        href="/api-doc/"
        target="_blank"
        rel="noreferrer"
      >
        ↗ {t('entry.apiDocs.title')}
      </a>
    </div>
  )
}
