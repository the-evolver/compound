import type { Weekday } from '../domain/time/day'
import { cx } from './primitives'

const WEEK: Array<{ day: Weekday; label: string }> = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]

export function WeekdayPicker({ value, onChange, label }: { value: readonly Weekday[]; onChange: (days: Weekday[]) => void; label: string }) {
  const toggle = (d: Weekday) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))
  return (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={label}>
      {WEEK.map(({ day, label: l }) => {
        const on = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(day)}
            className={cx('min-h-11 rounded-xl text-sm font-medium', on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}
