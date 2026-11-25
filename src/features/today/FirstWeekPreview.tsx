import { formatDay, type DayKey } from '../../domain/time/day'
import { habitsStartingOn } from '../../domain/today'
import { Card, Section } from '../../ui/primitives'
import type { TodayData } from './useTodayData'

/** Before the plan starts: what begins on day 1, so there's nothing to log yet. */
export function FirstWeekPreview({ data, startDay }: { data: TodayData; startDay: DayKey }) {
  const areaById = new Map(data.areas.map((a) => [a.id, a]))
  const habits = habitsStartingOn(data.habits, startDay).sort(
    (a, b) => (areaById.get(a.areaId)?.order ?? 0) - (areaById.get(b.areaId)?.order ?? 0) || a.order - b.order,
  )
  return (
    <Section title={`Starting ${formatDay(startDay, { weekday: 'short', day: 'numeric', month: 'short' })}`}>
      <Card className="space-y-3">
        <p className="text-sm text-muted">Nothing to log yet. These {habits.length} habits begin on day 1; the rest are added gradually.</p>
        <ul className="space-y-3">
          {habits.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: areaById.get(h.areaId)?.color }} aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-medium">{h.name}</div>
                <div className="text-sm text-muted">{h.ifThen}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  )
}
