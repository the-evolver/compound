import { clock } from '../../domain/time/clock'
import type { DayKey } from '../../domain/time/day'
import { acceptProposed, changeRule, dismissProposed } from '../../domain/habits/edit'
import type { ParsedTopic } from '../../domain/study'
import type { CheckpointResult } from '../../model/core'
import type { Habit, HabitRule } from '../../model/habits'
import type { TopicStatus } from '../../model/career'
import { db } from '../db'
import { newId, putRow, putRows } from '../repo'
import type { RowInput } from '../tables'

// ── Areas ───────────────────────────────────────────────────

export async function saveArea(input: { id?: string; name: string; goal: string; color: string }): Promise<void> {
  const existing = input.id ? await db.areas.get(input.id) : undefined
  if (existing) {
    await putRow('areas', { ...existing, name: input.name, goal: input.goal, color: input.color })
    return
  }
  const last = await db.areas.orderBy('order').last()
  await putRow('areas', { id: newId(), name: input.name, goal: input.goal, color: input.color, order: (last?.order ?? -1) + 1 })
}

/** Whether an area can be deleted outright (nothing refers to it); otherwise it is archived. */
export async function areaInUse(areaId: string): Promise<boolean> {
  const [habits, checkpoints] = await Promise.all([db.habits.where('areaId').equals(areaId).count(), db.checkpoints.where('areaId').equals(areaId).count()])
  return habits + checkpoints > 0
}

export async function deleteArea(areaId: string): Promise<void> {
  await db.areas.delete(areaId)
}

/** Hides an area (and its habits) from Today and Insights, keeping its history. */
export async function setAreaArchived(areaId: string, archived: boolean): Promise<void> {
  const a = await db.areas.get(areaId)
  if (a) await putRow('areas', { ...a, archivedAt: archived ? clock.now() : undefined })
}

// ── Phases & checkpoints ────────────────────────────────────

export async function savePhase(input: Omit<RowInput<'phases'>, 'id' | 'order'> & { id?: string; order?: number }): Promise<void> {
  const existing = input.id ? await db.phases.get(input.id) : undefined
  const count = await db.phases.count()
  await putRow('phases', { ...input, id: input.id ?? newId(), order: input.order ?? existing?.order ?? count })
}

export async function deletePhase(id: string): Promise<void> {
  await db.phases.delete(id)
}

/** Creates or updates a checkpoint; the decision time is set when the result changes. */
export async function saveCheckpoint(input: {
  id?: string
  areaId: string
  day: DayKey
  title: string
  result: CheckpointResult
  notes: string
}): Promise<void> {
  const existing = input.id ? await db.checkpoints.get(input.id) : undefined
  const decidedAt =
    input.result === 'pending' ? undefined : existing?.result === input.result ? existing.decidedAt : clock.now()
  await putRow('checkpoints', { ...input, id: input.id ?? newId(), decidedAt })
}

export async function setCheckpointResult(id: string, result: CheckpointResult, notes?: string): Promise<void> {
  const cp = await db.checkpoints.get(id)
  if (!cp) return
  await putRow('checkpoints', {
    ...cp,
    result,
    notes: notes ?? cp.notes,
    decidedAt: result === 'pending' ? undefined : clock.now(),
  })
}

export async function deleteCheckpoint(id: string): Promise<void> {
  await db.checkpoints.delete(id)
}

// ── Subjects & topics ───────────────────────────────────────

/** Makes a subject the one active subject; the previous active one goes back to the queue (or is done). */
export async function activateSubject(id: string, previousBecomes: 'queued' | 'done' = 'queued'): Promise<void> {
  const now = clock.now()
  await db.transaction('rw', db.subjects, async () => {
    for (const s of await db.subjects.where('status').equals('active').toArray()) {
      if (s.id === id) continue
      await putRow('subjects', { ...s, status: previousBecomes, completedAt: previousBecomes === 'done' ? now : s.completedAt })
    }
    const target = await db.subjects.get(id)
    if (target) await putRow('subjects', { ...target, status: 'active', activatedAt: now, completedAt: undefined })
  })
}

