import { useTranslation } from 'react-i18next'
import { ConsoleButton } from './ConsoleButton'

/**
 * Sits under a list and says where in it you are.
 *
 * It renders even on a single page, deliberately: the count is the useful
 * half — "340 blocks, showing the newest 50" answers a question the list
 * itself cannot, and a control that appears and disappears with the data
 * would move everything under it.
 */
export function Pager({
  page,
  pages,
  from,
  to,
  total,
  onPage,
}: {
  page: number
  pages: number
  from: number
  to: number
  total: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="mt-2 flex items-center gap-3 border-t pt-2 text-[10px] text-[var(--muted)]"
      style={{ borderColor: 'var(--border2)' }}
    >
      <span className="tabular-nums">{t('console.pager.range', { from, to, total })}</span>
      <span className="ml-auto flex items-center gap-2">
        <ConsoleButton disabled={page <= 0} onClick={() => onPage(page - 1)}>
          ←
        </ConsoleButton>
        <span className="tabular-nums">
          {t('console.pager.page', { page: page + 1, pages })}
        </span>
        <ConsoleButton disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          →
        </ConsoleButton>
      </span>
    </div>
  )
}
