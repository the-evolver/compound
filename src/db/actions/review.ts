import { clock } from '../../domain/time/clock'
import { addDays, type DayKey } from '../../domain/time/day'
import type { MonthlyReview, WeeklyReview } from '../../model/review'
import { db } from '../db'
import { newId, putRow } from '../repo'

// ── Weekly ──────────────────────────────────────────────────

/** Gets the review for a week, creating it on first open. */
export async function ensureWeeklyReview(weekStart: DayKey): Promise<WeeklyReview> {
  const existing = await db.weeklyReviews.get(weekStart)
  if (existing) return existing
  return putRow('weeklyReviews', { id: weekStart, weekStart, startedAt: clock.now() })
}

export async function saveWeeklyDraft(
  id: string,
  patch: Partial<Pick<WeeklyReview, 'step' | 'wins' | 'misses' | 'change' | 'commitments'>>,
): Promise<void> {
  const r = await db.weeklyReviews.get(id)
  if (r) await putRow('weeklyReviews', { ...r, ...patch })
}

/**
 * Finishes a review: freezes the scoreboard and turns the commitments into
 * tasks for the following week, which show on Today.
 */
export async function completeWeeklyReview(id: string, snapshot: Record<string, unknown>): Promise<void> {
  const now = clock.now()
  await db.transaction('rw', db.weeklyReviews, db.tasks, async () => {
    const r = await db.weeklyReviews.get(id)
    if (!r) return
    await putRow('weeklyReviews', { ...r, snapshot, completedAt: r.completedAt ?? now })
    await db.tasks.where('sourceId').equals(id).filter((t) => t.kind === 'commitment').delete()
    const nextWeek = addDays(r.weekStart, 7)
    const commitments = r.commitments.filter((c) => c.text.trim())
    for (const [i, c] of commitments.entries()) {
      await putRow('tasks', { id: newId(), kind: 'commitment', text: c.text.trim(), areaId: c.areaId, sourceId: id, weekStart: nextWeek, createdAt: now + i })
    }
  })
}

// ── Monthly ─────────────────────────────────────────────────

export async function ensureMonthlyReview(month: string): Promise<MonthlyReview> {
  const existing = await db.monthlyReviews.get(month)
  if (existing) return existing
  return putRow('monthlyReviews', { id: month, month, startedAt: clock.now() })
}

export async function saveMonthlyDraft(id: string, patch: Partial<Pick<MonthlyReview, 'notes' | 'decisions' | 'step'>>): Promise<void> {
  const r = await db.monthlyReviews.get(id)
  if (r) await putRow('monthlyReviews', { ...r, ...patch })
}

export async function recordMonthlyDecision(id: string, decision: MonthlyReview['decisions'][number]): Promise<void> {
  const r = await db.monthlyReviews.get(id)
  if (r) await putRow('monthlyReviews', { ...r, decisions: [...r.decisions, decision] })
}

export async function completeMonthlyReview(id: string, snapshot: Record<string, unknown>): Promise<void> {
  const r = await db.monthlyReviews.get(id)
  if (r) await putRow('monthlyReviews', { ...r, snapshot, completedAt: r.completedAt ?? clock.now() })
}
