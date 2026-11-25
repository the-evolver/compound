import { useLiveQuery } from 'dexie-react-hooks'
import { useAppData } from '../../app/AppData'
import { loadHabitData } from '../../db/queries/habitData'
import { METRIC_LIST } from '../../domain/metrics'
import { buildToday } from '../../domain/today'

/** Everything Today needs, recomputed whenever any of it changes. */
export function useTodayData() {
  const { settings, today } = useAppData()
  return useLiveQuery(async () => {
    const { areas, habits, dayEntries, ctx } = await loadHabitData(today, settings.weekStartsOn)
    const model = buildToday({ habits, areas, ctx, maxSkipsPerWeek: settings.maxSkipsPerWeek, cap: settings.todayItemCap })

    // Last value of each number before today, to pre-fill the steppers.
    const last: Record<string, number | undefined> = {}
    for (const m of METRIC_LIST) {
      for (let i = dayEntries.length - 1; i >= 0; i--) {
        const e = dayEntries[i]!
        if (e.day < today && e.metrics[m.key] !== undefined) {
          last[m.key] = e.metrics[m.key]
          break
        }
      }
    }

    return {
      model,
      entry: dayEntries.find((e) => e.day === today),
      last,
      habits,
      areas,
      bodyweightKg: ctx.evidence.bodyweightKg(today),
    }
  }, [today, settings])
}

export type TodayData = NonNullable<ReturnType<typeof useTodayData>>
