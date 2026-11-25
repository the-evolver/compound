import type { z } from 'zod'
import { zArea, zCheckpoint, zKv, zPhase, zTask } from '../model/core'
import { zDayEntry, zHabit, zHabitLog } from '../model/habits'
import {
  zApplication,
  zDsaProblem,
  zDsaReview,
  zMock,
  zStudySession,
  zSubject,
  zTopic,
  zTopicEvent,
} from '../model/career'
import { zExercise, zMeasurement, zWorkoutSession, zWorkoutTemplate } from '../model/body'
import { zDermVisit, zDrill, zPeopleLog, zSkinProduct } from '../model/skinVoice'
import { zMonthlyReview, zWeeklyReview } from '../model/review'

/**
 * Every table and the schema its rows must satisfy. Writes go through these
 * schemas, and so does backup import. The indexes for each table live in
 * versions.ts; a test checks the two lists match.
 */
export const TABLE_SCHEMAS = {
  kv: zKv,
  areas: zArea,
  phases: zPhase,
  checkpoints: zCheckpoint,
  tasks: zTask,
  habits: zHabit,
  habitLogs: zHabitLog,
  dayEntries: zDayEntry,
  subjects: zSubject,
  topics: zTopic,
  topicEvents: zTopicEvent,
  studySessions: zStudySession,
  dsaProblems: zDsaProblem,
  dsaReviews: zDsaReview,
  mocks: zMock,
  applications: zApplication,
  exercises: zExercise,
  workoutTemplates: zWorkoutTemplate,
  workoutSessions: zWorkoutSession,
  measurements: zMeasurement,
  skinProducts: zSkinProduct,
  dermVisits: zDermVisit,
  drills: zDrill,
  peopleLogs: zPeopleLog,
  weeklyReviews: zWeeklyReview,
  monthlyReviews: zMonthlyReview,
} as const

export type TableName = keyof typeof TABLE_SCHEMAS
export type Row<T extends TableName> = z.output<(typeof TABLE_SCHEMAS)[T]>
export type RowInput<T extends TableName> = z.input<(typeof TABLE_SCHEMAS)[T]>

export const TABLE_NAMES = Object.keys(TABLE_SCHEMAS) as TableName[]
