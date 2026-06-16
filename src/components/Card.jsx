export default function Card({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}
