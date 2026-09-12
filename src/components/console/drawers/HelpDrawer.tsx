import { useTranslation } from 'react-i18next'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { AudioToggle } from '@/components/controls/AudioToggle'

export function HelpDrawer() {
  const { t } = useTranslation()
  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <AudioToggle />
      </div>
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
