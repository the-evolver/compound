import {
  APPLICATION_STAGES,
  type Application,
  type ApplicationStage,
  type DsaProblem,
  type DsaReview,
  type Mock,
  type ReviewRating,
  type SrsState,
} from '../model/career'
import { addDays, type DayKey } from './time/day'

/*
 * DSA spaced reviews. `step` is the index of the interval before the next
 * review. A review is a re-solve from scratch, rated Easy / OK / Failed:
 * OK moves one interval on, Easy skips one, Failed starts again at the
 * first interval (tomorrow). Passing the last interval graduates the problem.
 */

export function initialSrs(day: DayKey, intervals: readonly number[]): SrsState {
  return { step: 0, dueDay: addDays(day, intervals[0] ?? 1), graduated: false }
}

export function applyReview(srs: SrsState, rating: ReviewRating, day: DayKey, intervals: readonly number[]): SrsState {
  if (rating === 'failed') return { step: 0, dueDay: addDays(day, intervals[0] ?? 1), graduated: false }
  const next = srs.step + (rating === 'easy' ? 2 : 1)
  if (next >= intervals.length) return { step: intervals.length, dueDay: day, graduated: true }
  return { step: next, dueDay: addDays(day, intervals[next]!), graduated: false }
}

/** Problems due for review on or before `day`, most overdue first. */
export function dueReviews<T extends Pick<DsaProblem, 'srs' | 'day'>>(problems: readonly T[], day: DayKey): T[] {
  return problems
    .filter((p) => !p.srs.graduated && p.srs.dueDay <= day)
    .sort((a, b) => (a.srs.dueDay < b.srs.dueDay ? -1 : a.srs.dueDay > b.srs.dueDay ? 1 : a.day < b.day ? -1 : 1))
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface PatternStat {
  tag: string
  attempts: number
  failures: number
  rate: number
}

/**
 * Patterns sorted by failure rate. An attempt is the first solve or a
 * review; a failure is a first solve where you saw the solution, or a
 * failed review.
 */
export function weakPatterns(problems: readonly DsaProblem[], reviews: readonly DsaReview[]): PatternStat[] {
  const byId = new Map(problems.map((p) => [p.id, p]))
  const stats = new Map<string, { attempts: number; failures: number }>()
  const count = (tags: readonly string[], failed: boolean) => {
    for (const raw of tags) {
      const tag = normalizeTag(raw)
      if (!tag) continue
      const s = stats.get(tag) ?? { attempts: 0, failures: 0 }
      s.attempts++
      if (failed) s.failures++
      stats.set(tag, s)
    }
  }
  for (const p of problems) count(p.tags, p.outcome === 'solution')
  for (const r of reviews) {
    const p = byId.get(r.problemId)
    if (p) count(p.tags, r.rating === 'failed')
  }
  return [...stats.entries()]
    .map(([tag, s]) => ({ tag, ...s, rate: s.failures / s.attempts }))
    .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts || (a.tag < b.tag ? -1 : 1))
}

/** Share of reviews passed (Easy or OK): retention. */
export function reviewPassRate(reviews: readonly DsaReview[]): number | null {
  if (!reviews.length) return null
  return reviews.filter((r) => r.rating !== 'failed').length / reviews.length
}

export function mockAverage(m: Pick<Mock, 'scores'>): number {
  return (m.scores.technical + m.scores.problemSolving + m.scores.communication) / 3
}

// ── Applications ────────────────────────────────────────────

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  target: 'Target',
  referral_asked: 'Referral asked',
  applied: 'Applied',
  oa: 'Online assessment',
  phone: 'Phone screen',
  onsite: 'Onsite',
  offer: 'Offer',
  rejected: 'Rejected',
}

/** The pipeline in order, without the two end states. */
export const PIPELINE: readonly ApplicationStage[] = APPLICATION_STAGES.filter((s) => s !== 'offer' && s !== 'rejected')

export function isOpen(a: Pick<Application, 'stage'>): boolean {
  return a.stage !== 'offer' && a.stage !== 'rejected'
}

/** The next stage forward, or undefined at the end. */
export function nextStage(stage: ApplicationStage): ApplicationStage | undefined {
  const i = PIPELINE.indexOf(stage)
  if (i < 0) return undefined
  return i === PIPELINE.length - 1 ? 'offer' : PIPELINE[i + 1]
}

/** Open applications whose next action is due today or earlier. */
export function dueFollowUps(apps: readonly Application[], day: DayKey): Application[] {
  return apps
    .filter((a) => isOpen(a) && a.nextActionDay !== undefined && a.nextActionDay <= day)
    .sort((a, b) => (a.nextActionDay! < b.nextActionDay! ? -1 : 1))
}

/** How many applications ever reached each stage (from their history). */
export function funnel(apps: readonly Application[]): Array<{ stage: ApplicationStage; count: number }> {
  const order = [...PIPELINE, 'offer' as const]
  return order.map((stage) => {
    const idx = order.indexOf(stage)
    const count = apps.filter((a) => {
      const reached = [a.stage, ...a.history.map((h) => h.stage)].filter((s) => s !== 'rejected')
      return reached.some((s) => order.indexOf(s) >= idx)
    }).length
    return { stage, count }
  })
}
