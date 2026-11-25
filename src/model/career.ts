import { z } from 'zod'
import { zDay, zId, zScore4, zTimestamp } from './common'

export const zSubjectStatus = z.enum(['queued', 'active', 'done'])
export type SubjectStatus = z.output<typeof zSubjectStatus>

/** A study subject in the career queue (LLD, HLD, …). One is active at a time. */
export const zSubject = z.object({
  id: zId,
  name: z.string().min(1),
  order: z.number(),
  status: zSubjectStatus,
  note: z.string().default(''),
  activatedAt: zTimestamp.optional(),
  completedAt: zTimestamp.optional(),
})
export type Subject = z.output<typeof zSubject>

export const TOPIC_STATUSES = ['not_started', 'learning', 'can_explain', 'under_pressure'] as const
export const zTopicStatus = z.enum(TOPIC_STATUSES)
export type TopicStatus = z.output<typeof zTopicStatus>

export const zTopic = z.object({
  id: zId,
  subjectId: zId,
  title: z.string().min(1),
  /** Optional grouping inside a subject, e.g. "Patterns", "Machine coding". */
  group: z.string().default(''),
  order: z.number(),
  status: zTopicStatus.default('not_started'),
  notes: z.string().default(''),
  updatedAt: zTimestamp,
})
export type Topic = z.output<typeof zTopic>

/** Status changes, kept so "topics moved this week" is countable. */
export const zTopicEvent = z.object({
  id: zId,
  topicId: zId,
  subjectId: zId,
  day: zDay,
  from: zTopicStatus,
  to: zTopicStatus,
  at: zTimestamp,
})
export type TopicEvent = z.output<typeof zTopicEvent>

export const zStudySession = z.object({
  id: zId,
  day: zDay,
  subjectId: zId,
  topicId: zId.optional(),
  outcome: z.enum(['done', 'not_today']),
  minutes: z.number().int().positive().optional(),
  at: zTimestamp,
})
export type StudySession = z.output<typeof zStudySession>

export const zDifficulty = z.enum(['easy', 'medium', 'hard'])
export const zDsaOutcome = z.enum(['alone', 'hint', 'solution'])
export const zDsaMistake = z.enum(['pattern', 'edge_case', 'complexity', 'impl_bug', 'misread'])
export const zReviewRating = z.enum(['easy', 'ok', 'failed'])
export type ReviewRating = z.output<typeof zReviewRating>

export const zSrsState = z.object({
  /** Index into the review intervals for the next review. */
  step: z.number().int().nonnegative(),
  dueDay: zDay,
  /** Passed the last interval: no more reviews. */
  graduated: z.boolean().default(false),
})
export type SrsState = z.output<typeof zSrsState>

export const zDsaProblem = z.object({
  id: zId,
  day: zDay,
  title: z.string().min(1),
  link: z.string().default(''),
  difficulty: zDifficulty,
  tags: z.array(z.string()).default(() => []),
  minutes: z.number().int().positive().optional(),
  outcome: zDsaOutcome,
  mistake: zDsaMistake.optional(),
  insight: z.string().default(''),
  srs: zSrsState,
  createdAt: zTimestamp,
})
export type DsaProblem = z.output<typeof zDsaProblem>

export const zDsaReview = z.object({
  id: zId,
  problemId: zId,
  day: zDay,
  rating: zReviewRating,
  minutes: z.number().int().positive().optional(),
  stepBefore: z.number().int().nonnegative(),
  at: zTimestamp,
})
export type DsaReview = z.output<typeof zDsaReview>

export const zMockType = z.enum(['dsa', 'lld', 'hld', 'behavioural'])

export const zMock = z.object({
  id: zId,
  day: zDay,
  type: zMockType,
  platform: z.string().default(''),
  scores: z.object({
    technical: zScore4,
    problemSolving: zScore4,
    communication: zScore4,
  }),
  verdict: z.enum(['hire', 'no_hire']),
  /** Top fixes; each also becomes a "mock-fix" task. */
  fixes: z.array(z.string()).max(3).default(() => []),
  notes: z.string().default(''),
  at: zTimestamp,
})
export type Mock = z.output<typeof zMock>

export const APPLICATION_STAGES = [
  'target',
  'referral_asked',
  'applied',
  'oa',
  'phone',
  'onsite',
  'offer',
  'rejected',
] as const
export const zApplicationStage = z.enum(APPLICATION_STAGES)
export type ApplicationStage = z.output<typeof zApplicationStage>

export const zApplication = z.object({
  id: zId,
  company: z.string().min(1),
  role: z.string().default(''),
  source: z.enum(['referral', 'direct', 'recruiter']),
  referrer: z.string().default(''),
  stage: zApplicationStage,
  /** Every stage change, for the funnel and "applications moved". */
  history: z.array(z.object({ stage: zApplicationStage, day: zDay })).default(() => []),
  nextAction: z.string().default(''),
  nextActionDay: zDay.optional(),
  notes: z.string().default(''),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
})
export type Application = z.output<typeof zApplication>
