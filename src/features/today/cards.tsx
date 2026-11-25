import type { ComponentType } from 'react'
import type { DayKey } from '../../domain/time/day'
import { BackupNudgeCard } from '../backup/BackupNudgeCard'
import { RemindersChangedCard } from '../reminders/RemindersChangedCard'
import { StudyCard } from './StudyCard'
import { DsaCard, FollowUpsCard } from './CareerCards'
import { TodosCard, WorkoutCard } from './MoreCards'
import { CommitmentsCard } from './CommitmentsCard'

/**
 * Extra cards on Today (DSA reviews due, the study topic, this week's
 * commitments, overdue follow-ups, …). A feature adds its card here; each
 * card renders nothing when it has nothing to show, so Today never shows an
 * empty or dead card.
 */
export interface TodayCardDef {
  id: string
  order: number
  Component: ComponentType<{ day: DayKey }>
}

export const TODAY_CARDS: readonly TodayCardDef[] = [
  { id: 'workout', order: 5, Component: WorkoutCard },
  { id: 'dsa', order: 10, Component: DsaCard },
  { id: 'study', order: 20, Component: StudyCard },
  { id: 'commitments', order: 30, Component: CommitmentsCard },
  { id: 'follow-ups', order: 40, Component: FollowUpsCard },
  { id: 'todos', order: 50, Component: TodosCard },
  { id: 'backup-nudge', order: 90, Component: BackupNudgeCard },
  { id: 'reminders-changed', order: 91, Component: RemindersChangedCard },
]
