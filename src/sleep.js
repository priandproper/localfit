/* ---------- sleep engine: pure, no React ----------
 * Infers overnight sleep from app-activity gaps. The owner doesn't use the app
 * overnight, so the long quiet gap ≈ sleep; evening routine ≈ bedtime signal,
 * morning routine ≈ wake signal, brief app-opens inside the gap = interruptions.
 * All inference is derived from state.activity (epoch-ms intervals) so it works
 * offline and survives sync. A stored manual override always wins.
 */

const MIN_MS = 60000

// Build a local epoch-ms timestamp for `dateIso` at hour h (h may be on dateIso-1).
const localEpoch = (dateIso, dayDelta, h) => {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(y, m - 1, d + dayDelta, h, 0, 0, 0).getTime()
}

// The sleep the owner WOKE FROM on the morning of `dateIso`, inferred from activity.
// Returns a sleep object or null.
export function inferSleep(dateIso, activity, profile) {
  if (!dateIso || !Array.isArray(activity) || !activity.length) return null
  const winStart = localEpoch(dateIso, -1, 18) // previous evening 18:00
  const winEnd = localEpoch(dateIso, 0, 14) // this day 14:00

  // Activity intervals overlapping the window, sorted by start.
  const ivs = activity
    .filter((iv) => iv && iv.e > winStart && iv.s < winEnd)
    .map((iv) => ({ s: Math.max(iv.s, winStart), e: Math.min(iv.e, winEnd) }))
    .sort((a, b) => a.s - b.s)
  if (!ivs.length) return null

  const hourOf = (ms) => new Date(ms).getHours()
  const qualifies = (start, end) => {
    if (end - start < 90 * MIN_MS) return false
    return hourOf(start) >= 21 || hourOf(end) <= 11
  }

  // Qualifying gaps between consecutive intervals.
  let sleepStart = null, sleepEnd = null
  for (let i = 0; i < ivs.length - 1; i++) {
    const gStart = ivs[i].e, gEnd = ivs[i + 1].s
    if (gEnd <= gStart) continue
    if (qualifies(gStart, gEnd)) {
      if (sleepStart == null) sleepStart = gStart
      sleepEnd = gEnd
    }
  }
  if (sleepStart == null) return null

  // Interruptions: activity strictly inside the sleep span.
  const interruptions = ivs
    .filter((iv) => iv.s > sleepStart && iv.e < sleepEnd)
    .map((iv) => ({ at: iv.s, minutes: Math.max(1, Math.round((iv.e - iv.s) / MIN_MS)) }))

  const interruptMin = interruptions.reduce((sum, i) => sum + i.minutes, 0)
  const minutes = Math.max(0, Math.min(720, Math.round((sleepEnd - sleepStart) / MIN_MS) - interruptMin))

  const bedH = hourOf(sleepStart), wakeH = hourOf(sleepEnd)
  const bedOk = (bedH >= 20 && bedH <= 23) || (bedH >= 0 && bedH <= 3)
  let confident = true
  if (!bedOk || wakeH > 12 || minutes > 660 || minutes < 120) confident = false

  return { start: sleepStart, end: sleepEnd, minutes, interruptions, source: 'auto', confident }
}

// Last night's sleep: a stored manual override wins; otherwise live inference.
export function lastNightSleep(state, dateIso) {
  const stored = state?.days?.[dateIso]?.sleep
  if (stored && stored.source === 'manual') return stored
  return inferSleep(dateIso, state?.activity || [], state?.profile || {})
}

// Score one night /10 from its sleep object + profile goals.
const HHMM = (s, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || fallback)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}
function nightScore(sleep, profile) {
  const target = (profile.sleepTargetHours || 7) * 60
  const minutes = sleep.minutes || 0
  const durationScore = minutes >= target ? 10 : Math.max(0, 10 - ((target - minutes) / 30) * 1.5)

  // Bedtime penalty, measured from a grace time = bedGoal + 30 min.
  const bedGoalMin = HHMM(profile.bedGoal, '23:30')
  const graceMin = (bedGoalMin + 30) % (24 * 60) // default 00:00
  const bed = new Date(sleep.start)
  // Minutes-into-the-evening for both bedtime and grace, on a 18:00→ timeline so
  // post-midnight reads as "late", and anything before grace reads as on-time.
  const evMin = (mins) => (mins < 18 * 60 ? mins + 24 * 60 : mins) // shift early-AM past midnight
  const bedEv = evMin(bed.getHours() * 60 + bed.getMinutes())
  const graceEv = evMin(graceMin)
  const minutesLate = Math.max(0, bedEv - graceEv)
  const bedtimePenalty = minutesLate > 0 ? Math.min(4, Math.ceil(minutesLate / 30)) : 0

  const interruptionPenalty = Math.min(2, 0.5 * (sleep.interruptions?.length || 0))
  return Math.max(0, Math.min(10, durationScore - bedtimePenalty - interruptionPenalty))
}

// Average per-night score over the last 7 dates (today back 6) that have sleep
// data (manual override OR inferable). Integer /10, or null if no nights.
export function sleepScore(state, dateIso, profile) {
  const p = profile || state?.profile || {}
  let sum = 0, n = 0
  for (let i = 0; i < 7; i++) {
    const iso = shiftIso(dateIso, -i)
    const sleep = lastNightSleep(state, iso)
    if (!sleep) continue
    sum += nightScore(sleep, p)
    n++
  }
  if (!n) return null
  return Math.round(sum / n)
}

// ---- display helpers ----
export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0))
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
export function fmtClock(epochMs) {
  if (epochMs == null) return ''
  const d = new Date(epochMs)
  let h = d.getHours()
  const ap = h < 12 ? 'AM' : 'PM'
  h = ((h + 11) % 12) + 1
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`
}

// Local-date shift, mirroring App.jsx's shiftIso (calendar-correct).
function shiftIso(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number)
  const nd = new Date(new Date(y, m - 1, d).getTime() + delta * 86400000)
  const p = (n) => String(n).padStart(2, '0')
  return `${nd.getFullYear()}-${p(nd.getMonth() + 1)}-${p(nd.getDate())}`
}
