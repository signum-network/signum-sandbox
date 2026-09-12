import { useTranslation } from 'react-i18next'
import { Card, CardLabel, AnimatedNumber } from '@/components/ui'
import { relativeParts } from '@/lib/nodeState'

interface Props {
  height: number | null
  lastBlockAgeMs: number | null
  cumulativeDifficulty: string | null
}

const PLACEHOLDER = '—'

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      <div className="text-[20px] font-bold tracking-[-.5px] text-[var(--text)]">{children}</div>
    </div>
  )
}

export function NodeStatePanel({ height, lastBlockAgeMs, cumulativeDifficulty }: Props) {
  const { t, i18n } = useTranslation()

  const lastBlock = () => {
    if (lastBlockAgeMs === null) return PLACEHOLDER
    const { value, unit } = relativeParts(lastBlockAgeMs)
    return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }).format(value, unit)
  }

  return (
    <Card>
      <CardLabel>{t('panel.nodeState')}</CardLabel>
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
        <Metric label={t('tile.height')}>
          {height === null ? PLACEHOLDER : <AnimatedNumber value={height} />}
        </Metric>
        <Metric label={t('tile.lastBlock')}>{lastBlock()}</Metric>
        <Metric label={t('tile.difficulty')}>
          {cumulativeDifficulty === null
            ? PLACEHOLDER
            : BigInt(cumulativeDifficulty).toLocaleString(i18n.language)}
        </Metric>
      </div>
    </Card>
  )
}
