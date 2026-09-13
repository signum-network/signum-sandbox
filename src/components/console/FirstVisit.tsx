import { useTranslation } from 'react-i18next'
import { ConsoleButton } from './ConsoleButton'

/**
 * Asked once, in the stage, where the transaction list will be.
 *
 * Not a modal: a dialog that greys out the console before anyone has seen it
 * makes the first impression a barrier. Not on the start page either — that
 * page has one job, choosing between the API docs and the sandbox, and it
 * keeps it. This sits where the answer is about to matter.
 */
export function FirstVisit({ onAnswer }: { onAnswer: (beginner: boolean) => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-[15px] text-[var(--blue3)]">{t('console.firstVisit.title')}</p>
      <p className="max-w-[420px] text-[13px] leading-relaxed text-[var(--muted)]">
        {t('console.firstVisit.description')}
      </p>
      <div className="flex flex-wrap items-start justify-center gap-3">
        {([true, false] as const).map((beginner) => (
          <div key={String(beginner)} className="flex max-w-[190px] flex-col items-center gap-1">
            <ConsoleButton onClick={() => onAnswer(beginner)}>
              {t(beginner ? 'console.firstVisit.newHere' : 'console.firstVisit.oldHand')}
            </ConsoleButton>
            <span className="text-[12px] leading-relaxed text-[var(--muted)]">
              {t(beginner ? 'console.firstVisit.newHereNote' : 'console.firstVisit.oldHandNote')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
