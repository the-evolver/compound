import type { Habit, Schedule } from '../model/habits'
import { fingerprint } from './backupStatus'
import { ruleOn } from './habits/rules'
import { addDays, maxDay, minDay, weekday, type DayKey, type Weekday } from './time/day'
import { offsetMinutes, zonedTimeToUtcMs } from './time/zone'

/*
 * Calendar file (.ics) with a repeating event for each habit's reminder time
 * plus the weekly and monthly reviews. The phone's calendar does the
 * reminding, so no server or push notifications are needed.
 */

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

export interface IcsEvent {
  uid: string
  summary: string
  description: string
  /** First occurrence (a day that matches the rule). */
  start: DayKey
  time: string
  minutes: number
  rrule: string
}

export interface IcsInput {
  habits: readonly Habit[]
  timeZone: string
  planStart: DayKey
  planEnd: DayKey
  reviewTime: string
  today: DayKey
}

function parseTime(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number)
  return [h ?? 0, m ?? 0]
}

function basicUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function basicLocal(day: DayKey, time: string): string {
  return `${day.replace(/-/g, '')}T${time.replace(':', '')}00`
}

/** First day on or after `from` whose weekday is in `days`. */
function firstMatching(from: DayKey, days: readonly Weekday[]): DayKey {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i)
    if (days.includes(weekday(d))) return d
  }
  return from
}

/** Weekdays a habit should be reminded on, or null for every day; undefined when it has no reminder. */
function reminderDaysFor(habit: Habit, schedule: Schedule): readonly Weekday[] | null | undefined {
  switch (schedule.kind) {
    case 'daily':
      return null
    case 'weekdays':
      return [1, 2, 3, 4, 5]
    case 'days':
      return schedule.days
    case 'perWeek':
      return habit.reminderDays?.length ? habit.reminderDays : undefined
  }
}

/** The events the calendar file will contain. Habits without a reminder time are left out. */
export function icsEvents(input: IcsInput): IcsEvent[] {
  const events: IcsEvent[] = []
  const until = (last: DayKey) => basicUtc(zonedTimeToUtcMs(last, 23, 59, input.timeZone))

  for (const habit of input.habits) {
    if (!habit.reminderTime || !habit.activeFrom) continue
    const last = habit.endedOn ? minDay(input.planEnd, addDays(habit.endedOn, -1)) : input.planEnd
    if (last < habit.activeFrom) continue
    const rule = ruleOn(habit, maxDay(habit.activeFrom, input.today))
    const days = reminderDaysFor(habit, rule.schedule)
    if (days === undefined) continue
    const start = days === null ? habit.activeFrom : firstMatching(habit.activeFrom, days)
    const freq = days === null ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`
    events.push({
      uid: `compound-${habit.id.replace(/[^a-z0-9-]/gi, '-')}`,
      summary: habit.name,
      description: [habit.ifThen, habit.obstacle, `Minimum: ${habit.minVersion}`].filter(Boolean).join('\n'),
      start,
      time: habit.reminderTime,
      minutes: 15,
      rrule: `${freq};UNTIL=${until(last)}`,
    })
  }

  const firstSunday = firstMatching(input.planStart, [0])
  events.push({
    uid: 'compound-weekly-review',
    summary: 'Weekly review (15 min)',
    description: 'Open Compound → Review. Scoreboard, lag check, wins, misses, one change, commitments for next week.',
    start: firstSunday,
    time: input.reviewTime,
    minutes: 15,
    rrule: `FREQ=WEEKLY;BYDAY=SU;UNTIL=${until(input.planEnd)}`,
  })

  // The first monthly review is the first 1st after the start: there is a month behind it to review.
  const firstOfMonth = `${addDays(`${input.planStart.slice(0, 7)}-01`, 31).slice(0, 7)}-01`
  events.push({
    uid: 'compound-monthly-review',
    summary: 'Monthly review',
    description: 'Open Compound → Review. Lag measures vs plan, checkpoint results, then keep, adjust targets, or activate the next queued habits.',
    start: firstOfMonth,
    time: input.reviewTime,
    minutes: 20,
    rrule: `FREQ=MONTHLY;BYMONTHDAY=1;UNTIL=${until(input.planEnd)}`,
  })

  return events
}

/** Changes whenever the reminders would change, so the app can offer a new file. */
export function icsFingerprint(input: IcsInput): string {
  return fingerprint(JSON.stringify({ tz: input.timeZone, events: icsEvents(input) }))
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

const encoder = new TextEncoder()

/** Folds a content line at 75 bytes, as RFC 5545 requires, without splitting a character. */
export function foldLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    const limit = parts.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** VTIMEZONE for zones with a fixed offset (like Asia/Kolkata). Other zones rely on their IANA name. */
function vtimezone(timeZone: string, year: number): string[] {
  const jan = offsetMinutes(Date.UTC(year, 0, 1), timeZone)
  const jul = offsetMinutes(Date.UTC(year, 6, 1), timeZone)
  if (jan !== jul) return []
  const sign = jan >= 0 ? '+' : '-'
  const abs = Math.abs(jan)
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${timeZone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${off}`,
    `TZOFFSETTO:${off}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

export function buildIcs(input: IcsInput, now: number): string {
  const stamp = basicUtc(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Compound//Habit reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Compound',
    `X-WR-TIMEZONE:${input.timeZone}`,
    ...vtimezone(input.timeZone, Number(input.planStart.slice(0, 4))),
  ]
  for (const e of icsEvents(input)) {
    const [h, m] = parseTime(e.time)
    const endMinutes = h * 60 + m + e.minutes
    const endDay = endMinutes >= 24 * 60 ? addDays(e.start, 1) : e.start
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@compound`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${input.timeZone}:${basicLocal(e.start, e.time)}`,
      `DTEND;TZID=${input.timeZone}:${basicLocal(endDay, endTime)}`,
      `RRULE:${e.rrule}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.summary)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
