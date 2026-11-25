import { clock } from '../../domain/time/clock'
import type { DayKey } from '../../domain/time/day'
import type { WorkoutSet } from '../../model/body'
import { db } from '../db'
import { newId, putRow } from '../repo'
import type { RowInput } from '../tables'

// ── Workouts ────────────────────────────────────────────────

export interface SessionDraft {
  id?: string
  day: DayKey
  templateId?: string
  location: 'gym' | 'home'
  entries: Array<{ exerciseId: string; sets: WorkoutSet[] }>
  minutes?: number
  note?: string
}

export async function saveSession(draft: SessionDraft): Promise<string> {
  const id = draft.id ?? newId()
  const existing = draft.id ? await db.workoutSessions.get(draft.id) : undefined
  await putRow('workoutSessions', {
    ...draft,
    id,
    entries: draft.entries.filter((e) => e.sets.length > 0),
    note: draft.note ?? '',
    at: existing?.at ?? clock.now(),
  })
  return id
}

export async function deleteSession(id: string): Promise<void> {
  await db.workoutSessions.delete(id)
}

export async function saveExercise(input: Omit<RowInput<'exercises'>, 'id'> & { id?: string }): Promise<string> {
  const id = input.id ?? newId()
  await putRow('exercises', { ...input, id })
  return id
}

export async function saveTemplate(input: Omit<RowInput<'workoutTemplates'>, 'id' | 'order'> & { id?: string; order?: number }): Promise<string> {
  const id = input.id ?? newId()
  const last = await db.workoutTemplates.orderBy('order').last()
  const existing = input.id ? await db.workoutTemplates.get(input.id) : undefined
  await putRow('workoutTemplates', { ...input, id, order: input.order ?? existing?.order ?? (last?.order ?? -1) + 1 })
  return id
}

// ── Measurements (waist, benchmarks, photo checkpoints) ─────

/**
 * One measurement of a kind per period (week, month or checkpoint day);
 * saving again in the same period replaces it.
 */
export async function saveMeasurement(kind: string, period: string, day: DayKey, value: number, note = ''): Promise<void> {
  await putRow('measurements', { id: `${kind}|${period}`, kind, day, value, note, at: clock.now() })
}

export async function deleteMeasurement(kind: string, period: string): Promise<void> {
  await db.measurements.delete(`${kind}|${period}`)
}

// ── Skin ────────────────────────────────────────────────────

export async function saveProduct(input: Omit<RowInput<'skinProducts'>, 'id' | 'createdAt'> & { id?: string }): Promise<void> {
  const existing = input.id ? await db.skinProducts.get(input.id) : undefined
  await putRow('skinProducts', { ...input, id: input.id ?? newId(), createdAt: existing?.createdAt ?? clock.now() })
}

export async function deleteProduct(id: string): Promise<void> {
  await db.skinProducts.delete(id)
}

export async function saveDermVisit(input: Omit<RowInput<'dermVisits'>, 'id' | 'at'> & { id?: string }): Promise<void> {
  const existing = input.id ? await db.dermVisits.get(input.id) : undefined
  await putRow('dermVisits', { ...input, id: input.id ?? newId(), at: existing?.at ?? clock.now() })
}

export async function deleteDermVisit(id: string): Promise<void> {
  await db.dermVisits.delete(id)
}

// ── Voice ───────────────────────────────────────────────────

export async function saveDrill(input: Omit<RowInput<'drills'>, 'id' | 'at'> & { id?: string }): Promise<void> {
  const existing = input.id ? await db.drills.get(input.id) : undefined
  await putRow('drills', { ...input, id: input.id ?? newId(), at: existing?.at ?? clock.now() })
}

export async function deleteDrill(id: string): Promise<void> {
  await db.drills.delete(id)
}

/** The week's people log: one entry per week, edited in place. */
export async function savePeopleLog(
  weekStart: DayKey,
  patch: Partial<Pick<RowInput<'peopleLogs'>, 'conversationsStarted' | 'followUps' | 'quests' | 'notes'>>,
): Promise<void> {
  const id = `people|${weekStart}`
  await db.transaction('rw', db.peopleLogs, async () => {
    const current = await db.peopleLogs.get(id)
    await putRow('peopleLogs', {
      conversationsStarted: 0,
      followUps: 0,
      quests: [],
      notes: '',
      ...current,
      ...patch,
      id,
      weekStart,
      at: clock.now(),
    })
  })
}

// ── Tasks (one-off to-dos like "book a dermatologist") ──────

export async function addTodo(text: string, areaId?: string, dueDay?: DayKey): Promise<void> {
  await putRow('tasks', { id: newId(), kind: 'todo', text, areaId, dueDay, createdAt: clock.now() })
}
