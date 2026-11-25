import { addDays, type DayKey } from '../time/day'

export interface DatedValue {
  day: DayKey
  value: number
}

/**
 * Average of the values in the `window` days ending on `day` (inclusive).
 * Undefined when there are none. Shows the trend, not daily water noise.
 */
export function rollingAverage(values: readonly DatedValue[], day: DayKey, window = 7): number | undefined {
  const from = addDays(day, -(window - 1))
  let sum = 0
  let n = 0
  for (const v of values) {
    if (v.day >= from && v.day <= day) {
      sum += v.value
      n++
    }
  }
  return n ? sum / n : undefined
}

/** The most recent value on or before `day`. */
export function latestOnOrBefore(values: readonly DatedValue[], day: DayKey): DatedValue | undefined {
  let best: DatedValue | undefined
  for (const v of values) if (v.day <= day && (!best || v.day > best.day)) best = v
  return best
}

/** Weight to use for per-kg targets: the 7-day average, or the last known weight. */
export function referenceWeight(values: readonly DatedValue[], day: DayKey): number | undefined {
  return rollingAverage(values, day) ?? latestOnOrBefore(values, day)?.value
}
