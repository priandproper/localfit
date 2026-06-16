import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Card from './components/Card.jsx'
import Ring from './components/Ring.jsx'

const isoToday = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const DAY_MS = 86400000
const shiftIso = (iso, delta) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(y, m - 1, d).getTime() + delta * DAY_MS
  const nd = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${nd.getFullYear()}-${p(nd.getMonth() + 1)}-${p(nd.getDate())}`
}

function defaultDay(state) {
  const habits = {}
  for (const h of state.habits || []) habits[h.id] = false
  return {
    steps: 0,
    workout: { did: false, type: '' },
    weight: null,
    routines: { skincareAM: false, skincarePM: false, haircare: false },
    habits,
    nutrition: { protein: null },
  }
}

// Consecutive days (ending today) where predicate(day) is true.
function streak(days, today, predicate) {
  let n = 0
  for (let i = 0; ; i++) {
    const iso = shiftIso(today, -i)
    const day = days[iso]
    if (day && predicate(day)) n++
    else break
  }
  return n
}

export default function App() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const today = isoToday()

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setState(await r.json())
    } catch (e) { setError(e) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const day = useMemo(() => {
    if (!state) return null
    return state.days?.[today] || defaultDay(state)
  }, [state, today])

  async function patch(p) {
    await fetch('/api/day', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, patch: p }),
    })
    await refresh()
  }
  async function saveWeight(kg) {
    await fetch('/api/weight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, kg }),
    })
    await refresh()
  }

  if (error) return <Centered>Couldn’t reach the local server. Is it running? ({String(error.message)})</Centered>
  if (!state || !day) return <Centered>Loading…</Centered>

  const { profile, routines } = state
  const days = state.days || {}
  const stepStreak = streak(days, today, (d) => (d.steps || 0) >= profile.stepTarget)
  const routineStreak = streak(days, today, (d) => d.routines?.skincareAM && d.routines?.skincarePM && d.routines?.haircare)
  const readStreak = streak(days, today, (d) => d.habits?.read)
  const gymThisWeek = countGymThisWeek(days, today)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-emerald-400 px-2 py-0.5 font-mono text-sm font-bold text-slate-950">localfit</span>
          <span className="text-xs uppercase tracking-widest text-emerald-400">{prettyToday(today)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">Hey {profile.name} 👋</h1>
        <p className="mt-1 text-sm text-slate-400">Goals: {profile.goals.join(' · ')}</p>
      </header>

      {/* Streaks */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Step streak" value={`${stepStreak}🔥`} />
        <Stat label="Gym this wk" value={`${gymThisWeek}/${profile.gymTargetPerWeek}`} />
        <Stat label="Routine streak" value={`${routineStreak}🔥`} />
        <Stat label="Reading streak" value={`${readStreak}🔥`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Steps */}
        <Card title="Steps" subtitle="Synced from Apple Health, or set manually">
          <div className="flex items-center gap-4">
            <Ring value={day.steps || 0} target={profile.stepTarget} unit="steps" />
            <div className="flex-1">
              <input
                type="number" placeholder="set steps"
                defaultValue={day.steps || ''}
                onBlur={(e) => e.target.value !== '' && patch({ steps: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
              />
              <p className="mt-2 text-xs text-slate-500">{Math.max(0, profile.stepTarget - (day.steps || 0)).toLocaleString()} to go</p>
            </div>
          </div>
        </Card>

        {/* Workout */}
        <Card title="Training" subtitle={`Target ${profile.gymTargetPerWeek}× / week`}>
          <div className="flex flex-wrap gap-2">
            {['Weights', 'Cardio', 'Walk', 'Rest'].map((t) => (
              <button
                key={t}
                onClick={() => patch({ workout: { did: t !== 'Rest', type: t } })}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  day.workout?.type === t
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {day.workout?.did ? `Logged: ${day.workout.type}` : 'Not logged yet today'}
          </p>
        </Card>

        {/* Routines */}
        <Card title="Routines" subtitle="Skincare & haircare">
          <Check label="Skincare — AM" sub={routines.skincareAM.join(' · ')} on={day.routines?.skincareAM}
            onClick={() => patch({ routines: { skincareAM: !day.routines?.skincareAM } })} />
          <Check label="Skincare — PM" sub={routines.skincarePM.join(' · ')} on={day.routines?.skincarePM}
            onClick={() => patch({ routines: { skincarePM: !day.routines?.skincarePM } })} />
          <Check label="Haircare" sub={routines.haircare.join(' · ')} on={day.routines?.haircare}
            onClick={() => patch({ routines: { haircare: !day.routines?.haircare } })} />
        </Card>

        {/* Habits + nutrition */}
        <Card title="Habits & fuel">
          {state.habits.map((h) => (
            <Check key={h.id} label={h.name} sub={`Target: ${h.target}`} on={day.habits?.[h.id]}
              onClick={() => patch({ habits: { [h.id]: !day.habits?.[h.id] } })} />
          ))}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-slate-300">Protein</span>
            <input
              type="number" placeholder="g"
              defaultValue={day.nutrition?.protein ?? ''}
              onBlur={(e) => e.target.value !== '' && patch({ nutrition: { protein: Number(e.target.value) } })}
              className="w-20 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-200"
            />
            <span className="text-xs text-slate-500">/ {profile.proteinTarget} g</span>
          </div>
        </Card>
      </div>

      {/* Bodyweight */}
      <div className="mt-4">
        <Card title="Bodyweight" subtitle="Track the trend, not the daily noise"
          right={
            <input
              type="number" step="0.1" placeholder="kg today"
              defaultValue={day.weight ?? ''}
              onBlur={(e) => e.target.value !== '' && saveWeight(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-200"
            />
          }>
          <WeightChart log={state.weightLog || []} />
        </Card>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-600">
        localfit · local-first · {today}
      </footer>
    </div>
  )
}

function countGymThisWeek(days, today) {
  // Count Weights/Cardio days in the last 7 days (rolling week).
  let n = 0
  for (let i = 0; i < 7; i++) {
    const d = days[shiftIso(today, -i)]
    if (d?.workout?.did && d.workout.type !== 'Rest' && d.workout.type !== 'Walk') n++
  }
  return n
}

function WeightChart({ log }) {
  if (log.length < 2) {
    return <p className="py-6 text-center text-sm text-slate-500">Log your weight a few days to see the trend.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
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

function Check({ label, sub, on, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-slate-800/40">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
        on ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600 text-transparent'
      }`}>✓</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${on ? 'text-slate-400 line-through' : 'text-slate-200'}`}>{label}</span>
        {sub && <span className="block truncate text-[11px] text-slate-500">{sub}</span>}
      </span>
    </button>
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