/** Marks the active subject done and activates the next queued one, if any. */
export async function completeSubject(id: string): Promise<void> {
  const now = clock.now()
  await db.transaction('rw', db.subjects, async () => {
    const s = await db.subjects.get(id)
    if (!s) return
    await putRow('subjects', { ...s, status: 'done', completedAt: now })
    const next = (await db.subjects.orderBy('order').toArray()).find((x) => x.status === 'queued')
    if (next && s.status === 'active') await putRow('subjects', { ...next, status: 'active', activatedAt: now })
  })
}

export async function saveSubject(input: { id?: string; name: string; note?: string }): Promise<void> {
  if (input.id) {
    const s = await db.subjects.get(input.id)
    if (s) await putRow('subjects', { ...s, name: input.name, note: input.note ?? s.note })
    return
  }
  const last = await db.subjects.orderBy('order').last()
  await putRow('subjects', { id: newId(), name: input.name, note: input.note ?? '', order: (last?.order ?? -1) + 1, status: 'queued' })
}

/** Swaps a subject (or topic) with its neighbour in the list. */
async function swapOrder(table: 'subjects' | 'topics', ids: string[], id: string, dir: -1 | 1): Promise<void> {
  const i = ids.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= ids.length) return
  await db.transaction('rw', db.table(table), async () => {
    const a = await db.table(table).get(ids[i]!)
    const b = await db.table(table).get(ids[j]!)
    if (!a || !b) return
    await db.table(table).bulkPut([
      { ...a, order: b.order },
      { ...b, order: a.order },
    ])
  })
}

export async function moveSubject(id: string, dir: -1 | 1): Promise<void> {
  const ids = (await db.subjects.orderBy('order').toArray()).map((s) => s.id)
  await swapOrder('subjects', ids, id, dir)
}

export async function deleteSubject(id: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.topics, db.topicEvents, async () => {
    const topicIds = (await db.topics.where('subjectId').equals(id).toArray()).map((t) => t.id)
    await db.topicEvents.where('topicId').anyOf(topicIds).delete()
    await db.topics.bulkDelete(topicIds)
    await db.subjects.delete(id)
  })
}

export async function addTopics(subjectId: string, items: readonly ParsedTopic[]): Promise<number> {
  const existing = await db.topics.where('subjectId').equals(subjectId).toArray()
  let order = existing.reduce((m, t) => Math.max(m, t.order), -1) + 1
  const now = clock.now()
  await putRows(
    'topics',
    items.map((t) => ({ id: newId(), subjectId, title: t.title, group: t.group, order: order++, updatedAt: now })),
  )
  return items.length
}

/** Changes a topic's status and records the move, so "topics moved this week" can be counted. */
export async function setTopicStatus(topicId: string, to: TopicStatus, day: DayKey): Promise<void> {
  const now = clock.now()
  await db.transaction('rw', db.topics, db.topicEvents, async () => {
    const t = await db.topics.get(topicId)
    if (!t || t.status === to) return
    await putRow('topics', { ...t, status: to, updatedAt: now })
    await putRow('topicEvents', { id: newId(), topicId, subjectId: t.subjectId, day, from: t.status, to, at: now })
  })
}

export async function updateTopic(topicId: string, patch: { title?: string; group?: string; notes?: string }): Promise<void> {
  const t = await db.topics.get(topicId)
  if (t) await putRow('topics', { ...t, ...patch, updatedAt: clock.now() })
}

export async function moveTopic(topicId: string, dir: -1 | 1): Promise<void> {
  const t = await db.topics.get(topicId)
  if (!t) return
  const ids = (await db.topics.where('subjectId').equals(t.subjectId).sortBy('order')).map((x) => x.id)
  await swapOrder('topics', ids, topicId, dir)
}

