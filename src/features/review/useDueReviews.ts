import { useLiveQuery } from 'dexie-react-hooks'
import { useAppData } from '../../app/AppData'
import { loadReviewIndex } from '../../db/queries/review'
import { dueMonthlyReview, dueWeeklyReview } from '../../domain/review'

/** The weekly and monthly reviews that are due and not yet finished. */
export function useDueReviews() {
  const { settings, today } = useAppData()
  return useLiveQuery(async () => {
    const { completedWeeks, completedMonths } = await loadReviewIndex()
    return {
      week: dueWeeklyReview(today, settings.planStart, settings.weekStartsOn, completedWeeks),
      month: dueMonthlyReview(today, settings.planStart, completedMonths),
    }
  }, [today, settings.planStart, settings.weekStartsOn])
}
