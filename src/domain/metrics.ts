/**
 * Daily numbers shown in Today's quick numbers row. Values are stored in
 * DayEntry.metrics under these keys. Adding a metric is one entry here; no
 * database change.
 */
export interface MetricDef {
  key: string
  label: string
  unit: string
  step: number
  min: number
  max: number
  decimals: number
  /** Not expected every day (shown smaller, never nags). */
  optional?: boolean
}

export const METRICS = {
  steps: { key: 'steps', label: 'Steps', unit: '', step: 500, min: 0, max: 60_000, decimals: 0 },
  proteinG: { key: 'proteinG', label: 'Protein', unit: 'g', step: 10, min: 0, max: 400, decimals: 0 },
  sleepH: { key: 'sleepH', label: 'Sleep', unit: 'h', step: 0.5, min: 0, max: 14, decimals: 1 },
  weightKg: { key: 'weightKg', label: 'Weight', unit: 'kg', step: 0.1, min: 30, max: 250, decimals: 1, optional: true },
} as const satisfies Record<string, MetricDef>

export type MetricKey = keyof typeof METRICS

export const METRIC_LIST: readonly MetricDef[] = Object.values(METRICS)

export function roundToMetric(def: MetricDef, value: number): number {
  const f = 10 ** def.decimals
  return Math.min(def.max, Math.max(def.min, Math.round(value * f) / f))
}

/**
 * Logs that can complete a habit ("log" completion). Each counts entries per
 * day; the database layer supplies the counts (see db/evidence.ts).
 */
export const LOG_SOURCES = {
  dsa: { label: 'DSA items (new problems + reviews)', unit: 'items' },
  study: { label: 'Study sessions done', unit: 'sessions' },
  workout: { label: 'Workouts (home session counts as half)', unit: 'sessions' },
  drill: { label: 'Speaking drills', unit: 'drills' },
  mock: { label: 'Mock interviews', unit: 'mocks' },
  applicationMoves: { label: 'Applications moved forward', unit: 'moves' },
} as const

export type LogSourceKey = keyof typeof LOG_SOURCES

/** Occasional measurements (Measurement.kind). */
export const MEASUREMENT_KINDS = {
  waistCm: { label: 'Waist', unit: 'cm', cadence: 'weekly' },
  pushupsMax: { label: 'Max push-ups', unit: 'reps', cadence: 'monthly' },
  plankSec: { label: 'Plank', unit: 's', cadence: 'monthly' },
  run2kSec: { label: '2 km run', unit: 's', cadence: 'monthly' },
  bodyPhoto: { label: 'Progress photo', unit: '', cadence: 'monthly' },
  skinPhoto: { label: 'Skin photo', unit: '', cadence: 'checkpoint' },
} as const

export type MeasurementKind = keyof typeof MEASUREMENT_KINDS
