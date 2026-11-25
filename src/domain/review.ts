import type { Application, DsaProblem, DsaReview, Mock, TopicEvent } from '../model/career'
import { TOPIC_STATUSES } from '../model/career'
import type { Area, Checkpoint } from '../model/core'
import type { DayEntry, Habit } from '../model/habits'
import type { MissCause, WeeklyReview } from '../model/review'
import { rollingAverage, type DatedValue } from './body/weight'
import { mockAverage } from './career'
import type { HabitContext } from './habits/context'
import { groupCompliance, ratio, trackStatus, type TrackStatus } from './habits/compliance'
import { isActiveOn } from './habits/rules'
import { strengthScore } from './habits/strength'
import { addDays, endOfWeek, formatDay, monthOf, startOfWeek, weekday, type DayKey, type Weekday } from './time/day'

// ── Which review is due ─────────────────────────────────────

/**
 * The week a weekly review covers: this week from its last day (Sunday)
 * on, otherwise last week (a review not done on Sunday is still due).
 */
export function reviewWeekStart(today: DayKey, weekStartsOn: Weekday): DayKey {
  const thisWeek = startOfWeek(today, weekStartsOn)
  return endOfWeek(today, weekStartsOn) === today ? thisWeek : addDays(thisWeek, -7)
}

/** The week whose review is due (and not finished), or null. */
export function dueWeeklyReview(
  today: DayKey,
  planStart: DayKey,
  weekStartsOn: Weekday,
  completedWeeks: ReadonlySet<DayKey>,
): DayKey | null {
  const week = reviewWeekStart(today, weekStartsOn)
  if (endOfWeek(week, weekStartsOn) < planStart) return null
  return completedWeeks.has(week) ? null : week
}

/** The month a monthly review covers: the previous month, from the 1st on. */
export function reviewMonth(today: DayKey): string {
  return monthOf(addDays(`${monthOf(today)}-01`, -1))
}

export function dueMonthlyReview(today: DayKey, planStart: DayKey, completedMonths: ReadonlySet<string>): string | null {
  const month = reviewMonth(today)
  if (`${month}-31` < planStart) return null
  return completedMonths.has(month) ? null : month
}

export function describeWeek(weekStart: DayKey): string {
  const end = addDays(weekStart, 6)
  return `${formatDay(weekStart, { day: 'numeric', month: 'short' })} – ${formatDay(end, { day: 'numeric', month: 'short' })}`
}

// ── Scoreboard ──────────────────────────────────────────────

export interface AreaScore {
  areaId: string
  name: string
  color: string
  compliance: number | null
  status: TrackStatus
  habits: Array<{ id: string; name: string; strength: number; compliance: number | null }>
}

export interface WeeklyScoreboard {
  weekStart: DayKey
  weekEnd: DayKey
  areas: AreaScore[]
  dsa: { newProblems: number; reviewsDone: number; reviewsStillDue: number }
  topicsMoved: number
  lag: {
    weightAvg?: number
    weightAvgPrev?: number
    latestMock?: { day: DayKey; type: string; average: number; communication: number }
    applicationsMoved: number
  }
}

const statusRank = (s: string) => TOPIC_STATUSES.indexOf(s as (typeof TOPIC_STATUSES)[number])

