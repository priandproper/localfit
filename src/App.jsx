import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const isoToday = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const freshDay = () => ({
  steps: 0, workout: { did: false, type: '' }, weight: null,
  routines: { skincareAM: false, skincarePM: false, haircare: false },
  diet: { quality: null },
})

export default function App() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const today = isoToday()
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setState(await r.json())
    } catch (e) { setError(e) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const day = useMemo(() => (state ? { ...freshDay(), ...(state.days?.[today] || {}) } : null), [state, today])

  async function patch(p) {
    await fetch('/api/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, patch: p }) })
    await refresh()
  }
  async function saveWeight(kg) {
    await fetch('/api/weight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, kg }) })
    await refresh()
  }
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (error) return <Centered>Couldn’t reach your local server.</Centered>
  if (!state || !day) return <Centered>…</Centered>

  const { profile } = state
  const r = day.routines, w = day.workout, diet = day.diet || {}
  const coach = buildCoach({ hour, minute, day, profile })

  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-7">
      <div className="mb-5 flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold tracking-tight text-[#20201d]">localfit</span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#a39c8d]">{prettyToday(today)}</span>
      </div>

      {/* The coach speaks */}
      <section className="rounded-[28px] bg-[#23291f] px-6 py-7 shadow-[0_18px_40px_-24px_rgba(35,41,31,0.7)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#9aa581]">{coach.eyebrow}</p>
        <h1 className="font-display mt-3 text-[27px] font-semibold leading-[1.15] text-[#f4f1e8]">{coach.headline}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#cfccba]">{coach.support}</p>
        {coach.action && (
          <button
            onClick={() => scrollTo(coach.action.target)}
            className="mt-5 rounded-full bg-[#e9e4d6] px-5 py-2.5 text-sm font-semibold text-[#23291f] transition active:scale-95"
          >
            {coach.action.label}
          </button>
        )}
      </section>

      <div className="mt-6 space-y-4">
        <Pillar id="movement" title="Movement" note="Lose fat, build muscle">
          <Field label="Steps today">
            <NumInput value={day.steps || ''} placeholder={String(profile.stepTarget)}
              onCommit={(v) => patch({ steps: v })} />
            <span className="text-[13px] text-[#8a8474]">of {profile.stepTarget.toLocaleString()}</span>
          </Field>
          <div className="mt-3">
            <p className="mb-2 text-[13px] text-[#6f6a5d]">Today’s training</p>
            <Segmented options={['Weights', 'Cardio', 'Walk', 'Rest']} value={w.type}
              onPick={(opt) => patch({ workout: { did: opt !== 'Rest', type: opt } })} />
          </div>
          <div className="mt-3">
            <Field label="Bodyweight">
              <NumInput value={day.weight ?? ''} placeholder="kg" step="0.1"
                onCommit={(v) => saveWeight(v)} />
              {day.weight != null && <span className="text-[13px] text-[#5b6745]">recorded</span>}
            </Field>
            {(state.weightLog || []).length >= 2 && <div className="mt-2"><WeightChart log={state.weightLog} /></div>}
          </div>
        </Pillar>

        <Pillar id="skin" title="Skin" note="Your daily care">
          <Segmented options={['Morning', 'Evening']}
            multi value={[r.skincareAM && 'Morning', r.skincarePM && 'Evening'].filter(Boolean)}
            onPick={(opt) => patch({ routines: opt === 'Morning' ? { skincareAM: !r.skincareAM } : { skincarePM: !r.skincarePM } })} />
        </Pillar>

        <Pillar id="hair" title="Hair" note="As scheduled, every few days">
          <Segmented options={['Done today']} value={r.haircare ? 'Done today' : ''}
            onPick={() => patch({ routines: { haircare: !r.haircare } })} />
        </Pillar>

        <Pillar id="diet" title="Diet" note="How you fuel the change">
          <p className="mb-2 text-[13px] text-[#6f6a5d]">How did you eat today?</p>
          <Segmented options={['On point', 'Okay', 'Off']}
            value={diet.quality === 'on' ? 'On point' : diet.quality === 'ok' ? 'Okay' : diet.quality === 'off' ? 'Off' : ''}
            onPick={(opt) => patch({ diet: { quality: opt === 'On point' ? 'on' : opt === 'Okay' ? 'ok' : 'off' } })} />
        </Pillar>
      </div>

      <p className="mt-9 text-center text-[12px] text-[#a39c8d]">Consistency over intensity. One day at a time.</p>
    </div>
  )
}

/* ---------- Coach logic: time + state aware ---------- */
function buildCoach({ hour, minute, day, profile }) {
  const r = day.routines, w = day.workout, diet = day.diet || {}
  const steps = day.steps || 0, target = profile.stepTarget
  const trained = w.did && w.type !== 'Rest'
  const t = fmtTime(hour, minute)
  const eyebrow = `Today — ${t}`
  const phase =
    hour < 5 ? 'latenight'
      : hour < 12 ? 'morning'
        : hour < 17 ? 'midday'
          : hour < 21 ? 'evening' : 'night'
  const blank = !r.skincareAM && !r.skincarePM && !r.haircare && !w.did && day.weight == null && !diet.quality

  if (phase === 'latenight') {
    if (!r.skincarePM) return { eyebrow, headline: `It’s late.`, support: `You’re up past midnight — time to wind down. Do your evening skincare and get to bed. Recovery is when fat loss and muscle repair actually happen.`, action: { label: 'Evening skincare', target: 'skin' } }
    return { eyebrow, headline: `Get some rest.`, support: `It’s the middle of the night. Sleep is the most underrated part of any transformation — we’ll set the day up when you’re back on your feet.`, action: null }
  }

  if (phase === 'morning') {
    if (blank) return { eyebrow, headline: `Good morning. Let’s set up your day.`, support: `Begin with your morning skincare, then we’ll line up training and steps. One thing at a time — no rush.`, action: { label: 'Start with skin', target: 'skin' } }
    if (!r.skincareAM) return { eyebrow, headline: `First, your morning routine.`, support: `Two minutes of skincare to start clean. Then we move.`, action: { label: 'Mark morning done', target: 'skin' } }
    if (!trained) return { eyebrow, headline: `When are you training today?`, support: `Three sessions a week is the floor for holding muscle while you lean out. Set the intention now.`, action: { label: 'Plan training', target: 'movement' } }
    return { eyebrow, headline: `You’re set up well.`, support: `Keep the steps ticking through the day, and make the next meal an easy win.`, action: { label: 'Log movement', target: 'movement' } }
  }
  if (phase === 'midday') {
    if (steps < target * 0.4) return { eyebrow, headline: `You’re at ${steps.toLocaleString()} steps.`, support: `A little behind for midday. Ten minutes on your feet now beats cramming it after dark.`, action: { label: 'Log a walk', target: 'movement' } }
    if (!trained) return { eyebrow, headline: `Have you trained yet?`, support: `Don’t let the afternoon drift — a session now protects your muscle and your deficit.`, action: { label: 'Log training', target: 'movement' } }
    if (!diet.quality) return { eyebrow, headline: `How’s the eating going?`, support: `Check in on lunch. Holding the line through the afternoon is half the work.`, action: { label: 'Log diet', target: 'diet' } }
    return { eyebrow, headline: `Good momentum.`, support: `You’re on track. Water up, stay steady into the evening.`, action: null }
  }
  if (phase === 'evening') {
    if (steps < target * 0.6) {
      return { eyebrow, headline: `It’s ${t}, and you’re at ${steps.toLocaleString()} of ${target.toLocaleString()} steps.`, support: `A 30–40 minute walk closes most of that gap. This is exactly where steady fat loss is won — don’t let it slide.`, action: { label: 'I’ll walk now', target: 'movement' } }
    }
    if (!trained) return { eyebrow, headline: `The day’s closing, and you haven’t trained.`, support: `Even thirty minutes of lifting protects muscle while you’re cutting. Worth showing up for.`, action: { label: 'Log training', target: 'movement' } }
    if (!diet.quality) return { eyebrow, headline: `How did eating go today?`, support: `Be honest with it — logging it is how we keep the trend pointed the right way.`, action: { label: 'Log diet', target: 'diet' } }
    if (!r.skincarePM) return { eyebrow, headline: `Wind down with your evening skincare.`, support: `Close the loop. Your skin does its repair work overnight.`, action: { label: 'Mark evening done', target: 'skin' } }
    return { eyebrow, headline: `You’ve handled today.`, support: `Skin, training, food — all tended. This is the consistency that gets you to your goal.`, action: null }
  }
  if (!r.skincarePM) return { eyebrow, headline: `Before bed: evening skincare.`, support: `Last thing for the day, then rest — recovery is when muscle is actually built.`, action: { label: 'Mark it done', target: 'skin' } }
  if (!diet.quality) return { eyebrow, headline: `Quick check: how did you eat?`, support: `One tap and you’re done. It keeps tomorrow’s plan honest.`, action: { label: 'Log diet', target: 'diet' } }
  return { eyebrow, headline: `Rest up.`, support: `Weigh in first thing tomorrow — we track the trend, not the daily noise.`, action: null }
}

function fmtTime(h, m) {
  const ap = h < 12 ? 'AM' : 'PM'
  const hr = ((h + 11) % 12) + 1
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`
}

/* ---------- UI ---------- */
function Pillar({ id, title, note, children }) {
  return (
    <section id={id} className="rounded-3xl border border-[#e6dfd0] bg-[#fbf9f3] p-5 shadow-[0_2px_10px_-6px_rgba(60,55,40,0.25)]">
      <header className="mb-3">
        <h2 className="font-display text-xl font-semibold text-[#23211c]">{title}</h2>
        <p className="text-[12px] text-[#8a8474]">{note}</p>
      </header>
      {children}
    </section>
  )
}

function Segmented({ options, value, onPick, multi }) {
  const isOn = (opt) => (multi ? value.includes(opt) : value === opt)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onPick(opt)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition active:scale-95 ${
            isOn(opt)
              ? 'bg-[#3d4a32] text-[#f4f1e8]'
              : 'border border-[#e0d9c9] bg-[#f3efe6] text-[#4a463c] hover:bg-[#ebe6da]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-[13px] text-[#6f6a5d]">{label}</span>
      {children}
    </div>
  )
}

function NumInput({ value, placeholder, step, onCommit }) {
  return (
    <input
      type="number" step={step} placeholder={placeholder} defaultValue={value}
      key={value === '' ? 'e' : value}
      onBlur={(e) => e.target.value !== '' && onCommit(Number(e.target.value))}
      className="w-24 rounded-xl border border-[#ddd5c5] bg-white px-3 py-1.5 text-sm text-[#23211c] outline-none focus:border-[#3d4a32]"
    />
  )
}

function WeightChart({ log }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={log} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
        <XAxis dataKey="date" tick={{ fill: '#a39c8d', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} axisLine={{ stroke: '#e0d9c9' }} tickLine={false} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#a39c8d', fontSize: 10 }} width={32} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#23291f', border: 'none', borderRadius: 12, color: '#f4f1e8', fontSize: 12 }} />
        <Line type="monotone" dataKey="kg" stroke="#3d4a32" strokeWidth={2.5} dot={{ r: 3, fill: '#3d4a32' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center px-6 text-center text-[#8a8474]">{children}</div>
}
function prettyToday(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${d} · ${y}`
}
