// Copies canonical data/state.json into public/ so the app can fall back to it.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../data/state.json')
const dest = resolve(here, '../public/state.json')

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`[sync] ${src} -> ${dest}`)
} else if (existsSync(dest)) {
  console.log('[sync] using existing public/state.json')
} else {
  console.error('[sync] no data found')
  process.exit(1)
}
