import { describe, expect, it } from 'vitest'
import { zHabit } from '../model'
import { buildSeed } from '../../tests/fixtures/samplePlan'
import { backupState, describeBackup, fingerprint } from './backupStatus'
import { toCsv } from './csv'
import { buildIcs, foldLine, icsEvents, icsFingerprint, type IcsInput } from './ics'
import { DAY_MS } from './time/day'

describe('CSV', () => {
  it('quotes only when needed and uses CRLF with a BOM', () => {
    const csv = toCsv(['day', 'title', 'n'], [
      { day: '2026-12-01', title: 'Two Sum, "easy"', n: 3 },
      { day: '2026-12-02', title: 'Line\nbreak', n: undefined },
    ])
    expect(csv).toBe('﻿day,title,n\r\n2026-12-01,"Two Sum, ""easy""",3\r\n2026-12-02,"Line\nbreak",\r\n')
  })
})

describe('backup age', () => {
  const now = Date.UTC(2026, 11, 20, 12)
  it('is "never" before the first backup', () => {
    expect(backupState(undefined, now, 7)).toEqual({ kind: 'never' })
    expect(describeBackup({ kind: 'never' })).toBe('No backup yet')
  })
  it('turns stale after the nudge threshold', () => {
    expect(backupState(now - 6 * DAY_MS, now, 7)).toEqual({ kind: 'fresh', days: 6 })
    expect(backupState(now - 7 * DAY_MS, now, 7)).toEqual({ kind: 'stale', days: 7 })
    expect(describeBackup({ kind: 'fresh', days: 1 })).toBe('Last backup: yesterday')
  })
  it('fingerprints strings stably', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'))
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'))
  })
})

describe('calendar file', () => {
  const seed = buildSeed({
    startDay: '2026-12-01',
    weightKg: 80,
    weekdayHours: 2.75,
    weekendHours: 5.5,
    workoutDays: [1, 3, 5],
    workoutTime: '07:00',
    today: '2026-11-25',
    now: 0,
  })
  const input: IcsInput = {
    habits: seed.habits.map((h) => zHabit.parse(h)),
    timeZone: 'Asia/Kolkata',
    planStart: '2026-12-01',
    planEnd: '2027-08-31',
    reviewTime: '10:00',
    today: '2026-11-25',
  }
  const events = icsEvents(input)
  const byUid = new Map(events.map((e) => [e.uid, e]))

  it('makes one repeating event per habit reminder, starting on its first due day', () => {
    const workout = byUid.get('compound-habit-workout')!
    expect(workout.start).toBe('2026-12-02') // first Mon/Wed/Fri on or after Tue 1 Dec
    expect(workout.time).toBe('07:00')
    // UNTIL is 23:59 IST on 31 Aug 2027, in UTC
    expect(workout.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20270831T182900Z')
    expect(byUid.get('compound-habit-dsa-daily')!.rrule).toMatch(/^FREQ=DAILY;/)
  })

  it('starts queued habits on their activation date and reminds N-per-week habits on their reminder days', () => {
    expect(byUid.get('compound-habit-pm-routine')!.start).toBe('2026-12-15')
    const quests = byUid.get('compound-habit-people-quests')!
    expect(quests.start).toBe('2027-01-04') // first Monday on or after 29 Dec
    expect(quests.rrule).toMatch(/^FREQ=WEEKLY;BYDAY=MO;/)
  })

  it('leaves out habits without a reminder time and adds the reviews', () => {
    expect(byUid.has('compound-habit-protein')).toBe(false)
    expect(byUid.get('compound-weekly-review')).toMatchObject({ start: '2026-12-06', time: '10:00' })
    expect(byUid.get('compound-monthly-review')).toMatchObject({ start: '2027-01-01' })
  })

  it('writes a valid calendar: CRLF, folded lines, escaped text, a fixed-offset timezone', () => {
    const ics = buildIcs(input, Date.UTC(2026, 10, 25, 8, 30))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('TZOFFSETTO:+0530')
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261202T070000')
    expect(ics).toContain('DTSTAMP:20261125T083000Z')
    const lines = ics.split('\r\n')
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(ics).toContain('\\,') // commas in text are escaped
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(events.length)
  })

  it('ends the midnight sleep reminder on the next day', () => {
    const ics = buildIcs(input, 0)
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261229T000000')
    expect(ics).toContain('DTEND;TZID=Asia/Kolkata:20261229T001500')
  })

  it('folds by bytes without splitting characters', () => {
    const folded = foldLine(`DESCRIPTION:${'≥'.repeat(40)}`)
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'≥'.repeat(40)}`)
  })

  it('fingerprints the reminders, ignoring the export time', () => {
    const a = icsFingerprint(input)
    expect(icsFingerprint({ ...input })).toBe(a)
    const changed = { ...input, habits: input.habits.map((h) => (h.id === 'habit:workout' ? { ...h, reminderTime: '06:30' } : h)) }
    expect(icsFingerprint(changed)).not.toBe(a)
  })
})
