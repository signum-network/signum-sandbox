import { useTranslation } from 'react-i18next'
import type { Block } from '@signumjs/core'
import { nodeHost } from '@/lib/ledger'

export function BlocksView({
  blocks,
  onSelect,
}: {
  blocks: Block[]
  onSelect: (height: number) => void
}) {
  const { t } = useTranslation()

  return (
    <ul>
      {blocks.map((block) => {
        const count = block.numberOfTransactions
        return (
          <li
            key={block.block}
            className="flex items-center justify-between border-b py-2 text-[11px]"
            style={{ borderColor: 'var(--border2)' }}
          >
            <button className="text-left" onClick={() => onSelect(block.height)}>
              <span className="font-bold text-[var(--blue3)]">#{block.height}</span>
              <span className="text-[var(--muted)]">
                {' '}· {count === 0 ? t('console.blocks.empty') : t('console.blocks.count', { count })}
                {' '}· {t('console.blocks.forger')} {block.generatorRS}
              </span>
            </button>
            <a
              className="text-[var(--muted)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getBlock&height=${block.height}`}
            >
              ↗
            </a>
          </li>
        )
      })}
    </ul>
  )
}
