import { z } from 'zod'
import { describeDays } from '../domain/habits/describe'
import { addDays, type DayKey, type Weekday } from '../domain/time/day'
import type { RowInput } from '../db/tables'
import { zClockTime, zDay, zHexColor, zId, zWeekday } from '../model/common'
import { zAreaNote, zProfile } from '../model/core'
import { zCompletion, zTimeBlock } from '../model/habits'

/*
 * Plan files (.compound.json): a whole plan as data — areas, phases,
 * checkpoints, habits, study subjects, workout templates, to-dos — loaded
 * during onboarding. Nothing personal ships in the app's code; a plan file
 * stays with its owner. Dates can be fixed ("2027-03-01") or relative to
 * the start date ({ "afterStart": 14 }), and a few values come from the
 * onboarding answers: "workoutDays", "workoutDaysPlusOne", "workoutTime",
 * and "{workoutDays}" inside text.
 */

const zDateSpec = z.union([zDay, z.object({ afterStart: z.number().int() })])
type DateSpec = z.output<typeof zDateSpec>

const zDaysSpec = z.union([z.array(zWeekday).min(1), z.literal('workoutDays'), z.literal('workoutDaysPlusOne')])

const zTemplateSchedule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }),
  z.object({ kind: z.literal('weekdays') }),
  z.object({ kind: z.literal('days'), days: zDaysSpec }),
  z.object({ kind: z.literal('perWeek'), times: z.number().int().min(1).max(7) }),
])

const zTemplateHabit = z.object({
  id: zId,
  areaId: zId,
  name: z.string().min(1),
  ifThen: z.string().min(1),
  obstacle: z.string().default(''),
  minVersion: z.string().min(1),
  doneHint: z.string().default(''),
  timeBlock: zTimeBlock,
  role: z.enum(['sunscreen']).optional(),
  reminderTime: z.union([zClockTime, z.literal('workoutTime')]).optional(),
  reminderDays: z.array(zWeekday).optional(),
  order: z.number(),
  /** When it starts; null keeps it in the queue without a date. */
  starts: zDateSpec.nullable(),
  rules: z
    .array(
      z.object({
        from: zDateSpec.optional(),
        schedule: zTemplateSchedule,
        completion: zCompletion,
        targetText: z.string().default(''),
        proposed: z.boolean().default(false),
        note: z.string().default(''),
      }),
    )
    .min(1),
})

export const zPlanTemplate = z.object({
  kind: z.literal('compound-plan'),
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().default(''),
  profile: zProfile.partial().optional(),
  /** The start date the plan was written for (offered as the default). */
  suggestedStart: zDay.optional(),
  planEnd: zDay.optional(),
  areas: z.array(
    z.object({
      id: zId,
      name: z.string().min(1),
      goal: z.string().default(''),
      color: zHexColor,
      order: z.number(),
      notes: z.array(zAreaNote).default(() => []),
      leadMeasures: z.array(z.string()).default(() => []),
      lagMeasures: z.array(z.string()).default(() => []),
      charts: z.enum(['career', 'body', 'skin', 'voice']).optional(),
    }),
  ),
  phases: z.array(z.object({ id: zId, name: z.string(), start: zDateSpec, end: zDateSpec, goal: z.string().default(''), order: z.number() })).default(() => []),
  checkpoints: z.array(z.object({ id: zId, areaId: zId, day: zDateSpec, title: z.string().min(1) })).default(() => []),
  habits: z.array(zTemplateHabit).default(() => []),
  subjects: z
    .array(
      z.object({
        id: zId,
        name: z.string().min(1),
        status: z.enum(['queued', 'active', 'done']).default('queued'),
        note: z.string().default(''),
        topics: z.array(z.object({ group: z.string().default(''), titles: z.array(z.string().min(1)) })).default(() => []),
      }),
    )
    .default(() => []),
  exercises: z
    .array(
      z.object({
        id: zId,
        name: z.string().min(1),
        repMin: z.number().int().positive(),
        repMax: z.number().int().positive(),
        increment: z.number().nonnegative().optional(),
        bodyweight: z.boolean().optional(),
        measure: z.enum(['reps', 'seconds']).optional(),
      }),
    )
    .default(() => []),
  workoutTemplates: z
    .array(z.object({ id: zId, name: z.string().min(1), order: z.number(), items: z.array(z.object({ exerciseId: zId, sets: z.number().int().positive() })).min(1) }))
    .default(() => []),
  tasks: z.array(z.object({ id: zId, areaId: zId.optional(), text: z.string().min(1), dueDay: zDateSpec.optional() })).default(() => []),
})
export type PlanTemplate = z.output<typeof zPlanTemplate>

export interface OnboardingInput {
  startDay: DayKey
  endDay: DayKey
  weightKg?: number
  weekdayHours: number
  weekendHours: number
  workoutDays: Weekday[]
  workoutTime: string
  /** Logical day the onboarding happened (the weight is logged to it). */
  today: DayKey
  now: number
}

export const DEFAULT_WORKOUT_DAYS: Weekday[] = [1, 3, 5]

