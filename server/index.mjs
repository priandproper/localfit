// localfit local backend — serves wellness state and accepts daily logs +
// Apple Health pushes from an iOS Shortcut. Local-first; no cloud.
import express from 'express'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const statePath = resolve(repoRoot, 'data/state.json')
const publicState = resolve(repoRoot, 'public/state.json')
const distDir = resolve(repoRoot, 'dist')

const PORT = process.env.PORT || 8788
const app = express()
app.use(express.json())

const readState = async () => JSON.parse(await readFile(statePath, 'utf8'))
const localDate = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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

function ensureDay(state, date) {
  state.days ||= {}
  if (!state.days[date]) state.days[date] = defaultDay(state)
  return state.days[date]
}

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] && typeof target[k] === 'object' ? target[k] : {}, v)
    } else {
      target[k] = v
    }
  }
  return target
}

async function persist(state) {
  const json = JSON.stringify(state, null, 2) + '\n'
  await writeFile(statePath, json)
  if (existsSync(dirname(publicState))) await writeFile(publicState, json)
}

app.get('/api/state', async (_req, res) => {
  try { res.json(await readState()) }
  catch (e) { res.status(500).json({ error: String(e) }) }
})

// Patch today's (or any day's) log: { date?, patch }
app.post('/api/day', async (req, res) => {
  try {
    const { date = localDate(), patch = {} } = req.body || {}
    const state = await readState()
    deepMerge(ensureDay(state, date), patch)
    await persist(state)
    res.json(state)
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

// Bodyweight: upsert weightLog + set the day's weight.
app.post('/api/weight', async (req, res) => {
  try {
    const { date = localDate(), kg } = req.body || {}
    if (typeof kg !== 'number') return res.status(400).json({ error: 'kg (number) required' })
    const state = await readState()
    ensureDay(state, date).weight = kg
    state.weightLog ||= []
    const existing = state.weightLog.find((w) => w.date === date)
    if (existing) existing.kg = kg
    else state.weightLog.push({ date, kg })
    state.weightLog.sort((a, b) => a.date.localeCompare(b.date))
    await persist(state)
    res.json(state)
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

// Apple Health push from an iOS Shortcut: { date?, steps?, workouts? }
app.post('/api/health', async (req, res) => {
  try {
    const { date = localDate(), steps, workouts } = req.body || {}
    const state = await readState()
    const day = ensureDay(state, date)
    if (steps != null) day.steps = Number(steps) || 0
    if (Array.isArray(workouts) && workouts.length) {
      day.workout = { did: true, type: String(workouts[0].type || workouts[0] || 'workout'), source: 'health' }
    }
    await persist(state)
    res.json({ ok: true, date, steps: day.steps })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(resolve(distDir, 'index.html')))
}

app.listen(PORT, () => console.log(`[localfit] http://localhost:${PORT}`))
