import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useAnimate } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { NodeState } from '@/lib/nodeState'
import type { AccountStore } from '@/hooks/useAccounts'
import { useForge } from '@/hooks/useForge'
import { Select } from '@/components/console/Select'
import { AUTO_INTERVALS_S, MAINNET_INTERVAL_S, formatInterval } from '@/lib/autoForge'
import { Countdown } from '@/components/console/Countdown'
import { Toggle } from '@/components/console/Toggle'
import { Identicon } from '@/components/Identicon'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { Term } from '@/components/console/Term'
import { sfx, useAudio } from '@/audio'
import { AnimatedNumber } from '@/components/ui'
import { useMotion, seconds } from '@/motion'

export function Header({
  state,
  accounts,
  pulse,
  onOpenDrawer,
}: {
  state: Extract<NodeState, { kind: 'ready' }>
  accounts: AccountStore
  /**
   * Changes once per block. Observed by the shell rather than here: a second
   * useChainPulse in this file would be a second detection of one event.
   */
  pulse: number
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
  const { enabled } = useMotion()
  const [bar, animate] = useAnimate<HTMLDivElement>()

  // The bar's own frame marks the arrival. Imperative rather than a prop on a
  // motion.div, because this is a one-shot keyframe run and not a state the
  // component is in — the same reason AnimatedNumber is written this way.
  useEffect(() => {
    if (!enabled || pulse === 0 || !bar.current) return
    void animate(
      bar.current,
      { borderColor: ['var(--green)', 'var(--border2)'] },
      { duration: seconds('calm') },
    )
  }, [pulse, enabled, animate, bar])

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
      ref={bar}
      className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border p-3"
      style={border}
    >
      {/*
        Only the chain lives here. Who the app is, whether the node answers,
        and the personal settings are in AppHeader above, so this bar changes
        exactly when the chain does.
      */}
      <span className="text-[13px]" data-tour="height">
        <span className="text-[var(--muted)]">
          <Term id="height">{t('console.chain.height')}</Term>{' '}
        </span>
        <span className="font-bold text-[var(--blue3)]">
          {state.height === null || state.height === undefined ? (
            '—'
          ) : (
            <AnimatedNumber value={state.height} />
          )}
        </span>
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
              <span className="text-[12px] text-[var(--muted)]">
                {t('console.forge.nextIn')} <Countdown at={nextForgeAt} />
              </span>
            )}
            <div className="w-[124px]">
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

        <span className="flex" data-tour="forge-button">
          <ConsoleButton disabled={!canForge || busy} onClick={() => void forgeClicked()}>
            ⛏ <Term id="forge">{t('console.forge.action')}</Term>
          </ConsoleButton>
        </span>

        <AnimatePresence initial={false} mode="wait">
          {requested && (
            <motion.span
              key="requested"
              className="text-[12px] text-[var(--muted)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: seconds('quick') }}
            >
              {t('console.forge.requested')}
            </motion.span>
          )}
          {!requested && error && (
            <motion.span
              key="error"
              className="text-[12px] text-[var(--mag)]"
              initial={{ opacity: 0, x: 0 }}
              // A forge you asked for and did not get earns a nudge, to go
              // with the sfx.warn already played for it. Two pixels, once —
              // enough to be noticed beside a button, not a tantrum.
              animate={{ opacity: 1, x: [0, -2, 2, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: seconds('quick') }}
            >
              {t('console.forge.failed', { message: error })}
            </motion.span>
          )}
        </AnimatePresence>

        <div className="w-44" data-tour="forger-select">
          <Select
            value={accounts.forgerId ?? ''}
            placeholder={t('console.forge.chooseForger')}
            emptyLabel={t('console.accounts.none')}
            onChange={accounts.setForger}
            // Address and identicon beside the name, as every other account
            // picker has them. A local name is a label, not an identifier —
            // nothing stops two accounts being called Bob — so a list that
            // offers only the name cannot say which Bob you are choosing.
            options={accounts.accounts.map((a) => ({
              value: a.id,
              label: a.name,
              sublabel: a.address,
              icon: <Identicon value={a.address} size={14} />,
            }))}
          />
        </div>

        {(['send', 'chain', 'help'] as const).map((name) => (
          <span key={name} className="flex" data-tour={name === 'send' ? 'send-button' : undefined}>
            <ConsoleButton onClick={() => onOpenDrawer(name)}>
              {t(`console.drawer.${name}`)}
            </ConsoleButton>
          </span>
        ))}
      </span>
    </div>
  )
}