export function weeklyScoreboard(input: {
  weekStart: DayKey
  weekStartsOn: Weekday
  areas: readonly Area[]
  habits: readonly Habit[]
  ctx: HabitContext
  problems: readonly DsaProblem[]
  reviews: readonly DsaReview[]
  topicEvents: readonly TopicEvent[]
  dayEntries: readonly DayEntry[]
  mocks: readonly Mock[]
  applications: readonly Application[]
}): WeeklyScoreboard {
  const { weekStart, ctx } = input
  const weekEnd = endOfWeek(weekStart, input.weekStartsOn)
  const inWeek = (d: DayKey) => d >= weekStart && d <= weekEnd

  const areas: AreaScore[] = input.areas
    .filter((a) => !a.archivedAt)
    .map((a) => {
      const habits = input.habits.filter((h) => h.areaId === a.id && (isActiveOn(h, weekEnd) || isActiveOn(h, weekStart)))
      const r = ratio(groupCompliance(habits, ctx, weekStart, weekEnd))
      return {
        areaId: a.id,
        name: a.name,
        color: a.color,
        compliance: r,
        status: trackStatus(r),
        habits: habits.map((h) => ({
          id: h.id,
          name: h.name,
          strength: strengthScore(h, ctx),
          compliance: ratio(groupCompliance([h], ctx, weekStart, weekEnd)),
        })),
      }
    })

  const weights: DatedValue[] = input.dayEntries.flatMap((e) => (e.metrics.weightKg !== undefined ? [{ day: e.day, value: e.metrics.weightKg }] : []))
  const mocksSoFar = input.mocks.filter((m) => m.day <= weekEnd).sort((a, b) => (a.day < b.day ? 1 : -1))
  const latest = mocksSoFar[0]

  return {
    weekStart,
    weekEnd,
    areas,
    dsa: {
      newProblems: input.problems.filter((p) => inWeek(p.day)).length,
      reviewsDone: input.reviews.filter((r) => inWeek(r.day)).length,
      reviewsStillDue: input.problems.filter((p) => !p.srs.graduated && p.srs.dueDay <= weekEnd).length,
    },
    topicsMoved: input.topicEvents.filter((e) => inWeek(e.day) && statusRank(e.to) > statusRank(e.from)).length,
    lag: {
      weightAvg: rollingAverage(weights, weekEnd),
      weightAvgPrev: rollingAverage(weights, addDays(weekEnd, -7)),
      latestMock: latest
        ? { day: latest.day, type: latest.type, average: Math.round(mockAverage(latest) * 10) / 10, communication: latest.scores.communication }
        : undefined,
      applicationsMoved: input.applications.reduce((n, a) => n + a.history.filter((h) => inWeek(h.day) && h.stage !== 'target').length, 0),
    },
  }
}

// ── Share text ──────────────────────────────────────────────

export const MISS_CAUSES: ReadonlyArray<{ value: MissCause; label: string }> = [
  { value: 'time', label: 'Time' },
  { value: 'energy', label: 'Energy' },
  { value: 'forgot', label: 'Forgot' },
  { value: 'too_hard', label: 'Too hard' },
  { value: 'unclear_plan', label: 'Unclear plan' },
]

const STATUS_TEXT: Record<TrackStatus, string> = {
  on_track: 'on track',
  slipping: 'slipping',
  off_track: 'off track',
  no_data: 'no data',
}

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

/** A plain-text weekly summary for an accountability partner (WhatsApp-friendly). */
export function weeklyShareText(review: Pick<WeeklyReview, 'wins' | 'misses' | 'change' | 'commitments'>, board: WeeklyScoreboard, areas: readonly Area[]): string {
  const areaName = new Map(areas.map((a) => [a.id, a.name]))
  const lines = [`Compound weekly review · ${describeWeek(board.weekStart)}`, '']
  lines.push(...board.areas.map((a) => `${a.name}: ${pct(a.compliance)} (${STATUS_TEXT[a.status]})`))
  lines.push('', `DSA: ${board.dsa.newProblems} new, ${board.dsa.reviewsDone} reviews · topics moved: ${board.topicsMoved}`)
  if (board.lag.weightAvg !== undefined) {
    const delta = board.lag.weightAvgPrev !== undefined ? ` (${board.lag.weightAvg - board.lag.weightAvgPrev >= 0 ? '+' : ''}${(board.lag.weightAvg - board.lag.weightAvgPrev).toFixed(1)})` : ''
    lines.push(`Weight, 7-day avg: ${board.lag.weightAvg.toFixed(1)} kg${delta}`)
  }
  if (board.lag.latestMock) lines.push(`Latest mock: ${board.lag.latestMock.average}/4 (communication ${board.lag.latestMock.communication}/4)`)
  const wins = review.wins.filter(Boolean)
  if (wins.length) lines.push('', 'Wins:', ...wins.map((w) => `• ${w}`))
  const misses = review.misses.filter((m) => m.text)
  if (misses.length) lines.push('', 'Misses:', ...misses.map((m) => `• ${m.text} (${MISS_CAUSES.find((c) => c.value === m.cause)?.label.toLowerCase()})`))
  if (review.change) lines.push('', `Change for next week: ${review.change}`)
  const commitments = review.commitments.filter((c) => c.text.trim())
  if (commitments.length) lines.push('', 'Commitments:', ...commitments.map((c) => `• ${areaName.get(c.areaId) ?? c.areaId}: ${c.text}`))
  return lines.join('\n')
}

/** Checkpoints dated in a month (for the monthly review). */
export function checkpointsInMonth(checkpoints: readonly Checkpoint[], month: string): Checkpoint[] {
  return checkpoints.filter((c) => monthOf(c.day) === month).sort((a, b) => (a.day < b.day ? -1 : 1))
}

export function isSunday(day: DayKey): boolean {
  return weekday(day) === 0
}
