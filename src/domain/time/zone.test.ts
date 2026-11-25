import { describe, expect, it } from 'vitest'
import { isValidTimeZone, logicalDay, offsetMinutes, wallClock, zonedTimeToUtcMs } from './zone'

const IST = 'Asia/Kolkata'

describe('timezone and rollover', () => {
  it('reads the wall clock in Asia/Kolkata (UTC+5:30)', () => {
    expect(wallClock(Date.UTC(2026, 11, 1, 18, 45), IST)).toEqual({ day: '2026-12-02', hour: 0, minute: 15 })
  })

  it('counts time before the rollover hour toward the previous day', () => {
    // 02:30 IST on 2 Dec
    expect(logicalDay(Date.UTC(2026, 11, 1, 21, 0), IST, 3)).toBe('2026-12-01')
    // 03:00 IST on 2 Dec: the new day has started
    expect(logicalDay(Date.UTC(2026, 11, 1, 21, 30), IST, 3)).toBe('2026-12-02')
    // With a midnight rollover, 02:30 is already the next day
    expect(logicalDay(Date.UTC(2026, 11, 1, 21, 0), IST, 0)).toBe('2026-12-02')
  })

  it('handles the year boundary', () => {
    // 01:00 IST on 1 Jan 2027 still counts as 31 Dec
    expect(logicalDay(Date.UTC(2026, 11, 31, 19, 30), IST, 3)).toBe('2026-12-31')
  })

  it('converts wall-clock times to instants and back', () => {
    expect(offsetMinutes(Date.UTC(2026, 11, 1), IST)).toBe(330)
    expect(zonedTimeToUtcMs('2026-12-01', 7, 0, IST)).toBe(Date.UTC(2026, 11, 1, 1, 30))
    // Daylight saving: GMT in winter, BST (UTC+1) in summer
    expect(zonedTimeToUtcMs('2027-01-15', 9, 0, 'Europe/London')).toBe(Date.UTC(2027, 0, 15, 9, 0))
    expect(zonedTimeToUtcMs('2027-07-01', 9, 0, 'Europe/London')).toBe(Date.UTC(2027, 6, 1, 8, 0))
  })

  it('validates timezone names', () => {
    expect(isValidTimeZone(IST)).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })
})
