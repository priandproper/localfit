/* ---------- hair engine (pure) ----------------------------------------------
 * A simple nightly minoxidil routine: one step, PM only. No morning routine,
 * no wash schedule, no derma roller — just the proven driver, once at night.
 * -------------------------------------------------------------------------- */

// Product to buy (surfaced in the flow's empty state).
export const HAIR_PRODUCTS = [
  { id: 'minoxidil', name: 'Minoxidil 5% (Kirkland foam / Rogaine)', why: 'the proven regrowth driver — once nightly' },
]

const step = (id, title, instruction, extra = {}) => ({ id, title, instruction, ...extra })

export function hairPlanForDay(dateIso, state) {
  // AM: nothing. PM: minoxidil, once.
  const am = []
  const pm = [
    step('minox_pm', 'Minoxidil',
      'On a dry scalp, apply minoxidil to the thinning areas — half a cap of foam (or 1 mL of solution). Spread it evenly, then wash your hands.',
      { tag: 'Nightly' }),
  ]
  return { am, pm }
}

// Which slots still need doing today (for the tile/coach), given the day's logs.
export function hairDue(dateIso, state) {
  const day = state.days?.[dateIso] || {}
  const plan = hairPlanForDay(dateIso, state)
  return {
    amPending: false,
    pmPending: plan.pm.length > 0 && !day.routines?.haircarePM,
    amCount: plan.am.length, pmCount: plan.pm.length,
  }
}
