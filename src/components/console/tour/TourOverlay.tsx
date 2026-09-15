import { useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { TOUR_USE_CASES } from '@/lib/tour'
import type { TourStore } from '@/hooks/useTour'
import { SPRINGS, seconds } from '@/motion'

/**
 * Below every popover in the console, not above.
 *
 * The one step that points at a dropdown — choosing a forger — would
 * otherwise paint an opaque card straight over the options it is asking the
 * user to choose from: Select's panel opens 4px under its trigger, the
 * callout sits 10px under the same trigger, and at an equal z-index the
 * callout wins for being later in the tree. The control being explained has
 * to be the thing you can see and press.
 */
const OVERLAY_Z = 30

const CALLOUT_WIDTH = 340
/** The last step is a list, not a sentence, and 300px is a column of words. */
const FINALE_WIDTH = 520
/**
 * Roughly how tall a callout runs, used only to decide whether it still fits
 * below its target. A guess rather than a measurement: measuring would mean a
 * second layout pass every time the card changes, to move a card that in
 * practice always has room -- every `data-tour` target sits in the top strip
 * of the page. Set above the tallest card the longer locales produce, so the
 * error is on the side of flipping too eagerly rather than running off screen.
 */
const CALLOUT_HEIGHT = 220

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
 * The dimming is one box shadow, not a stack of panels: a 9999px spread from
 * the ring darkens everything outside it and leaves the target lit, with no
 * geometry to compute. It takes no clicks, so the console stays usable while
 * the tour runs — the card is the only thing here that can be pressed, and
 * even it can be walked away from.
 */
export function TourOverlay({ tour }: { tour: TourStore }) {
  const { t } = useTranslation()
  const [box, setBox] = useState<Box | null>(null)
  const target = tour.step?.target ?? null

  useLayoutEffect(() => {
    const measure = () => {
      if (!target) {
        setBox(null)
        return
      }
      const el = document.querySelector(`[data-tour="${target}"]`)
      if (!el) {
        setBox(null)
        return
      }
      const r = el.getBoundingClientRect()
      // A fresh object on every tick would re-render this component three
      // times a second for the whole tour, for a rectangle that mostly does
      // not move.
      setBox((previous) =>
        previous &&
        previous.top === r.top &&
        previous.left === r.left &&
        previous.width === r.width &&
        previous.height === r.height
          ? previous
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      )
    }
    measure()
    // The console reflows constantly — the auto-forge cluster appears, rows
    // page, drawers open — and a ring left behind at a stale rectangle points
    // at nothing. Re-measuring on a slow interval costs a rect read per tick
    // and never goes stale.
    const timer = target ? window.setInterval(measure, 300) : undefined
    // Registered even with no target: a centred card is positioned from the
    // viewport width, so it has to move when the viewport does.
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [target])

  // Null rather than an early return: the ring and the card have to be able
  // to animate away, and a component that has already returned has nothing
  // left to animate.
  const step = tour.active ? tour.step : null
  const acknowledgeable = step?.completion.kind === 'acknowledge'
  const finale = step?.finale === true
  const width = finale ? FINALE_WIDTH : CALLOUT_WIDTH
  // Below the target if there is room, above it otherwise; and never off the
  // right edge. The finale has no target and centres itself.
  const below = box ? box.top + box.height + GAP : 0
  const calloutTop =
    box && below + CALLOUT_HEIGHT > window.innerHeight ? box.top - CALLOUT_HEIGHT : below
  const calloutLeft = box
    ? Math.min(box.left, window.innerWidth - width - GAP)
    : window.innerWidth / 2 - width / 2

  return (
    <AnimatePresence>
      {step && box && (
        /*
          The geometry is animated towards the measured values rather than
          handed to Framer's `layout`. The measurement above runs every 300ms,
          because the console reflows constantly and a ring left at a stale
          rectangle points at nothing; `layout` would take the rendered
          position as its own truth and fight that. This way the measurement
          decides where to go and the spring only decides how to get there, so
          a target that shifts mid-flight is simply a new target.
        */
        <motion.div
          key="tour-ring"
          className="pointer-events-none fixed"
          style={{
            zIndex: OVERLAY_Z,
            border: '1px solid var(--blue2)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,.28)',
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
            // A step just finished, and the ring is standing on whatever
            // finished it. Goes with the sfx.confirm useTour already plays.
            borderColor: ['var(--green)', 'var(--blue2)'],
          }}
          exit={{ opacity: 0 }}
          transition={{
            ...SPRINGS.panel,
            opacity: { duration: seconds('quick') },
            borderColor: { duration: seconds('quick') },
          }}
        />
      )}

      {step && (
        <motion.div
          key="tour-card"
          className="themed-scroll console-scroll fixed overflow-y-auto p-3"
          style={{
            zIndex: OVERLAY_Z,
            // The finale is the one card tall enough to run off a short screen,
            // so it is pinned near the top and scrolls inside itself rather than
            // hiding its own last idea and its own button below the fold. It is
            // in vh, so its position is not animated: interpolating vh against
            // the px of a travelling callout is not a thing.
            top: finale ? '8vh' : undefined,
            width,
            maxHeight: finale ? '84vh' : undefined,
            background: 'var(--bg2)',
            border: '1px solid var(--blue2)',
          }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={
            finale
              ? {
                  opacity: 1,
                  scale: 1,
                  left: calloutLeft,
                  // The one bloom in the app. It can afford to be loud: it
                  // plays once per visit, and it is the moment the tour hands
                  // the console over.
                  boxShadow: ['0 0 40px var(--blue2)', '0 8px 32px rgba(0,0,0,.5)'],
                }
              : {
                  opacity: 1,
                  scale: 1,
                  top: box ? calloutTop : window.innerHeight / 2 - 90,
                  left: calloutLeft,
                  boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                }
          }
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{
            ...SPRINGS.panel,
            opacity: { duration: seconds('quick') },
            boxShadow: { duration: seconds('calm') },
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[1px] text-[var(--blue3)]">
              {t('tour.position', { position: tour.position, total: tour.total })}
            </span>
            <RowButton className="text-[13px] text-[var(--muted)]" onClick={tour.stop}>
              ✕
            </RowButton>
          </div>

          {/*
            The card stays the same element from step to step — that is the
            whole point of it travelling — so its words have to change on
            their own.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: seconds('instant') }}
            >
              <p
                className={
                  finale
                    ? 'mb-1 text-[15px] text-[var(--blue3)]'
                    : 'mb-1 text-[13px] text-[var(--fg)]'
                }
              >
                {t(`tour.step.${step.id}.title`)}
              </p>
              <p className="mb-3 text-[12px] leading-relaxed text-[var(--muted)]">
                {t(`tour.step.${step.id}.body`)}
              </p>
            </motion.div>
          </AnimatePresence>

          {/*
            The list only the last step has. Two columns where there is room:
            eight ideas stacked in one column reads as a form to work through,
            and the point of this card is that it should feel like an open door.
          */}
          {finale && (
            <ul className="mb-3 grid gap-2 sm:grid-cols-2">
              {TOUR_USE_CASES.map((id, index) => (
                <motion.li
                  key={id}
                  className="border-l pl-2"
                  style={{ borderColor: 'var(--blue2)' }}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  // Eight ideas arriving at once read as a form to work
                  // through; arriving in sequence, the eye walks them. The one
                  // stagger in the app, affordable for the same reason the
                  // bloom is: once per visit.
                  transition={{ duration: seconds('base'), delay: 0.18 + index * 0.08 }}
                >
                  <p className="text-[12px] text-[var(--fg)]">{t(`tour.useCase.${id}.title`)}</p>
                  <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                    {t(`tour.useCase.${id}.body`)}
                  </p>
                </motion.li>
              ))}
            </ul>
          )}

          {finale && (
            <p className="mb-3 text-[12px] leading-relaxed text-[var(--muted)]">
              {t('tour.finaleFooter')}
            </p>
          )}

          {acknowledgeable ? (
            <ConsoleButton onClick={tour.acknowledge}>
              {t(finale ? 'tour.finish' : 'tour.next')}
            </ConsoleButton>
          ) : (
            <span className="text-[12px] text-[var(--blue3)]">{t('tour.waiting')}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
