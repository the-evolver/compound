import { useLiveQuery } from 'dexie-react-hooks'
import { useAppData } from '../../app/AppData'
import { db } from '../../db/db'
import { startOfWeek, type DayKey } from '../../domain/time/day'
import { Card } from '../../ui/primitives'
import { TaskCheck } from '../logs/MocksTab'

/** Today card: this week's commitments from the last weekly review. */
export function CommitmentsCard({ day }: { day: DayKey }) {
  const { settings } = useAppData()
  const weekStart = startOfWeek(day, settings.weekStartsOn)
  const data = useLiveQuery(async () => {
    const [tasks, areas] = await Promise.all([db.tasks.where('weekStart').equals(weekStart).filter((t) => t.kind === 'commitment').toArray(), db.areas.toArray()])
    return { tasks: tasks.sort((a, b) => a.createdAt - b.createdAt), color: new Map(areas.map((a) => [a.id, a.color])) }
  }, [weekStart])
  if (!data?.tasks.length) return null
  return (
    <Card>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">This week's commitments</h2>
      <div className="divide-y divide-line">
        {data.tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: data.color.get(t.areaId ?? '') }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <TaskCheck task={t} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
