import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { cx } from './primitives'

function format(value: number | undefined, decimals: number): string {
  return value === undefined ? '' : value.toFixed(decimals)
}

/**
 * A number with big −/+ buttons for one-handed use. The value can also be
 * typed. `start` is where the buttons begin when there is no value yet
 * (e.g. last time's number).
 */
export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  decimals = 0,
  start,
  unit,
  label,
  size = 'md',
  showUnit = true,
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  step: number
  min: number
  max: number
  decimals?: number
  start?: number
  unit?: string
  label: string
  size?: 'md' | 'sm'
  /** Hide the unit next to the number (e.g. when a column heading shows it); screen readers still hear it. */
  showUnit?: boolean
}) {
  const [text, setText] = useState(format(value, decimals))
  useEffect(() => {
    setText(format(value, decimals))
  }, [value, decimals])

  const clamp = (n: number) => {
    const f = 10 ** decimals
    return Math.min(max, Math.max(min, Math.round(n * f) / f))
  }
  const bump = (dir: 1 | -1) => {
    // First tap with no value: last time's number if there is one, else one step up.
    if (value === undefined) return onChange(clamp(start ?? min + step))
    onChange(clamp(value + dir * step))
  }
  const commitText = () => {
    const trimmed = text.trim()
    if (trimmed === '') return onChange(undefined)
    const n = Number(trimmed.replace(',', '.'))
    if (Number.isFinite(n)) onChange(clamp(n))
    else setText(format(value, decimals))
  }

  const btn = cx(
    'grid shrink-0 place-items-center rounded-xl bg-surface-2 text-text active:bg-line disabled:opacity-30',
    size === 'md' ? 'size-12' : 'size-10',
  )

  return (
    <div className={cx('flex items-center', size === 'md' ? 'gap-2' : 'gap-1')}>
      <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value !== undefined && value <= min} onClick={() => bump(-1)}>
        <Icon name="minus" />
      </button>
      <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <input
          aria-label={unit ? `${label} (${unit})` : label}
          inputMode={decimals ? 'decimal' : 'numeric'}
          className={cx(
            'w-full min-w-0 bg-transparent text-center font-semibold tabular-nums outline-none placeholder:text-faint',
            size === 'md' ? 'text-xl' : 'text-lg',
          )}
          value={text}
          placeholder={start !== undefined ? format(start, decimals) : '–'}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {unit && showUnit && (
          <span className="shrink-0 text-sm text-muted" aria-hidden="true">
            {unit}
          </span>
        )}
      </label>
      <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={value !== undefined && value >= max} onClick={() => bump(1)}>
        <Icon name="plus" />
      </button>
    </div>
  )
}
