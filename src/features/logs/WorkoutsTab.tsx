import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAppData } from '../../app/AppData'
import { db } from '../../db/db'
import { ruleOn } from '../../domain/habits/rules'
import { formatDay } from '../../domain/time/day'
import { nextTemplate, prsInSession, sessionsInWeek } from '../../domain/workouts'
import type { WorkoutTemplate } from '../../model/body'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { TemplateSheet } from '../workouts/TemplateSheet'

export function WorkoutsTab() {
  const { settings, today } = useAppData()
  const [editing, setEditing] = useState<WorkoutTemplate | 'new' | null>(null)
  const data = useLiveQuery(async () => {
    const [templates, exercises, sessions, habit] = await Promise.all([
      db.workoutTemplates.orderBy('order').toArray(),
      db.exercises.toArray().then((list) => list.sort((a, b) => a.name.localeCompare(b.name))),
      db.workoutSessions.orderBy('day').reverse().toArray(),
      db.habits.toArray().then((list) => list.find((h) => h.rules.some((r) => r.completion.kind === 'log' && r.completion.source === 'workout'))),
    ])
    return { templates, exercises, sessions, habit }
  }, [])
  if (!data) return null

  const exById = new Map(data.exercises.map((e) => [e.id, e]))
  const tplById = new Map(data.templates.map((t) => [t.id, t]))
  const active = data.templates.filter((t) => !t.archived)
  const next = nextTemplate(active, data.sessions)
  const schedule = data.habit ? ruleOn(data.habit, today).schedule : undefined
  const target = schedule?.kind === 'days' ? schedule.days.length : schedule?.kind === 'perWeek' ? schedule.times : undefined
  const thisWeek = sessionsInWeek(data.sessions, today, settings.weekStartsOn)

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">{thisWeek}</span>
          <span className="text-sm text-muted">{target ? `of ${target} sessions this week` : 'sessions this week'}</span>
        </div>
        <p className="mt-1 text-xs text-faint">A home session counts as half: it is the minimum version.</p>
      </Card>

      <Section title="Start a workout">
        <div className="grid gap-2">
          {active.map((t) => (
            <Link
              key={t.id}
              to={`/workout/new?template=${encodeURIComponent(t.id)}`}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-surface-2 px-4 active:bg-line"
            >
              <span className="flex-1">{t.name}</span>
              {t.id === next?.id && <Badge tone="accent">Next</Badge>}
              <Icon name="chevronRight" className="text-faint" />
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Recent sessions">
        <Card>
          {data.sessions.length === 0 ? (
            <p className="text-sm text-muted">No workouts yet. Sets are pre-filled from your last session, so logging takes seconds.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.sessions.slice(0, 20).map((s) => {
                const prs = prsInSession(s, data.sessions, exById)
                return (
                  <li key={s.id}>
                    <Link to={`/workout/${encodeURIComponent(s.id)}`} className="flex min-h-12 items-center gap-2 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block">{(s.templateId && tplById.get(s.templateId)?.name) || 'Workout'}</span>
                        <span className="text-xs text-faint">
                          {formatDay(s.day, { weekday: 'short', day: 'numeric', month: 'short' })} · {s.entries.reduce((n, e) => n + e.sets.length, 0)} sets
                          {s.location === 'home' ? ' · home' : ''}
                        </span>
                        {prs.length > 0 && (
                          <span className="block text-xs text-ok">PR: {prs.map((p) => exById.get(p.exerciseId)?.name).join(', ')}</span>
                        )}
                      </span>
                      {prs.length > 0 && <Badge tone="ok">{prs.length} PR</Badge>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </Section>

      <Section
        title="Templates"
        action={
          <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> Template
          </Button>
        }
      >
        <Card className="divide-y divide-line">
          {data.templates.map((t) => (
            <button key={t.id} type="button" className="flex min-h-12 w-full items-center gap-2 py-2 text-left" onClick={() => setEditing(t)}>
              <span className="min-w-0 flex-1">
                <span className="block">{t.name}</span>
                <span className="text-xs text-faint">{t.items.map((i) => exById.get(i.exerciseId)?.name).filter(Boolean).join(', ')}</span>
              </span>
              {t.archived && <Badge>Archived</Badge>}
            </button>
          ))}
        </Card>
      </Section>

      {editing && <TemplateSheet template={editing === 'new' ? undefined : editing} exercises={data.exercises} onClose={() => setEditing(null)} />}
    </div>
  )
}
