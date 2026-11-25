/** A tiny trend line (no axes), for one value per row in a list. Values are 0–1. */
export function Sparkline({ values, color, label, width = 96, height = 28 }: { values: readonly number[]; color: string; label: string; width?: number; height?: number }) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden="true" />
  const pad = 3
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - Math.max(0, Math.min(1, v)) * (height - pad * 2)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const last = values[values.length - 1]!
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r={3} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  )
}
