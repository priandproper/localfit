import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Card from './components/Card.jsx'

const isoToday = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const DAY_MS = 86400000
const shiftIso = (iso, delta) => {
  const [y, m, d] = iso.split('-').map(Number)
  const nd = new Date(new Date(y, m - 1, d).getTime() + delta * DAY_MS)
  const p = (n) => String(n).padStart(2, '0')
  return `${nd.getFullYear()}-${p(nd.getMonth() + 1)}-${p(nd.getDate())}`
}

function defaultDay(state) {
  const habits = {}
  for (const h of state.habits || []) habits[h.id] = false
  return {
    steps: 0, workout: { did: false, type: '' }, weight: null,
    routines: { skincareAM: false, skincarePM: false, haircare: false },
    habits, nutrition: { protein: null },
  }
}

function streak(days, today, predicate) {
  let n = 0
  for (let i = 0; ; i++) {
    const day = days[shiftIso(today, -i)]
    if (day && predicate(day)) n++; else break
  }
  return n
}
function countGymThisWeek(days, today) {
  let n = 0
  for (let i = 0; i < 7; i++) {
    const d = days[shiftIso(today, -i)]
    if (d?.workout?.did && !['Rest', 'Walk'].includes(d.workout.type)) n++
  }
  return n
}

export default function App() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const today = isoToday()
  const hour = new Date().getHours()

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setState(await r.json())
    } catch (e) { setError(e) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const day = useMemo(() => (state ? state.days?.[today] || defaultDay(state) : null), [state, today])

  async function patch(p) {
    await fetch('/api/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, patch: p }) })
    await refresh()
  }
  async function saveWeight(kg) {
    await fetch('/api/weight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, kg }) })
    await refresh()
  }

  if (error) return <Centered>Couldn’t reach the local server — is it running?</Centered>
  if (!state || !day) return <Centered>Loading…</Centered>

  const { profile } = state
  const r = day.routines || {}, h = day.habits || {}, n = day.nutrition || {}

  // ----- Today's plan (ordered, actionable) -----
  const tasks = [
    { id: 'skincareAM', icon: '🧴', label: 'Morning skincare', kind: 'toggle', done: !!r.skincareAM, toggle: () => patch({ routines: { skincareAM: !r.skincareAM } }) },
    { id: 'steps', icon: '👟', label: 'Walk 10k steps', kind: 'number', value: day.steps || 0, target: profile.stepTarget, unit: '', done: (day.steps || 0) >= profile.stepTarget, set: (v) => patch({ steps: v }) },
    { id: 'train', icon: '💪', label: 'Train', kind: 'train', done: !!day.workout?.did, type: day.workout?.type },
    { id: 'protein', icon: '🍗', label: 'Hit protein', kind: 'number', value: n.protein || 0, target: profile.proteinTarget, unit: 'g', done: (n.protein || 0) >= profile.proteinTarget, set: (v) => patch({ nutrition: { protein: v } }) },
    { id: 'read', icon: '📖', label: `Read (${profile.readingTarget})`, kind: 'toggle', done: !!h.read, toggle: () => patch({ habits: { read: !h.read } }) },
    { id: 'weight', icon: '⚖️', label: 'Log bodyweight', kind: 'weight', value: day.weight, done: day.weight != null, set: saveWeight },
    { id: 'skincarePM', icon: '🌙', label: 'Evening skincare', kind: 'toggle', done: !!r.skincarePM, toggle: () => patch({ routines: { skincarePM: !r.skincarePM } }) },
  ]
  const doneCount = tasks.filter((t) => t.done).length
  const nextTask = tasks.find((t) => !t.done)
  const allDone = doneCount === tasks.length

  // ----- Coach voice -----
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const coachLine = allDone
    ? "Everything's checked off. That's a complete day — this is how recomposition actually happens. 🎯"
    : coachMessage({ nextTask, day, profile, hour, doneCount, total: tasks.length })

  // ----- Secondary stats -----
  const days = state.days || {}
  const stepStreak = streak(days, today, (d) => (d.steps || 0) >= profile.stepTarget)
  const routineStreak = streak(days, today, (d) => d.routines?.skincareAM && d.routines?.skincarePM)
  const readStreak = streak(days, today, (d) => d.habits?.read)
  const gymThisWeek = countGymThisWeek(days, today)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-emerald-400 px-2 py-0.5 font-mono text-sm font-bold text-slate-950">localfit</span>
        <span className="text-xs uppercase tracking-widest text-emerald-400">{prettyToday(today)}</span>
      </div>

      {/* Coach hero */}
      <div className="mb-4 rounded-2xl border border-emerald-900/50 bg-gradient-to-b from-emerald-950/40 to-slate-900/40 p-5">
        <h1 className="text-xl font-bold text-white">{greeting}, {profile.name} 👋</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-emerald-100/90">{coachLine}</p>
        {nextTask && (
          <button
            onClick={() => document.getElementById(`task-${nextTask.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
          >
            {nextTask.icon} Next: {nextTask.label}
          </button>
        )}
      </div>

      {/* Today's plan */}
      <Card title="Today's plan" subtitle={`${doneCount} of ${tasks.length} done`}>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
        </div>
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} isNext={t.id === nextTask?.id} patch={patch} />
          ))}
        </ul>
      </Card>

      {/* Secondary: momentum */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Step streak" value={`${stepStreak}🔥`} />
        <Stat label="Gym this wk" value={`${gymThisWeek}/${profile.gymTargetPerWeek}`} />
        <Stat label="Routine streak" value={`${routineStreak}🔥`} />
        <Stat label="Reading streak" value={`${readStreak}🔥`} />
      </div>

      <div className="mt-4">
        <Card title="Bodyweight trend" subtitle="The number that matters for recomp">
          <WeightChart log={state.weightLog || []} />
        </Card>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-600">localfit · local-first · {today}</footer>
    </div>
  )
}

function coachMessage({ nextTask, day, profile, hour, doneCount, total }) {
  // A short, prioritized, time-aware nudge toward the next thing.
  const left = total - doneCount
  if (nextTask?.id === 'steps') {
    const remaining = Math.max(0, profile.stepTarget - (day.steps || 0))
    return `${remaining.toLocaleString()} steps to your 10k. A walk now knocks out cardio and clears your head. ${left} things left today.`
  }
  if (nextTask?.id === 'train') return `You haven't trained yet — ${countLabel(left)} left. Even 30 minutes of lifting moves the needle on muscle.`
  if (nextTask?.id === 'skincareAM' && hour < 12) return `Start the day right: morning skincare first, then we build momentum. ${countLabel(left)} on today's plan.`
  if (nextTask?.id === 'skincarePM') return `Evening wind-down — PM skincare and reading left to close the day strong.`
  if (nextTask?.id === 'read') return `Almost there. A few pages of reading is the habit that compounds. ${countLabel(left)} left.`
  return `${doneCount}/${total} done. Next up: ${nextTask?.label.toLowerCase()}. Small steps, every day.`
}
const countLabel = (n) => `${n} thing${n === 1 ? '' : 's'}`

function TaskRow({ t, isNext, patch }) {
  const base = `flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
    t.done ? 'border-slate-800 bg-slate-900/30' : isNext ? 'border-emerald-600 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/50'
  }`
  const checkbox = (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-sm ${
      t.done ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600 text-transparent'
    }`}>✓</span>
  )
  const labelEl = (
    <span className="min-w-0 flex-1">
      <span className={`block text-sm font-medium ${t.done ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
        <span className="mr-1.5">{t.icon}</span>{t.label}
      </span>
      {t.kind === 'number' && (
        <span className="text-[11px] text-slate-500">{(t.value || 0).toLocaleString()} / {t.target.toLocaleString()} {t.unit}</span>
      )}
    </span>
  )

  if (t.kind === 'toggle') {
    return <li id={`task-${t.id}`}><button onClick={t.toggle} className={`w-full text-left ${base}`}>{checkbox}{labelEl}</button></li>
  }
  if (t.kind === 'number') {
    return (
      <li id={`task-${t.id}`} className={base}>
        {checkbox}{labelEl}
        <input type="number" placeholder={t.unit || '#'} defaultValue={t.value || ''}
          onBlur={(e) => e.target.value !== '' && t.set(Number(e.target.value))}
          className="w-16 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-200" />
      </li>
    )
  }
  if (t.kind === 'weight') {
    return (
      <li id={`task-${t.id}`} className={base}>
        {checkbox}
        <span className="min-w-0 flex-1"><span className={`block text-sm font-medium ${t.done ? 'text-slate-500' : 'text-slate-100'}`}><span className="mr-1.5">{t.icon}</span>{t.label}</span>
          {t.value != null && <span className="text-[11px] text-slate-500">{t.value} kg today</span>}</span>
        <input type="number" step="0.1" placeholder="kg" defaultValue={t.value ?? ''}
          onBlur={(e) => e.target.value !== '' && t.set(Number(e.target.value))}
          className="w-16 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-200" />
      </li>
    )
  }
  // train
  return (
    <li id={`task-${t.id}`} className={base}>
      {checkbox}
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${t.done ? 'text-slate-500' : 'text-slate-100'}`}><span className="mr-1.5">{t.icon}</span>{t.label}{t.done && t.type ? ` · ${t.type}` : ''}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          {['Weights', 'Cardio', 'Walk', 'Rest'].map((opt) => (
            <button key={opt} onClick={() => patch({ workout: { did: opt !== 'Rest', type: opt } })}
              className={`rounded-md px-2 py-0.5 text-[11px] ${t.type === opt ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{opt}</button>
          ))}
        </span>
      </span>
    </li>
  )
}

function WeightChart({ log }) {
  if (log.length < 2) return <p className="py-5 text-center text-sm text-slate-500">Log your weight a few days to see the trend.</p>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={log} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }} />
        <Line type="monotone" dataKey="kg" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}
function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center px-6 text-center text-slate-400">{children}</div>
}
function prettyToday(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${d}, ${y}`
}
