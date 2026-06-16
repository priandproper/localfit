export default function Ring({ value, target, unit = '', color = '#34d399' }) {
  const pct = target ? Math.min(1, value / target) : 0
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums text-white">{value.toLocaleString()}</span>
        <span className="text-[11px] text-slate-500">/ {target.toLocaleString()} {unit}</span>
        <span className="mt-0.5 text-xs font-medium" style={{ color }}>{Math.round(pct * 100)}%</span>
      </div>
    </div>
  )
}
