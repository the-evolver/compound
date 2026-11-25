import type { Amount, Completion, Schedule } from '../../model/habits'
import type { Weekday } from '../time/day'
import { LOG_SOURCES, METRICS } from '../metrics'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Monday-first, e.g. "Mon/Wed/Fri". */
export function describeDays(days: readonly Weekday[]): string {
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAY_SHORT[d])
    .join('/')
}

export function describeSchedule(s: Schedule): string {
  switch (s.kind) {
    case 'daily':
      return 'Every day'
    case 'weekdays':
      return 'Weekdays'
    case 'days':
      return describeDays(s.days)
    case 'perWeek':
      return `${s.times}× a week`
  }
}

export function describeAmount(a: Amount, unit = ''): string {
  const u = unit ? ` ${unit}` : ''
  switch (a.kind) {
    case 'fixed':
      return `${a.value.toLocaleString('en-IN')}${u}`
    case 'weekdayWeekend':
      return `${a.weekday}${u} on weekdays, ${a.weekend}${u} on weekends`
    case 'perKgBodyweight':
      return `${a.perKg} ${unit || ''} per kg bodyweight`.replace(/\s+/g, ' ')
  }
}

export function describeCompletion(c: Completion): string {
  switch (c.kind) {
    case 'manual':
      return 'Tap Done on Today'
    case 'metric': {
      const def = (METRICS as Record<string, { label: string; unit: string }>)[c.metric]
      return `${def?.label ?? c.metric} reaches ${describeAmount(c.target, def?.unit)}`
    }
    case 'log': {
      const src = (LOG_SOURCES as Record<string, { label: string; unit: string }>)[c.source]
      return `${src?.label ?? c.source}: ${describeAmount(c.target, src?.unit)}`
    }
  }
}
