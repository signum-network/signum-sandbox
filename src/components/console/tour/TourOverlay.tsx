import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { TOUR_USE_CASES } from '@/lib/tour'
import type { TourStore } from '@/hooks/useTour'

const CALLOUT_WIDTH = 300
/** The last step is a list, not a sentence, and 300px is a column of words. */
const FINALE_WIDTH = 460
const GAP = 10

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/**
 * The ring around what the step is about, and the card that explains it.
 *
 * The ring is drawn, not dimmed: a full-screen scrim would have to let clicks
 * through to the highlighted control, and a scrim with a hole in it is a lot
 * of geometry for a console the user is meant to keep using while the tour
 * runs. Nothing here blocks the page — the card is the only thing that takes
 * a click, and even it can be walked away from.
 */
export function TourOverlay({ tour }: { tour: TourStore }) {
  const { t } = useTranslation()
  const [box, setBox] = useState<Box | null>(null)
  const target = tour.step?.target ?? null

  useLayoutEffect(() => {
    if (!target) {
      setBox(null)
      return
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`)
      if (!el) {
        setBox(null)
        return
      }
      const r = el.getBoundingClientRect()
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    // The console reflows constantly — the auto-forge cluster appears, rows
    // page, drawers open — and a ring left behind at a stale rectangle points
    // at nothing. Re-measuring on a slow interval costs a rect read per tick
    // and never goes stale.
    const timer = window.setInterval(measure, 300)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [target])

  if (!tour.active || !tour.step) return null

  const acknowledgeable = tour.step.completion.kind === 'acknowledge'
  const finale = tour.step.finale === true
  const width = finale ? FINALE_WIDTH : CALLOUT_WIDTH
  // Below the target if there is room, above it otherwise; and never off the
  // right edge. The finale has no target and centres itself.
  const below = box ? box.top + box.height + GAP : 0
  const calloutTop = box && below + 180 > window.innerHeight ? box.top - 180 : below
  const calloutLeft = box
    ? Math.min(box.left, window.innerWidth - width - GAP)
    : window.innerWidth / 2 - width / 2

  return (
    <>
      {box && (
        <div
          className="pointer-events-none fixed z-40"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
            border: '1px solid var(--blue2)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,.28)',
          }}
        />
      )}

      <div
        className="themed-scroll console-scroll fixed z-50 overflow-y-auto p-3"
        style={{
          // The finale is the one card tall enough to run off a short screen,
          // so it is pinned near the top and scrolls inside itself rather than
          // hiding its own last idea and its own button below the fold.
          top: finale ? '8vh' : box ? calloutTop : window.innerHeight / 2 - 90,
          left: calloutLeft,
          width,
          maxHeight: finale ? '84vh' : undefined,
          background: 'var(--bg2)',
          border: '1px solid var(--blue2)',
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[1px] text-[var(--blue3)]">
            {t('tour.position', { position: tour.position, total: tour.total })}
          </span>
          <RowButton className="text-[11px] text-[var(--muted)]" onClick={tour.stop}>
            ✕
          </RowButton>
        </div>

        <p
          className={
            finale ? 'mb-1 text-[13px] text-[var(--blue3)]' : 'mb-1 text-[11px] text-[var(--fg)]'
          }
        >
          {t(`tour.step.${tour.step.id}.title`)}
        </p>
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--muted)]">
          {t(`tour.step.${tour.step.id}.body`)}
        </p>

        {/*
          The list only the last step has. Two columns where there is room:
          eight ideas stacked in one column reads as a form to work through,
          and the point of this card is that it should feel like an open door.
        */}
        {finale && (
          <ul className="mb-3 grid gap-2 sm:grid-cols-2">
            {TOUR_USE_CASES.map((id) => (
              <li key={id} className="border-l pl-2" style={{ borderColor: 'var(--blue2)' }}>
                <p className="text-[10px] text-[var(--fg)]">{t(`tour.useCase.${id}.title`)}</p>
                <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                  {t(`tour.useCase.${id}.body`)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {finale && (
          <p className="mb-3 text-[10px] leading-relaxed text-[var(--muted)]">
            {t('tour.finaleFooter')}
          </p>
        )}

        {acknowledgeable ? (
          <ConsoleButton onClick={tour.acknowledge}>
            {t(finale ? 'tour.finish' : 'tour.next')}
          </ConsoleButton>
        ) : (
          <span className="text-[10px] text-[var(--blue3)]">{t('tour.waiting')}</span>
        )}
      </div>
    </>
  )
}