export async function deleteTopic(topicId: string): Promise<void> {
  await db.transaction('rw', db.topics, db.topicEvents, async () => {
    await db.topicEvents.where('topicId').equals(topicId).delete()
    await db.topics.delete(topicId)
  })
}

// ── Study sessions (Today's study card) ─────────────────────

const studyId = (day: DayKey) => `study|${day}`

/** One study entry per day: Done (with the topic) or Not today. Moves a new topic to Learning. */
export async function logStudy(day: DayKey, subjectId: string, outcome: 'done' | 'not_today', topicId?: string): Promise<void> {
  await putRow('studySessions', { id: studyId(day), day, subjectId, topicId, outcome, at: clock.now() })
  if (outcome === 'done' && topicId) {
    const t = await db.topics.get(topicId)
    if (t?.status === 'not_started') await setTopicStatus(topicId, 'learning', day)
  }
}

export async function clearStudy(day: DayKey): Promise<void> {
  await db.studySessions.delete(studyId(day))
}

// ── Habits ──────────────────────────────────────────────────

export type HabitDraft = Omit<RowInput<'habits'>, 'id' | 'rules' | 'createdAt'> & { id?: string }

/**
 * Saves a habit. For an existing habit, a schedule/target change is added
 * as a new rule from `changeFrom`, so earlier days keep their old rule.
 */
export async function saveHabit(draft: HabitDraft, rule: Omit<HabitRule, 'from' | 'proposed'>, changeFrom: DayKey): Promise<string> {
  const id = draft.id ?? newId()
  await db.transaction('rw', db.habits, async () => {
    const existing = draft.id ? await db.habits.get(draft.id) : undefined
    if (existing) {
      const merged: Habit = { ...existing, ...draft, id } as Habit
      await putRow('habits', { ...merged, rules: changeRule(merged, rule, changeFrom) })
    } else {
      // A new habit goes to the end of its area.
      const inArea = await db.habits.where('areaId').equals(draft.areaId).sortBy('order')
      await putRow('habits', {
        ...draft,
        id,
        order: (inArea.at(-1)?.order ?? -1) + 1,
        rules: [{ ...rule, from: draft.activeFrom ?? changeFrom, proposed: false }],
        createdAt: clock.now(),
      })
    }
  })
  return id
}

export async function acceptHabitChange(habitId: string, index: number, from?: DayKey): Promise<void> {
  const h = await db.habits.get(habitId)
  if (h) await putRow('habits', { ...h, rules: acceptProposed(h, index, from) })
}

export async function dismissHabitChange(habitId: string, index: number): Promise<void> {
  const h = await db.habits.get(habitId)
  if (h) await putRow('habits', { ...h, rules: dismissProposed(h, index) })
}

/** Stops a habit from a day on, keeping its history. */
export async function endHabit(habitId: string, from: DayKey): Promise<void> {
  const h = await db.habits.get(habitId)
  if (h) await putRow('habits', { ...h, endedOn: from })
}

export async function resumeHabit(habitId: string): Promise<void> {
  const h = await db.habits.get(habitId)
  if (h) await putRow('habits', { ...h, endedOn: undefined })
}

/** Deletes a habit and its check-ins. Only offered for habits with no history. */
export async function deleteHabit(habitId: string): Promise<void> {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habitLogs.where('habitId').equals(habitId).delete()
    await db.habits.delete(habitId)
  })
}

/** Sets (or clears) a queued habit's start date. Its first rule starts with it. */
export async function setHabitActivation(habitId: string, activeFrom: DayKey | undefined): Promise<void> {
  const h = await db.habits.get(habitId)
  if (!h) return
  const [first, ...rest] = h.rules
  const rules = first && !first.proposed && activeFrom ? [{ ...first, from: activeFrom }, ...rest] : h.rules
  await putRow('habits', { ...h, activeFrom, rules })
}
