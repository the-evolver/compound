import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '../../db/db'
import { isActiveOn, isScheduledOn, ruleOn } from '../../domain/habits/rules'
import type { DayKey } from '../../domain/time/day'
import { nextTemplate } from '../../domain/workouts'
import { Icon } from '../../ui/icons'
import { Card } from '../../ui/primitives'
import { TaskCheck } from '../logs/MocksTab'

/** Today card on workout days: start the next template (A/B alternate) or the home session. */
export function WorkoutCard({ day }: { day: DayKey }) {
  const data = useLiveQuery(async () => {
    const [habits, templates, sessions] = await Promise.all([db.habits.toArray(), db.workoutTemplates.toArray(), db.workoutSessions.toArray()])
    // The habit counted from the workout log, if any.
    const habit = habits.find((h) => {
      const c = isActiveOn(h, day) ? ruleOn(h, day).completion : undefined
      return c?.kind === 'log' && c.source === 'workout'
    })
    if (!habit) return null
    const schedule = ruleOn(habit, day).schedule
    const due = schedule.kind === 'perWeek' || isScheduledOn(schedule, day)
    if (!due || sessions.some((s) => s.day === day)) return null
    const active = templates.filter((t) => !t.archived)
    return { next: nextTemplate(active, sessions), home: active.find((t) => /home/i.test(t.name)) }
  }, [day])
  if (!data) return null
  return (
    <Card className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Workout day</h2>
      <div className="grid gap-2">
        {data.next && (
          <Link to={`/workout/new?template=${encodeURIComponent(data.next.id)}`} className="flex min-h-12 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-ink">
            <span className="flex-1">Start {data.next.name}</span>
            <Icon name="chevronRight" />
          </Link>
        )}
        {data.home && (
          <Link to={`/workout/new?template=${encodeURIComponent(data.home.id)}`} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 text-muted">
            <span className="flex-1">Can't reach the gym: {data.home.name}</span>
            <Icon name="chevronRight" />
          </Link>
        )}
      </div>
    </Card>
  )
}

/** Today card: one-off to-dos that are due (e.g. the week-12 skin check). */
export function TodosCard({ day }: { day: DayKey }) {
  const due = useLiveQuery(
    async () => (await db.tasks.where('kind').equals('todo').toArray()).filter((t) => !t.doneAt && t.dueDay !== undefined && t.dueDay <= day),
    [day],
  )
  if (!due?.length) return null
  return (
    <Card>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">To-dos</h2>
      <div className="divide-y divide-line">
        {due.map((t) => (
          <TaskCheck key={t.id} task={t} />
        ))}
      </div>
    </Card>
  )
}
