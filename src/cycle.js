/* ---------- menstrual cycle engine: pure, no React ----------
 * Phase + training/recovery guidance derived from logged period starts. All
 * state lives in `state.cycleLog` (ISO dates of period-start days) and
 * `state.profile.cycle` ({ avgLength, periodLength, enabled }), so it works
 * offline like the rest of the app.
 *
 * Note: on a GLP-1 (e.g. Wegovy) cycles are often delayed, lengthened, or
 * paused — so once we're past the expected length with no new log we drop to
 * an "overdue / irregular" read instead of insisting on a phase.
 */

const DAY_MS = 86400000
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const toIso = (dt) => { const p = (n) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}` }
const daysBetween = (a, b) => Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / DAY_MS)
const addDays = (iso, n) => { const dt = parseIso(iso); dt.setDate(dt.getDate() + n); return toIso(dt) }

export const DEFAULT_CYCLE = { avgLength: 28, periodLength: 5, enabled: true }

// Average gap between consecutive logged starts (last 6), clamped to a sane
// range. Falls back to the configured length until there are two logs.
export function observedLength(state) {
  const log = [...(state.cycleLog || [])].sort()
  const configured = state.profile?.cycle?.avgLength || 28
  if (log.length < 2) return configured
  const gaps = []
  for (let i = 1; i < log.length; i++) gaps.push(daysBetween(log[i - 1], log[i]))
  const recent = gaps.slice(-6)
  const avg = recent.reduce((s, g) => s + g, 0) / recent.length
  return Math.round(Math.max(21, Math.min(45, avg)))
}

function lastStartOnBefore(dateIso, log) {
  let best = null
  for (const d of log) if (d <= dateIso && (!best || d > best)) best = d
  return best
}

// The current phase for a date. Returns { enabled, known, ... }.
export function cyclePhase(dateIso, state) {
  const cfg = state.profile?.cycle || {}
  if (cfg.enabled === false) return { enabled: false, known: false }
  const log = state.cycleLog || []
  const start = lastStartOnBefore(dateIso, log)
  const length = observedLength(state)
  const periodLen = cfg.periodLength || 5
  if (!start) return { enabled: true, known: false, length, periodLen }

  const daysInto = daysBetween(start, dateIso) // 0 on the start day
  const nextStartIso = addDays(start, length)
  const daysToNext = daysBetween(dateIso, nextStartIso)

  // Past the expected length with no newer log → irregular / overdue read.
  // GLP-1s make this common, so we coach "log it when it comes" rather than
  // pretend we know the phase.
  if (daysInto >= length) {
    return {
      enabled: true, known: true, overdue: true, start, length, periodLen,
      dayOfCycle: daysInto + 1, daysToNext, nextStartIso,
      phase: 'late', label: 'Cycle overdue', tone: 'steady',
      line: `Day ${daysInto + 1}, past the usual ${length}-day mark.`,
      coachNote: `It's been ${daysInto} days since your last period — past your usual ${length}-day cycle. GLP-1 medications often delay or pause periods, so this can be normal; log your next period the day it starts and the tracking re-centres itself.`,
    }
  }

  const dayOfCycle = daysInto + 1 // day 1 = the start day
  const ovulation = length - 14 // luteal phase is ~14 days, fixed
  let phase, label, line, coachNote, tone
  if (dayOfCycle <= periodLen) {
    phase = 'menstrual'; label = 'Period'; tone = 'ease'
    line = 'Energy may be low — movement over intensity.'
    coachNote = "You're on your period. Train if you feel up to it, but keep 2–3 reps in reserve, drop a set if you're flat, and lean on walks. This isn't the week to chase PRs — recovery and protein matter more."
  } else if (dayOfCycle < ovulation - 1) {
    phase = 'follicular'; label = 'Follicular'; tone = 'push'
    line = 'Rising energy — a strong window to push.'
    coachNote = 'Follicular phase: energy and recovery are climbing. Add reps or a little load where the sets feel easy — these are your best training days of the month.'
  } else if (dayOfCycle <= ovulation + 1) {
    phase = 'ovulation'; label = 'Ovulation'; tone = 'peak'
    line = 'Peak strength — go for it, warm up well.'
    coachNote = 'Around ovulation: strength tends to peak. A great day for your top sets — just warm up thoroughly, since joints are a touch laxer right now.'
  } else {
    const late = dayOfCycle >= length - 2
    phase = 'luteal'; label = 'Luteal'; tone = late ? 'ease' : 'steady'
    line = late ? 'Pre-period dip — ease back, expect water weight.' : 'Steady phase — hold your training.'
    coachNote = late
      ? 'Late luteal (pre-period): energy dips and you may hold water — the scale and tape can read 1–2 kg high, so ignore it and watch the trend. Train steady, prioritise sleep and protein.'
      : 'Luteal phase: keep training steady. You may notice more hunger and some water retention — hold your protein and don\'t read too much into a single weigh-in.'
  }

  return {
    enabled: true, known: true, overdue: false, start, length, periodLen,
    dayOfCycle, daysToNext, nextStartIso, phase, label, line, coachNote, tone,
  }
}

// Is the scale/tape likely inflated by water right now? (period or late luteal)
export function waterRetentionLikely(dateIso, state) {
  const c = cyclePhase(dateIso, state)
  return !!(c.known && !c.overdue && (c.phase === 'menstrual' || (c.phase === 'luteal' && c.tone === 'ease')))
}
