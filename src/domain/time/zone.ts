import { addDays, dayToUtcMs, type DayKey } from './day'

export interface WallClock {
  day: DayKey
  hour: number
  minute: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, fmt)
  }
  return fmt
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

/** The calendar day and clock time that an instant shows in a timezone. */
export function wallClock(ms: number, timeZone: string): WallClock {
  const parts: Record<string, string> = {}
  for (const p of formatterFor(timeZone).formatToParts(new Date(ms))) parts[p.type] = p.value
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  }
}

/**
 * The day an instant counts toward. Before `rolloverHour` (e.g. 3 AM) it
 * still counts as the previous day, so a late night logs to the right day.
 */
export function logicalDay(ms: number, timeZone: string, rolloverHour: number): DayKey {
  const wc = wallClock(ms, timeZone)
  return wc.hour < rolloverHour ? addDays(wc.day, -1) : wc.day
}

/** Minutes the timezone is ahead of UTC at an instant (IST: 330). */
export function offsetMinutes(ms: number, timeZone: string): number {
  const wc = wallClock(ms, timeZone)
  const asUtc = dayToUtcMs(wc.day) + (wc.hour * 60 + wc.minute) * 60_000
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000)
}

/** The instant a wall-clock time on a day happens in a timezone. */
export function zonedTimeToUtcMs(day: DayKey, hour: number, minute: number, timeZone: string): number {
  const wall = dayToUtcMs(day) + (hour * 60 + minute) * 60_000
  // Two passes settle the offset even across a daylight-saving change.
  let guess = wall - offsetMinutes(wall, timeZone) * 60_000
  guess = wall - offsetMinutes(guess, timeZone) * 60_000
  return guess
}
