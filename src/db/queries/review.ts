import { weeklyScoreboard, type WeeklyScoreboard } from '../../domain/review'
import type { DayKey, Weekday } from '../../domain/time/day'
import { db } from '../db'
import { loadHabitData } from './habitData'

/** Everything for a week's scoreboard, computed from the current data. */
export async function loadWeeklyScoreboard(weekStart: DayKey, today: DayKey, weekStartsOn: Weekday): Promise<WeeklyScoreboard> {
  const [{ areas, habits, dayEntries, ctx }, problems, reviews, topicEvents, mocks, applications] = await Promise.all([
    loadHabitData(today, weekStartsOn),
    db.dsaProblems.toArray(),
    db.dsaReviews.toArray(),
    db.topicEvents.toArray(),
    db.mocks.toArray(),
    db.applications.toArray(),
  ])
  return weeklyScoreboard({ weekStart, weekStartsOn, areas, habits, ctx, problems, reviews, topicEvents, dayEntries, mocks, applications })
}

/** Which weekly and monthly reviews exist and are finished. */
export async function loadReviewIndex(): Promise<{ completedWeeks: Set<DayKey>; completedMonths: Set<string> }> {
  const [weeks, months] = await Promise.all([db.weeklyReviews.toArray(), db.monthlyReviews.toArray()])
  return {
    completedWeeks: new Set(weeks.filter((w) => w.completedAt).map((w) => w.weekStart)),
    completedMonths: new Set(months.filter((m) => m.completedAt).map((m) => m.month)),
  }
}
