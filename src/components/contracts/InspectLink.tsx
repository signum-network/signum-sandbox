import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

/** The one way into the contract inspector, so every entry point looks the same. */
export function InspectLink({ contractId }: { contractId: string }) {
  const { t } = useTranslation()
  return (
    <Link
      className="text-[13px] text-[var(--blue3)] underline"
      to="/contracts/$contractId"
      params={{ contractId }}
    >
      {t('inspector.inspect')}
    </Link>
  )
}
