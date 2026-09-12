import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeState } from '@/lib/nodeState'
import type { AccountStore } from '@/hooks/useAccounts'
import { useForge } from '@/hooks/useForge'

export function Header({
  state,
  accounts,
  onOpenDrawer,
}: {
  state: Extract<NodeState, { kind: 'ready' }>
  accounts: AccountStore
  onOpenDrawer: (drawer: 'send' | 'chain' | 'help') => void
}) {
  const { t } = useTranslation()
  const { forgeOnce, busy, auto, setAuto, canForge, error } = useForge(accounts.forger)
  const [requested, setRequested] = useState(false)

  // submitNonce reports success even when several calls collapse into a single
  // block, so the button promises a request, not a block. The height beside it
  // is what actually answers whether one appeared. A request and a failure are
  // mutually exclusive, so "requested" only lights up once forgeOnce actually
  // succeeded — on failure useForge's own error takes that spot instead.
  const forgeClicked = async () => {
    const ok = await forgeOnce()
    if (!ok) return
    setRequested(true)
    setTimeout(() => setRequested(false), 3000)
  }

  const button = 'border px-3 py-1 text-[10px] uppercase tracking-[1px]'
  const border = { borderColor: 'var(--border2)' }

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-2 border p-3"
      style={border}
    >
      <span className="text-[11px]">
        <span className="font-bold text-[var(--blue3)]">{state.networkName ?? '—'}</span>
        <span className="text-[var(--muted)]">
          {' '}· {state.version ?? '—'} · {t(`status.${state.connection}`)} ·{' '}
          {t('console.chain.height')} {state.height ?? '—'}
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-2">
        <button
          className={button}
          style={{ ...border, color: canForge ? 'var(--blue3)' : 'var(--muted)' }}
          disabled={!canForge || busy}
          onClick={() => void forgeClicked()}
        >
          ⛏ {t('console.forge.action')}
        </button>

        {requested && (
          <span className="text-[10px] text-[var(--muted)]">{t('console.forge.requested')}</span>
        )}
        {!requested && error && (
          <span className="text-[10px] text-[var(--mag)]">
            {t('console.forge.failed', { message: error })}
          </span>
        )}

        <select
          className="border bg-transparent px-2 py-1 text-[10px] text-[var(--fg)]"
          style={border}
          value={accounts.forgerId ?? ''}
          onChange={(e) => accounts.setForger(e.target.value)}
        >
          <option value="">{t('console.forge.forger')}</option>
          {accounts.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={auto}
            disabled={!canForge}
            onChange={(e) => setAuto(e.target.checked)}
          />
          {t('console.forge.auto')}
        </label>

        {(['send', 'chain', 'help'] as const).map((name) => (
          <button
            key={name}
            className={button}
            style={{ ...border, color: 'var(--blue3)' }}
            onClick={() => onOpenDrawer(name)}
          >
            {t(`console.drawer.${name}`)}
          </button>
        ))}
      </span>
    </div>
  )
}
