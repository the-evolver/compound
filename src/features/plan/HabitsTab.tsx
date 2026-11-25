import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { AreaSheet } from './AreaSheet'
import { Link } from 'react-router'
import { useAppData } from '../../app/AppData'
import { acceptHabitChange, dismissHabitChange } from '../../db/actions/plan'
import { loadHabitData } from '../../db/queries/habitData'
import { describeSchedule } from '../../domain/habits/describe'
import { proposedRules } from '../../domain/habits/edit'
import { isActiveOn, ruleOn } from '../../domain/habits/rules'
import { strengthScore } from '../../domain/habits/strength'
import { formatDay, maxDay, type DayKey } from '../../domain/time/day'
import type { Area } from '../../model/core'
import type { Habit } from '../../model/habits'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, Section } from '../../ui/primitives'

const fmt = (d: DayKey) => formatDay(d, { weekday: 'short', day: 'numeric', month: 'short' })

function HabitRow({ habit, sub }: { habit: Habit; sub: string }) {
  return (
    <Link to={`/habits/${encodeURIComponent(habit.id)}`} className="flex min-h-12 items-center gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block">{habit.name}</span>
        <span className="text-sm text-faint">{sub}</span>
      </span>
      <Icon name="chevronRight" className="shrink-0 text-faint" />
    </Link>
  )
}

export function AreaNotes({ area }: { area: Area }) {
  if (!area.notes.length) return null
  return (
    <div className="space-y-2">
      {area.notes.map((n) => (
        <div key={n.id} className={n.kind === 'safety' ? 'rounded-xl border border-warn/40 bg-warn/10 p-3' : 'rounded-xl bg-surface-2 p-3'}>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {n.kind === 'safety' && <Icon name="shield" size={16} className="text-warn" />}
            {n.title}
          </div>
          <p className="mt-1 text-sm text-muted">{n.body}</p>
        </div>
      ))}
    </div>
  )
}

export function HabitsTab() {
  const { settings, today } = useAppData()
  const [areaSheet, setAreaSheet] = useState<Area | 'new' | null>(null)
  const data = useLiveQuery(() => loadHabitData(today, settings.weekStartsOn), [today, settings.weekStartsOn])
  if (!data) return null

  return (
    <div className="space-y-6">
      <Section
        title="Areas"
        action={
          <Button size="sm" variant="ghost" onClick={() => setAreaSheet('new')}>
            <Icon name="plus" size={16} /> Area
          </Button>
        }
      >
        {data.areas.length === 0 ? (
          <Card className="space-y-3">
            <p className="text-sm text-muted">
              Start with an area: a part of life you want to improve, like Career, Health or Learning. Then give it one habit, with an if-then plan
              and a minimum version.
            </p>
            <Button variant="primary" className="w-full" onClick={() => setAreaSheet('new')}>
              Add your first area
            </Button>
          </Card>
        ) : (
          <Card className="divide-y divide-line py-1">
            {data.areas.map((a) => (
              <button key={a.id} type="button" className="flex min-h-12 w-full items-center gap-3 py-2 text-left" onClick={() => setAreaSheet(a)}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block">{a.name}</span>
                  {a.goal && <span className="block truncate text-xs text-faint">{a.goal}</span>}
                </span>
                {a.archivedAt && <Badge>Archived</Badge>}
                <Icon name="chevronRight" className="text-faint" />
              </button>
            ))}
          </Card>
        )}
      </Section>

      {data.areas.length > 0 && (
        <p className="px-1 text-sm text-muted">
          New habits roll out gradually: at most one per area every two weeks. Each has an if-then plan, a backup plan and a minimum version.
        </p>
      )}
      {areaSheet && <AreaSheet area={areaSheet === 'new' ? undefined : areaSheet} takenColors={data.areas.map((a) => a.color)} onClose={() => setAreaSheet(null)} />}
      {data.areas.filter((a) => !a.archivedAt).map((area) => {
        const mine = data.habits.filter((h) => h.areaId === area.id)
        const active = mine.filter((h) => isActiveOn(h, today))
        const queued = mine.filter((h) => !h.endedOn && (!h.activeFrom || h.activeFrom > today)).sort((a, b) => (a.activeFrom ?? '9') < (b.activeFrom ?? '9') ? -1 : 1)
        const stopped = mine.filter((h) => h.endedOn && h.endedOn <= today)
        const planned = mine.flatMap((h) => proposedRules(h).map((p) => ({ habit: h, ...p })))
        return (
          <Section
            key={area.id}
            title={area.name}
            action={
              <Link to={`/habits/new?area=${encodeURIComponent(area.id)}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm text-muted active:bg-surface-2">
                <Icon name="plus" size={16} /> Habit
              </Link>
            }
          >
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: area.color }} aria-hidden="true" />
                <span className="text-sm text-muted">{area.goal}</span>
              </div>
              {active.length > 0 && (
                <div className="divide-y divide-line">
                  {active.map((h) => (
                    <HabitRow key={h.id} habit={h} sub={`${describeSchedule(ruleOn(h, today).schedule)} · strength ${strengthScore(h, data.ctx)}`} />
                  ))}
                </div>
              )}
              {queued.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-faint">Starting later</div>
                  <div className="divide-y divide-line">
                    {queued.map((h) => (
                      <HabitRow key={h.id} habit={h} sub={h.activeFrom ? `Starts ${fmt(h.activeFrom)}` : 'In the queue, no date yet'} />
                    ))}
                  </div>
                </div>
              )}
              {planned.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-faint">Planned changes</div>
                  {planned.map(({ habit, rule, index }) => (
                    <div key={`${habit.id}-${index}`} className="rounded-xl bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{habit.name}</span>
                        <Badge>from {fmt(rule.from)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{rule.targetText || describeSchedule(rule.schedule)}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button size="sm" onClick={() => void acceptHabitChange(habit.id, index, maxDay(rule.from, today))}>
                          Accept
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void dismissHabitChange(habit.id, index)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {stopped.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-faint">Stopped</div>
                  <div className="divide-y divide-line">
                    {stopped.map((h) => (
                      <HabitRow key={h.id} habit={h} sub={`Stopped ${fmt(h.endedOn!)}`} />
                    ))}
                  </div>
                </div>
              )}
              {mine.length === 0 && <p className="text-sm text-muted">No habits in this area yet.</p>}
              <AreaNotes area={area} />
            </Card>
          </Section>
        )
      })}
    </div>
  )
}