/** Whether a plan file uses the workout-day / weight answers (so onboarding asks for them). */
export function templateNeeds(t: PlanTemplate): { workout: boolean; weight: boolean } {
  const json = JSON.stringify(t.habits)
  return { workout: json.includes('workoutDays') || json.includes('workoutTime'), weight: json.includes('perKgBodyweight') }
}

/** Adds one more training day (for a planned extra session), preferring Saturday. */
function withOneMoreDay(days: readonly Weekday[]): Weekday[] {
  const extra = ([6, 2, 4, 0, 1, 3, 5] as Weekday[]).find((d) => !days.includes(d))
  return extra === undefined ? [...days] : [...days, extra].sort((a, b) => a - b)
}

/**
 * Builds the rows for a plan. By default every id becomes a random one, so
 * nothing stored in plain text (ids are, because IndexedDB indexes them)
 * hints at what the plan contains. Tests keep the readable ids.
 */
export function buildFromTemplate(t: PlanTemplate, input: OnboardingInput, options: { opaqueIds?: boolean } = {}) {
  const opaque = options.opaqueIds ?? true
  const idMap = new Map<string, string>()
  const id = (original: string): string => {
    if (!opaque) return original
    let mapped = idMap.get(original)
    if (!mapped) {
      mapped = crypto.randomUUID()
      idMap.set(original, mapped)
    }
    return mapped
  }
  const S = input.startDay
  const at = input.now
  const workoutDays = input.workoutDays.length ? input.workoutDays : DEFAULT_WORKOUT_DAYS
  const day = (spec: DateSpec): DayKey => (typeof spec === 'string' ? spec : addDays(S, spec.afterStart))
  const text = (s: string) => s.replaceAll('{workoutDays}', describeDays(workoutDays))

  const habits: RowInput<'habits'>[] = t.habits.map(({ starts, rules, reminderTime, ...h }) => {
    const activeFrom = starts === null ? undefined : day(starts)
    return {
      ...h,
      id: id(h.id),
      areaId: id(h.areaId),
      ifThen: text(h.ifThen),
      obstacle: text(h.obstacle),
      minVersion: text(h.minVersion),
      reminderTime: reminderTime === 'workoutTime' ? input.workoutTime : reminderTime,
      activeFrom,
      createdAt: at,
      rules: rules.map((r) => ({
        ...r,
        targetText: text(r.targetText),
        from: r.from ? day(r.from) : (activeFrom ?? S),
        schedule:
          r.schedule.kind === 'days'
            ? {
                kind: 'days' as const,
                days: r.schedule.days === 'workoutDays' ? workoutDays : r.schedule.days === 'workoutDaysPlusOne' ? withOneMoreDay(workoutDays) : r.schedule.days,
              }
            : r.schedule,
      })),
    }
  })

  const topics: RowInput<'topics'>[] = []
  for (const s of t.subjects) {
    let order = 0
    for (const g of s.topics) {
      for (const title of g.titles) {
        topics.push({
          id: opaque ? crypto.randomUUID() : `topic:${s.id.replace(/^subject:/, '')}:${order}`,
          subjectId: id(s.id),
          title,
          group: g.group,
          order,
          updatedAt: at,
        })
        order++
      }
    }
  }

  return {
    areas: t.areas.map((a) => ({ ...a, id: id(a.id) })) as RowInput<'areas'>[],
    phases: t.phases.map((p) => ({ ...p, id: id(p.id), start: day(p.start), end: day(p.end) })) as RowInput<'phases'>[],
    checkpoints: t.checkpoints.map((c) => ({ ...c, id: id(c.id), areaId: id(c.areaId), day: day(c.day) })) as RowInput<'checkpoints'>[],
    habits,
    subjects: t.subjects.map((s, i) => ({ id: id(s.id), name: s.name, note: s.note, status: s.status, order: i, activatedAt: s.status === 'active' ? at : undefined })) as RowInput<'subjects'>[],
    topics,
    exercises: t.exercises.map((e) => ({ ...e, id: id(e.id) })) as RowInput<'exercises'>[],
    workoutTemplates: t.workoutTemplates.map((w) => ({ ...w, id: id(w.id), items: w.items.map((i) => ({ ...i, exerciseId: id(i.exerciseId) })) })) as RowInput<'workoutTemplates'>[],
    tasks: t.tasks.map((task) => ({ id: id(task.id), kind: 'todo' as const, areaId: task.areaId ? id(task.areaId) : undefined, text: task.text, dueDay: task.dueDay ? day(task.dueDay) : undefined, createdAt: at })),
    dayEntries: input.weightKg !== undefined ? ([{ day: input.today, metrics: { weightKg: input.weightKg }, note: '', updatedAt: at }] as RowInput<'dayEntries'>[]) : [],
  }
}

export type SeedData = ReturnType<typeof buildFromTemplate>

export type PlanFileResult = { ok: true; plan: PlanTemplate } | { ok: false; error: string }

/** Reads a plan file, checking every part before anything is used. */
export function parsePlanFile(text: string): PlanFileResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: "This file isn't valid JSON." }
  }
  const r = zPlanTemplate.safeParse(json)
  if (!r.success) {
    const issue = r.error.issues[0]
    return { ok: false, error: `This isn't a Compound plan file${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.` }
  }
  return { ok: true, plan: r.data }
}
