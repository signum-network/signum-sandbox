import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeState } from '@/lib/nodeState'
import type { AccountStore } from '@/hooks/useAccounts'
import { useForge } from '@/hooks/useForge'
import { Select } from '@/components/console/Select'
import { AUTO_INTERVALS_S, MAINNET_INTERVAL_S, formatInterval } from '@/lib/autoForge'
import { Countdown } from '@/components/console/Countdown'
import { Toggle } from '@/components/console/Toggle'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { Term } from '@/components/console/Term'
import { sfx, useAudio } from '@/audio'

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
  const {
    forgeOnce,
    busy,
    auto,
    setAuto,
    intervalS,
    setAutoInterval,
    nextForgeAt,
    canForge,
    error,
  } = useForge(accounts.forger)
  const [requested, setRequested] = useState(false)
  const { play } = useAudio()

  // submitNonce reports success even when several calls collapse into a single
  // block, so the button promises a request, not a block. The height beside it
  // is what actually answers whether one appeared. A request and a failure are
  // mutually exclusive, so "requested" only lights up once forgeOnce actually
  // succeeded — on failure useForge's own error takes that spot instead.
  const forgeClicked = async () => {
    const ok = await forgeOnce()
    if (!ok) {
      // The message appears beside the button, but a forge you asked for and
      // did not get deserves to be heard as well as read.
      play(sfx.warn)
      return
    }
    setRequested(true)
    setTimeout(() => setRequested(false), 3000)
  }

  const border = { borderColor: 'var(--border2)' }

  return (
    <div
      className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border p-3"
      style={border}
    >
      {/*
        Only the chain lives here. Who the app is, whether the node answers,
        and the personal settings are in AppHeader above, so this bar changes
        exactly when the chain does.
      */}
      <span className="text-[11px]">
        <span className="text-[var(--muted)]">
          <Term id="height">{t('console.chain.height')}</Term>{' '}
        </span>
        <span className="font-bold text-[var(--blue3)]">{state.height ?? '—'}</span>
      </span>

      <span className="flex flex-wrap items-center gap-2">
        {/*
          The auto cluster sits at the start of this row, not beside the
          things it affects, because of how this span is positioned: the
          outer container's justify-between pins this span's right edge to
          the container's right edge, and a flex row lays its children out
          left-to-right, so any child's on-screen position depends only on
          the total width of itself and whatever follows it — never on what
          precedes it. Putting the cluster first means the Forge button,
          forger picker and drawer buttons all sit after it, so flipping auto
          on or off only grows or shrinks the empty space to its left.

          Within the cluster the order reads outward from the switch:
          countdown, rate, then the switch itself, so what appears when auto
          goes on unfolds away from the control that turned it on rather than
          pushing it aside.

          The rate and the countdown exist only while auto-forging does — a
          rate for something that is off is furniture. Five seconds is the
          floor the node imposes, not a preference.
        */}
        {auto && (
          <>
            {nextForgeAt !== null && (
              <span className="text-[10px] text-[var(--muted)]">
                {t('console.forge.nextIn')} <Countdown at={nextForgeAt} />
              </span>
            )}
            <div className="w-[104px]">
              <Select
                value={String(intervalS)}
                placeholder={formatInterval(intervalS)}
                onChange={(v) => setAutoInterval(Number(v))}
                options={AUTO_INTERVALS_S.map((seconds) => ({
                  value: String(seconds),
                  label: formatInterval(seconds),
                  sublabel:
                    seconds === MAINNET_INTERVAL_S ? t('console.forge.mainnetRate') : undefined,
                }))}
              />
            </div>
          </>
        )}

        <Toggle
          checked={auto}
          disabled={!canForge}
          onChange={setAuto}
          label={t('console.forge.auto')}
        />

        <ConsoleButton disabled={!canForge || busy} onClick={() => void forgeClicked()}>
          ⛏ <Term id="forge">{t('console.forge.action')}</Term>
        </ConsoleButton>

        {requested && (
          <span className="text-[10px] text-[var(--muted)]">{t('console.forge.requested')}</span>
        )}
        {!requested && error && (
          <span className="text-[10px] text-[var(--mag)]">
            {t('console.forge.failed', { message: error })}
          </span>
        )}

        <div className="w-36">
          <Select
            value={accounts.forgerId ?? ''}
            placeholder={t('console.forge.chooseForger')}
            emptyLabel={t('console.accounts.none')}
            onChange={accounts.setForger}
            options={accounts.accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </div>

        {(['send', 'chain', 'help'] as const).map((name) => (
          <ConsoleButton key={name} onClick={() => onOpenDrawer(name)}>
            {t(`console.drawer.${name}`)}
          </ConsoleButton>
        ))}
      </span>
    </div>
  )
}
