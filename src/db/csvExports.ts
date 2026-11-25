import { toCsv, type CsvValue } from '../domain/csv'
import { METRIC_LIST } from '../domain/metrics'
import { db } from './db'

type CsvRow = Record<string, CsvValue>

export interface CsvExport {
  id: string
  label: string
  count: () => Promise<number>
  build: () => Promise<{ columns: string[]; rows: CsvRow[] }>
}

const nameMap = async <T extends { id: string; name?: string; title?: string }>(rows: Promise<T[]>) =>
  new Map((await rows).map((r) => [r.id, r.name ?? r.title ?? r.id]))

const list = (xs: readonly string[] | undefined) => (xs ?? []).join('; ')

/**
 * One CSV per log, for spreadsheets. To add one, add an entry here; the
 * Settings screen lists whatever has rows.
 */
export const CSV_EXPORTS: readonly CsvExport[] = [
  {
    id: 'habit-log',
    label: 'Habit log',
    count: () => db.habitLogs.count(),
    build: async () => {
      const [logs, habits, areas] = await Promise.all([db.habitLogs.orderBy('day').toArray(), db.habits.toArray(), nameMap(db.areas.toArray())])
      const habitById = new Map(habits.map((h) => [h.id, h]))
      return {
        columns: ['day', 'area', 'habit', 'status', 'skip_reason', 'note'],
        rows: logs.map((l) => {
          const h = habitById.get(l.habitId)
          return { day: l.day, area: h ? areas.get(h.areaId) : '', habit: h?.name ?? l.habitId, status: l.status, skip_reason: l.skipReason, note: l.note }
        }),
      }
    },
  },
  {
    id: 'daily-numbers',
    label: 'Daily numbers & notes',
    count: () => db.dayEntries.count(),
    build: async () => {
      const entries = await db.dayEntries.orderBy('day').toArray()
      return {
        columns: ['day', ...METRIC_LIST.map((m) => m.key), 'note'],
        rows: entries.map((e) => ({ day: e.day, ...e.metrics, note: e.note })),
      }
    },
  },
  {
    id: 'study',
    label: 'Study sessions',
    count: () => db.studySessions.count(),
    build: async () => {
      const [sessions, subjects, topics] = await Promise.all([
        db.studySessions.orderBy('day').toArray(),
        nameMap(db.subjects.toArray()),
        nameMap(db.topics.toArray()),
      ])
      return {
        columns: ['day', 'subject', 'topic', 'outcome', 'minutes'],
        rows: sessions.map((s) => ({
          day: s.day,
          subject: subjects.get(s.subjectId),
          topic: s.topicId ? topics.get(s.topicId) : '',
          outcome: s.outcome,
          minutes: s.minutes,
        })),
      }
    },
  },
  {
    id: 'dsa-problems',
    label: 'DSA problems',
    count: () => db.dsaProblems.count(),
    build: async () => ({
      columns: ['day', 'title', 'link', 'difficulty', 'tags', 'minutes', 'outcome', 'mistake', 'insight', 'next_review', 'graduated'],
      rows: (await db.dsaProblems.orderBy('day').toArray()).map((p) => ({
        day: p.day,
        title: p.title,
        link: p.link,
        difficulty: p.difficulty,
        tags: list(p.tags),
        minutes: p.minutes,
        outcome: p.outcome,
        mistake: p.mistake,
        insight: p.insight,
        next_review: p.srs.graduated ? '' : p.srs.dueDay,
        graduated: p.srs.graduated,
      })),
    }),
  },
  {
    id: 'dsa-reviews',
    label: 'DSA reviews',
    count: () => db.dsaReviews.count(),
    build: async () => {
      const [reviews, problems] = await Promise.all([db.dsaReviews.orderBy('day').toArray(), nameMap(db.dsaProblems.toArray())])
      return {
        columns: ['day', 'problem', 'rating', 'minutes'],
        rows: reviews.map((r) => ({ day: r.day, problem: problems.get(r.problemId), rating: r.rating, minutes: r.minutes })),
      }
    },
  },
  {
    id: 'mocks',
    label: 'Mock interviews',
    count: () => db.mocks.count(),
    build: async () => ({
      columns: ['day', 'type', 'platform', 'technical', 'problem_solving', 'communication', 'verdict', 'fixes', 'notes'],
      rows: (await db.mocks.orderBy('day').toArray()).map((m) => ({
        day: m.day,
        type: m.type,
        platform: m.platform,
        technical: m.scores.technical,
        problem_solving: m.scores.problemSolving,
        communication: m.scores.communication,
        verdict: m.verdict,
        fixes: list(m.fixes),
        notes: m.notes,
      })),
    }),
  },
  {
    id: 'applications',
    label: 'Applications',
    count: () => db.applications.count(),
    build: async () => ({
      columns: ['company', 'role', 'source', 'referrer', 'stage', 'next_action', 'next_action_day', 'stage_history', 'notes'],
      rows: (await db.applications.toArray()).map((a) => ({
        company: a.company,
        role: a.role,
        source: a.source,
        referrer: a.referrer,
        stage: a.stage,
        next_action: a.nextAction,
        next_action_day: a.nextActionDay,
        stage_history: a.history.map((h) => `${h.day} ${h.stage}`).join('; '),
        notes: a.notes,
      })),
    }),
  },
  {
    id: 'workouts',
    label: 'Workouts (one row per set)',
    count: () => db.workoutSessions.count(),
    build: async () => {
      const [sessions, exercises, templates] = await Promise.all([
        db.workoutSessions.orderBy('day').toArray(),
        nameMap(db.exercises.toArray()),
        nameMap(db.workoutTemplates.toArray()),
      ])
      return {
        columns: ['day', 'template', 'location', 'exercise', 'set', 'reps', 'kg'],
        rows: sessions.flatMap((s) =>
          s.entries.flatMap((e) =>
            e.sets.map((set, i) => ({
              day: s.day,
              template: s.templateId ? templates.get(s.templateId) : '',
              location: s.location,
              exercise: exercises.get(e.exerciseId),
              set: i + 1,
              reps: set.reps,
              kg: set.kg,
            })),
          ),
        ),
      }
    },
  },
  {
    id: 'measurements',
    label: 'Body & skin measurements',
    count: () => db.measurements.count(),
    build: async () => ({
      columns: ['day', 'kind', 'value', 'note'],
      rows: (await db.measurements.orderBy('day').toArray()).map((m) => ({ day: m.day, kind: m.kind, value: m.value, note: m.note })),
    }),
  },
  {
    id: 'skin-products',
    label: 'Skin products',
    count: () => db.skinProducts.count(),
    build: async () => ({
      columns: ['name', 'role', 'start_day', 'stopped_day', 'patch_test', 'notes'],
      rows: (await db.skinProducts.toArray()).map((p) => ({
        name: p.name,
        role: p.role,
        start_day: p.startDay,
        stopped_day: p.stoppedDay,
        patch_test: p.patchTest,
        notes: p.notes,
      })),
    }),
  },
  {
    id: 'derm-visits',
    label: 'Dermatologist visits',
    count: () => db.dermVisits.count(),
    build: async () => ({
      columns: ['day', 'advice', 'plan', 'next_visit'],
      rows: (await db.dermVisits.orderBy('day').toArray()).map((v) => ({ day: v.day, advice: v.advice, plan: v.plan, next_visit: v.nextVisit })),
    }),
  },
  {
    id: 'drills',
    label: 'Speaking drills',
    count: () => db.drills.count(),
    build: async () => ({
      columns: ['day', 'prompt', 'seconds', 'recorded', 'fillers', 'fillers_per_2min', 'clarity', 'structure', 'pace', 'confidence', 'fix'],
      rows: (await db.drills.orderBy('day').toArray()).map((d) => ({
        day: d.day,
        prompt: d.prompt,
        seconds: d.seconds,
        recorded: d.recorded,
        fillers: d.fillers,
        fillers_per_2min: Math.round((d.fillers / d.seconds) * 120 * 10) / 10,
        clarity: d.ratings.clarity,
        structure: d.ratings.structure,
        pace: d.ratings.pace,
        confidence: d.ratings.confidence,
        fix: d.fix,
      })),
    }),
  },
  {
    id: 'people',
    label: 'People log',
    count: () => db.peopleLogs.count(),
    build: async () => ({
      columns: ['week_start', 'conversations_started', 'follow_up_questions', 'quests', 'notes'],
      rows: (await db.peopleLogs.orderBy('weekStart').toArray()).map((p) => ({
        week_start: p.weekStart,
        conversations_started: p.conversationsStarted,
        follow_up_questions: p.followUps,
        quests: list(p.quests),
        notes: p.notes,
      })),
    }),
  },
  {
    id: 'checkpoints',
    label: 'Checkpoints',
    count: () => db.checkpoints.count(),
    build: async () => {
      const [cps, areas] = await Promise.all([db.checkpoints.orderBy('day').toArray(), nameMap(db.areas.toArray())])
      return {
        columns: ['day', 'area', 'checkpoint', 'result', 'notes'],
        rows: cps.map((c) => ({ day: c.day, area: areas.get(c.areaId), checkpoint: c.title, result: c.result, notes: c.notes })),
      }
    },
  },
]

export async function buildCsv(exp: CsvExport): Promise<string> {
  const { columns, rows } = await exp.build()
  return toCsv(columns, rows)
}
