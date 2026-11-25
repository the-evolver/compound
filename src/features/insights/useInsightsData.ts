import { useLiveQuery } from 'dexie-react-hooks'
import { useAppData } from '../../app/AppData'
import { db } from '../../db/db'
import { loadHabitData } from '../../db/queries/habitData'

/** Everything Insights draws from, in one live query. */
export function useInsightsData() {
  const { settings, today } = useAppData()
  return useLiveQuery(async () => {
    const [habitData, problems, reviews, topics, subjects, mocks, applications, sessions, exercises, measurements, drills] = await Promise.all([
      loadHabitData(today, settings.weekStartsOn),
      db.dsaProblems.toArray(),
      db.dsaReviews.toArray(),
      db.topics.toArray(),
      db.subjects.orderBy('order').toArray(),
      db.mocks.orderBy('day').toArray(),
      db.applications.toArray(),
      db.workoutSessions.toArray(),
      db.exercises.toArray(),
      db.measurements.orderBy('day').toArray(),
      db.drills.orderBy('day').toArray(),
    ])
    return { ...habitData, problems, reviews, topics, subjects, mocks, applications, sessions, exercises, measurements, drills }
  }, [today, settings.weekStartsOn])
}

export type InsightsData = NonNullable<ReturnType<typeof useInsightsData>>
