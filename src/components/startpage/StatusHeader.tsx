import { useTranslation } from 'react-i18next'
import type { Connection } from '@/lib/nodeState'
import { AudioToggle } from '@/components/controls/AudioToggle'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'

interface Props {
  networkName: string | null
  version: string | null
  connection: Connection
  scanning: boolean
}

export function StatusHeader({ networkName, version, connection, scanning }: Props) {
  const { t } = useTranslation()
  const colour = connection === 'live' ? 'var(--green)' : 'var(--amber)'

  return (
    <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h1
          className="text-[22px] font-black tracking-[3px] text-[var(--blue3)]"
          style={{ fontFamily: 'Orbitron, ui-monospace, monospace' }}
        >
          SIGNUM SANDBOX
        </h1>
        <p className="mt-1 text-[11px] tracking-[1px] text-[var(--muted)]">{t('tagline')}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] tracking-[1px] text-[var(--muted)]">
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ background: colour, boxShadow: `0 0 6px ${colour}` }}
          />
          <span>{t(`status.${connection}`)}</span>
          {networkName && <span>· {networkName}</span>}
          {version && <span>· {version}</span>}
          {scanning && <span>· {t('status.scanning')}</span>}
        </div>
        <AudioToggle />
        <ThemeSwitcher />
      </div>
    </header>
  )
}
