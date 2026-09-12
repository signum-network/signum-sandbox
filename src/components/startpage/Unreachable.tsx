import { useTranslation } from 'react-i18next'
import { Card, CardLabel } from '@/components/ui'

export function Unreachable({ nodeHost }: { nodeHost: string }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardLabel>{t('unreachable.title', { host: nodeHost })}</CardLabel>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{t('unreachable.description')}</p>
    </Card>
  )
}
