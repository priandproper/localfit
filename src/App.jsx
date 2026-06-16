import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

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
const freshDay = () => ({
  workout: { did: false, type: '' }, weight: null,
  routines: { skincareAM: false, skincarePM: false, haircare: false },
  diet: { quality: null },
})

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

  const day = useMemo(() => {
    if (!state) return null
    return { ...freshDay(), ...(state.days?.[today] || {}) }
  }, [state, today])

  async function patch(p) {
    await fetch('/api/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, patch: p }) })
    await refresh()
  }
  async function saveWeight(kg) {
    await fetch('/api/weight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, kg }) })
    await refresh()
  }

  if (error) return <Centered>Couldn’t reach your local server — is it running?</Centered>
  if (!state || !day) return <Centered>…</Centered>

  const { profile } = state
  const r = day.routines, w = day.workout, diet = day.diet || {}

  const engaged =
    (r.skincareAM || r.skincarePM ? 1 : 0) +
    (r.haircare ? 1 : 0) +
    (w.did || day.weight != null ? 1 : 0) +
    (diet.quality ? 1 : 0)

  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const emoji = hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙'
  const welcome = engaged === 0
    ? "A fresh day to take care of yourself. Start with whatever feels easy — no pressure."
    : engaged >= 4
      ? "You've tended to everything today. This is exactly how it adds up. ✨"
      : "You're looking after yourself today. Keep the flow going whenever you're ready."

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-emerald-400 px-2 py-0.5 font-mono text-sm font-bold text-slate-950">localfit</span>
        <span className="text-xs uppercase tracking-widest text-slate-500">{prettyToday(today)}</span>
      </div>

      {/* Warm welcome */}
      <div className="mb-5 rounded-3xl border border-rose-900/30 bg-gradient-to-br from-rose-950/40 via-amber-950/20 to-slate-900/40 p-6">
        <h1 className="text-2xl font-bold text-white">{greeting}, {profile.name} {emoji}</h1>
        <p className="mt-2 text-sm leading-relaxed text-rose-100/80">{welcome}</p>
      </div>

      <div className="space-y-4">
        {/* Skin */}
        <Pillar icon="🌸" title="Skin" subtitle="Your daily glow"
          color="rose" status={r.skincareAM && r.skincarePM ? 'Glowing ✨' : ''}>
          <div className="flex gap-2">
            <Pill on={r.skincareAM} color="rose" onClick={() => patch({ routines: { skincareAM: !r.skincareAM } })}>☀️ Morning</Pill>
            <Pill on={r.skincarePM} color="rose" onClick={() => patch({ routines: { skincarePM: !r.skincarePM } })}>🌙 Evening</Pill>
          </div>
        </Pillar>

        {/* Hair */}
        <Pillar icon="💜" title="Hair" subtitle="As scheduled — every few days"
          color="violet" status={r.haircare ? 'Done today' : ''}>
          <Pill on={r.haircare} color="violet" onClick={() => patch({ routines: { haircare: !r.haircare } })}>
            {r.haircare ? '✓ Cared for' : 'Wash / oil today'}
          </Pill>
        </Pillar>

        {/* Body */}
        <Pillar icon="💪" title="Body" subtitle="Lose fat · build muscle"
          color="emerald" status={w.did ? `${w.type} ✓` : ''}>
          <div className="mb-3 flex flex-wrap gap-2">
            {['Weights', 'Cardio', 'Walk', 'Rest'].map((opt) => (
              <Pill key={opt} on={w.type === opt} color="emerald" onClick={() => patch({ workout: { did: opt !== 'Rest', type: opt } })}>{opt}</Pill>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-950/40 px-3 py-2.5">
            <span className="text-sm text-slate-300">⚖️ Weight today</span>
            <input type="number" step="0.1" placeholder="kg" defaultValue={day.weight ?? ''}
              key={day.weight ?? 'empty'}
              onBlur={(e) => e.target.value !== '' && saveWeight(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-200" />
            {day.weight != null && <span className="text-xs text-emerald-400">logged</span>}
          </div>
          {(state.weightLog || []).length >= 2 && (
            <div className="mt-3"><WeightChart log={state.weightLog} /></div>
          )}
        </Pillar>

        {/* Diet */}
        <Pillar icon="🥗" title="Diet" subtitle="How you fuel the change"
          color="amber" status={diet.quality ? labelFor(diet.quality) : ''}>
          <p className="mb-2 text-sm text-slate-300">How did you eat today?</p>
          <div className="flex gap-2">
            <Pill on={diet.quality === 'on'} color="amber" onClick={() => patch({ diet: { quality: 'on' } })}>🟢 On point</Pill>
            <Pill on={diet.quality === 'ok'} color="amber" onClick={() => patch({ diet: { quality: 'ok' } })}>🟡 Okay</Pill>
            <Pill on={diet.quality === 'off'} color="amber" onClick={() => patch({ diet: { quality: 'off' } })}>🔴 Off</Pill>
          </div>
        </Pillar>
      </div>

      <p className="mt-8 text-center text-xs text-slate-600">Small things, every day. You've got this. 💚</p>
    </div>
  )
}

const COLORS = {
  rose: { border: 'border-rose-900/40', glow: 'from-rose-950/30', text: 'text-rose-300', on: 'bg-rose-500 text-slate-950' },
  violet: { border: 'border-violet-900/40', glow: 'from-violet-950/30', text: 'text-violet-300', on: 'bg-violet-500 text-slate-950' },
  emerald: { border: 'border-emerald-900/40', glow: 'from-emerald-950/30', text: 'text-emerald-300', on: 'bg-emerald-500 text-slate-950' },
  amber: { border: 'border-amber-900/40', glow: 'from-amber-950/30', text: 'text-amber-300', on: 'bg-amber-500 text-slate-950' },
}

function Pillar({ icon, title, subtitle, color, status, children }) {
  const c = COLORS[color]
  return (
    <section className={`rounded-3xl border ${c.border} bg-gradient-to-br ${c.glow} to-slate-900/40 p-5`}>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{icon} {title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        {status && <span className={`text-xs font-medium ${c.text}`}>{status}</span>}
      </header>
      {children}
    </section>
  )
}

function Pill({ on, color, onClick, children }) {
  const c = COLORS[color]
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-95 ${
        on ? c.on : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function labelFor(q) {
  return q === 'on' ? 'On point 🟢' : q === 'ok' ? 'Okay 🟡' : 'Off track 🔴'
}

function WeightChart({ log }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={log} margin={{ top: 6, right: 10, bottom: 0, left: -22 }}>
        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} width={32} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }} />
        <Line type="monotone" dataKey="kg" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
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
