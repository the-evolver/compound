/**
 * Calendar days as 'YYYY-MM-DD' strings ("day keys").
 *
 * Every stored date in the app is a day key or an epoch-ms timestamp, never a
 * Date object, so data survives a JSON export/import unchanged. Day arithmetic
 * runs on UTC midnight, so it never depends on the device's own timezone or
 * on daylight-saving shifts.
 */
export type DayKey = string

/** 0 = Sunday … 6 = Saturday (same as Date#getUTCDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DAY_MS = 86_400_000

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string') return false
  const m = DAY_RE.exec(value)
  if (!m) return false
  return utcMsToDay(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) === value
}

export function assertDayKey(value: unknown): DayKey {
  if (!isDayKey(value)) throw new Error(`Not a valid day (YYYY-MM-DD): ${String(value)}`)
  return value
}

export function dayToUtcMs(day: DayKey): number {
  const m = DAY_RE.exec(day)
  if (!m) throw new Error(`Not a valid day (YYYY-MM-DD): ${day}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function utcMsToDay(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10)
}

export function makeDay(year: number, month: number, date: number): DayKey {
  return utcMsToDay(Date.UTC(year, month - 1, date))
}

export function addDays(day: DayKey, n: number): DayKey {
  return utcMsToDay(dayToUtcMs(day) + n * DAY_MS)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dayToUtcMs(to) - dayToUtcMs(from)) / DAY_MS)
}

export function weekday(day: DayKey): Weekday {
  return new Date(dayToUtcMs(day)).getUTCDay() as Weekday
}

export function isWeekend(day: DayKey): boolean {
  const w = weekday(day)
  return w === 0 || w === 6
}

/** The first day of the week containing `day`. Weeks start on Monday by default. */
export function startOfWeek(day: DayKey, weekStartsOn: Weekday = 1): DayKey {
  const back = (weekday(day) - weekStartsOn + 7) % 7
  return addDays(day, -back)
}

export function endOfWeek(day: DayKey, weekStartsOn: Weekday = 1): DayKey {
  return addDays(startOfWeek(day, weekStartsOn), 6)
}

/** Every day from `from` to `to`, both included. Empty when `to` is before `from`. */
export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** 'YYYY-MM' */
export function monthOf(day: DayKey): string {
  return day.slice(0, 7)
}

export function startOfMonth(day: DayKey): DayKey {
  return `${monthOf(day)}-01`
}

export function minDay(a: DayKey, b: DayKey): DayKey {
  return a <= b ? a : b
}

export function maxDay(a: DayKey, b: DayKey): DayKey {
  return a >= b ? a : b
}

/** Inclusive range check; day keys compare correctly as strings. */
export function isWithin(day: DayKey, from: DayKey, to: DayKey): boolean {
  return day >= from && day <= to
}

const formatCache = new Map<string, Intl.DateTimeFormat>()

/**
 * Formats a day for display ("Wed 25 Nov", "25 November 2026", …). The day
 * is already a calendar day, so it is formatted in UTC to avoid shifting.
 */
export function formatDay(day: DayKey, options: Intl.DateTimeFormatOptions, locale = 'en-IN'): string {
  const key = `${locale}|${JSON.stringify(options)}`
  let fmt = formatCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    formatCache.set(key, fmt)
  }
  return fmt.format(new Date(dayToUtcMs(day)))
}
