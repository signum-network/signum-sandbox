import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

/**
 * The way from the inspector to watching an account in the console, the
 * counterpart of InspectLink for an account that is not a contract. It
 * carries the address: a numeric id in the URL would be read as a number
 * and lose its last digits.
 */
export function WatchLink({ address }: { address: string }) {
  const { t } = useTranslation()
  return (
    <Link
      className="font-sans text-[13px] text-[var(--blue3)] underline"
      to="/console"
      search={{ watch: address }}
    >
      {t('console.watch.watch')}
    </Link>
  )
}
