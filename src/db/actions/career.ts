import { applyReview, initialSrs, normalizeTag } from '../../domain/career'
import { clock } from '../../domain/time/clock'
import type { DayKey } from '../../domain/time/day'
import type { ApplicationStage, ReviewRating } from '../../model/career'
import { db } from '../db'
import { newId, putRow, readKv } from '../repo'
import type { RowInput } from '../tables'

// ── DSA ─────────────────────────────────────────────────────

export type ProblemDraft = Omit<RowInput<'dsaProblems'>, 'id' | 'srs' | 'createdAt'> & { id?: string }

/** Logs a new problem (its first review is due after the first interval) or updates one. */
export async function saveProblem(draft: ProblemDraft): Promise<string> {
  const tags = [...new Set((draft.tags ?? []).map(normalizeTag).filter(Boolean))]
  if (draft.id) {
    const existing = await db.dsaProblems.get(draft.id)
    if (existing) {
      await putRow('dsaProblems', { ...existing, ...draft, tags, id: existing.id })
      return existing.id
    }
  }
  const { srsIntervals } = await readKv('settings')
  const id = newId()
  await putRow('dsaProblems', { ...draft, tags, id, srs: initialSrs(draft.day, srsIntervals), createdAt: clock.now() })
  return id
}

export async function deleteProblem(id: string): Promise<void> {
  await db.transaction('rw', db.dsaProblems, db.dsaReviews, async () => {
    await db.dsaReviews.where('problemId').equals(id).delete()
    await db.dsaProblems.delete(id)
  })
}

/** Records a review (a re-solve from scratch) and schedules the next one. */
export async function reviewProblem(problemId: string, rating: ReviewRating, day: DayKey, minutes?: number): Promise<void> {
  const { srsIntervals } = await readKv('settings')
  await db.transaction('rw', db.dsaProblems, db.dsaReviews, async () => {
    const p = await db.dsaProblems.get(problemId)
    if (!p) return
    await putRow('dsaReviews', { id: newId(), problemId, day, rating, minutes, stepBefore: p.srs.step, at: clock.now() })
    await putRow('dsaProblems', { ...p, srs: applyReview(p.srs, rating, day, srsIntervals) })
  })
}

/** Every pattern tag used so far, most used first, for quick picking. */
export async function knownTags(): Promise<string[]> {
  const counts = new Map<string, number>()
  for (const p of await db.dsaProblems.toArray()) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => t)
}

// ── Mocks ───────────────────────────────────────────────────

export type MockDraft = Omit<RowInput<'mocks'>, 'id' | 'at'> & { id?: string }

/** Saves a mock. On first save, each fix becomes a checklist item. */
export async function saveMock(draft: MockDraft): Promise<string> {
  const fixes = (draft.fixes ?? []).map((f) => f.trim()).filter(Boolean)
  const now = clock.now()
  const id = draft.id ?? newId()
  await db.transaction('rw', db.mocks, db.tasks, async () => {
    const existing = draft.id ? await db.mocks.get(draft.id) : undefined
    await putRow('mocks', { ...draft, fixes, id, at: existing?.at ?? now })
    if (!existing) {
      // createdAt + i keeps the fixes in the order they were written (most important first).
      for (const [i, text] of fixes.entries()) await putRow('tasks', { id: newId(), kind: 'mock-fix', text, sourceId: id, createdAt: now + i })
    }
  })
  return id
}

export async function deleteMock(id: string): Promise<void> {
  await db.transaction('rw', db.mocks, db.tasks, async () => {
    await db.tasks.where('sourceId').equals(id).delete()
    await db.mocks.delete(id)
  })
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const t = await db.tasks.get(id)
  if (t) await putRow('tasks', { ...t, doneAt: done ? clock.now() : undefined })
}

// ── Applications ────────────────────────────────────────────

export type ApplicationDraft = Omit<RowInput<'applications'>, 'id' | 'history' | 'createdAt' | 'updatedAt'> & { id?: string }

/** Saves an application; a stage change is added to its history (dated `day`). */
export async function saveApplication(draft: ApplicationDraft, day: DayKey): Promise<string> {
  const now = clock.now()
  const id = draft.id ?? newId()
  await db.transaction('rw', db.applications, async () => {
    const existing = draft.id ? await db.applications.get(draft.id) : undefined
    const history = existing?.history ?? []
    const moved = !existing || existing.stage !== draft.stage
    await putRow('applications', {
      ...draft,
      id,
      history: moved ? [...history, { stage: draft.stage, day }] : history,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
  return id
}

export async function moveApplication(id: string, stage: ApplicationStage, day: DayKey): Promise<void> {
  const a = await db.applications.get(id)
  if (!a || a.stage === stage) return
  await putRow('applications', { ...a, stage, history: [...a.history, { stage, day }], updatedAt: clock.now() })
}

export async function deleteApplication(id: string): Promise<void> {
  await db.applications.delete(id)
}
