import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { staleVersion } from '@/lib/uiVersion'

/**
 * Says so when the page on screen is older than the installed sandbox, and
 * offers the reload that fixes it. A banner rather than a reload of its own:
 * the check also runs when the window regains focus, and reloading then
 * could throw away a half-written send.
 */
export function StaleBanner() {
  const { t } = useTranslation()
  const [installed, setInstalled] = useState<string | null>(null)

  useEffect(() => {
    const check = () => {
      // no-store is the point: this is the one request the browser's cache
      // must not answer, since the cache is what kept the old page around.
      fetch('/version.json', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((served: unknown) => setInstalled(staleVersion(__SANDBOX_VERSION__, served)))
        .catch(() => undefined)
    }
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  if (!installed) return null
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 border-b px-4 py-2 text-[13px]"
      style={{ borderColor: 'var(--blue2)', background: 'var(--bg2)', color: 'var(--fg)' }}
    >
      <span>{t('stale.message', { installed, running: __SANDBOX_VERSION__ })}</span>
      <ConsoleButton onClick={() => window.location.reload()}>{t('stale.reload')}</ConsoleButton>
    </div>
  )
}
