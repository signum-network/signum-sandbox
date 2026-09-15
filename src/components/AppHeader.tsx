import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import type { Connection } from '@/lib/nodeState'
import { AudioToggle } from '@/components/controls/AudioToggle'
import { MotionToggle } from '@/components/controls/MotionToggle'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { LanguageSelect } from '@/components/controls/LanguageSelect'
import { Logomark } from '@/components/Logomark'

/**
 * The one header both the start page and the console wear.
 *
 * Everything in it is about the app rather than about the chain: who this is,
 * whether the node is answering, and the three settings a person changes for
 * themselves — sound, theme, language. Chain controls live in the console's
 * own bar below, so nothing here moves when a block arrives.
 */
export function AppHeader({
  networkName,
  version,
  connection,
  scanning,
  subtitle,
  homeLink,
}: {
  networkName: string | null
  version: string | null
  connection: Connection
  scanning: boolean
  /** Shown under the wordmark; the start page's tagline, or nothing. */
  subtitle?: ReactNode
  /** True on pages that are not the start page, making the wordmark the way back. */
  homeLink?: boolean
}) {
  const { t } = useTranslation()
  const colour = connection === 'live' ? 'var(--green)' : 'var(--amber)'

  const wordmark = (
    <h1
      className="flex items-center gap-3 text-[22px] font-black tracking-[3px] text-[var(--blue3)]"
      style={{ fontFamily: 'Orbitron, ui-monospace, monospace' }}
    >
      <Logomark />
      SIGNUM SANDBOX
    </h1>
  )

  return (
    <header className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div>
        {homeLink ? (
          <Link to="/" title={t('console.back')}>
            {wordmark}
          </Link>
        ) : (
          wordmark
        )}
        {subtitle}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[12px] tracking-[1px] text-[var(--muted)]">
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ background: colour, boxShadow: `0 0 6px ${colour}` }}
          />
          <span>{t(`status.${connection}`)}</span>
          {networkName && <span>· {networkName}</span>}
          {version && <span>· {version}</span>}
          {scanning && <span>· {t('status.scanning')}</span>}
        </div>
        <MotionToggle />
        <AudioToggle />
        <ThemeSwitcher />
        <LanguageSelect />
      </div>
    </header>
  )
}
