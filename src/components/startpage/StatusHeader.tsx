import { useTranslation } from 'react-i18next'
import type { Connection } from '@/lib/nodeState'
import { AppHeader } from '@/components/AppHeader'

interface Props {
  networkName: string | null
  version: string | null
  connection: Connection
  scanning: boolean
}

/**
 * The start page's header: the shared one, plus the tagline that only belongs
 * on the page a newcomer lands on.
 */
export function StatusHeader({ networkName, version, connection, scanning }: Props) {
  const { t } = useTranslation()
  return (
    <AppHeader
      networkName={networkName}
      version={version}
      connection={connection}
      scanning={scanning}
      subtitle={
        <p className="mt-1 text-[13px] tracking-[1px] text-[var(--muted)]">{t('tagline')}</p>
      }
    />
  )
}
