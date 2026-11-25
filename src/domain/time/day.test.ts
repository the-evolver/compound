import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  eachDay,
  endOfWeek,
  formatDay,
  isDayKey,
  isWeekend,
  makeDay,
  startOfMonth,
  startOfWeek,
  weekday,
} from './day'

describe('day keys', () => {
  it('accepts only real calendar days in YYYY-MM-DD form', () => {
    expect(isDayKey('2026-12-01')).toBe(true)
    expect(isDayKey('2028-02-29')).toBe(true)
    expect(isDayKey('2027-02-29')).toBe(false)
    expect(isDayKey('2026-2-01')).toBe(false)
    expect(isDayKey('2026-12-01T00:00')).toBe(false)
    expect(isDayKey(20261201)).toBe(false)
  })

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
    expect(makeDay(2027, 8, 31)).toBe('2027-08-31')
  })

  it('counts days between two days', () => {
    expect(daysBetween('2026-12-01', '2027-08-31')).toBe(273)
    expect(daysBetween('2026-12-02', '2026-12-01')).toBe(-1)
  })

  it('knows weekdays and weeks (Monday start by default)', () => {
    expect(weekday('2026-12-01')).toBe(2) // Tuesday
    expect(weekday('2026-12-06')).toBe(0) // Sunday
    expect(isWeekend('2026-12-05')).toBe(true)
    expect(isWeekend('2026-12-07')).toBe(false)
    expect(startOfWeek('2026-12-06')).toBe('2026-11-30')
    expect(startOfWeek('2026-11-30')).toBe('2026-11-30')
    expect(endOfWeek('2026-12-01')).toBe('2026-12-06')
    expect(startOfWeek('2026-12-06', 0)).toBe('2026-12-06')
    expect(startOfMonth('2027-02-17')).toBe('2027-02-01')
  })

  it('lists every day of a range, inclusive', () => {
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    expect(eachDay('2026-12-02', '2026-12-01')).toEqual([])
  })

  it('formats without shifting the day', () => {
    expect(formatDay('2026-12-01', { weekday: 'short', day: 'numeric', month: 'short' })).toBe('Tue, 1 Dec')
  })
})
