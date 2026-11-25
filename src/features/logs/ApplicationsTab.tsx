import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { moveApplication } from '../../db/actions/career'
import { db } from '../../db/db'
import { dueFollowUps, funnel, nextStage, PIPELINE, STAGE_LABEL } from '../../domain/career'
import { formatDay, type DayKey } from '../../domain/time/day'
import type { Application } from '../../model/career'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { ApplicationSheet } from '../career/ApplicationSheet'

const short = (d: DayKey) => formatDay(d, { day: 'numeric', month: 'short' })

export function AppRow({ app, today, onOpen }: { app: Application; today: DayKey; onOpen: () => void }) {
  const next = nextStage(app.stage)
  const overdue = app.nextActionDay !== undefined && app.nextActionDay < today
  const dueToday = app.nextActionDay === today
  return (
    <div className="flex items-center gap-2 py-2">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <span className="block font-medium">
          {app.company} <span className="font-normal text-faint">{app.role}</span>
        </span>
        <span className="text-sm text-muted">
          {app.nextAction || 'No next action'}
          {app.nextActionDay && (
            <span className={overdue ? 'text-bad' : dueToday ? 'text-warn' : 'text-faint'}>
              {' '}
              · {overdue ? 'overdue since ' : dueToday ? 'today' : 'by '}
              {!dueToday && short(app.nextActionDay)}
            </span>
          )}
        </span>
        {app.referrer && <span className="block text-xs text-faint">via {app.referrer}</span>}
      </button>
      {next && app.stage !== 'rejected' && (
        <Button size="sm" variant="outline" onClick={() => void moveApplication(app.id, next, today)} aria-label={`Move ${app.company} to ${STAGE_LABEL[next]}`}>
          → {STAGE_LABEL[next]}
        </Button>
      )}
    </div>
  )
}

export function ApplicationsTab() {
  const { today } = useAppData()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const apps = useLiveQuery(() => db.applications.toArray(), [])
  if (!apps) return null

  const due = dueFollowUps(apps, today)
  const counts = funnel(apps)
  const offers = apps.filter((a) => a.stage === 'offer')
  const rejected = apps.filter((a) => a.stage === 'rejected')

  return (
    <div className="space-y-6">
      <Button variant="primary" className="w-full" onClick={() => setAdding(true)}>
        <Icon name="plus" size={18} /> Add a company
      </Button>

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">{apps.length}</span>
          <span className="text-sm text-muted">companies in your pipeline</span>
        </div>
        {apps.length > 0 && (
          <ol className="mt-3 space-y-1.5 text-sm">
            {counts.map((c) => (
              <li key={c.stage} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-muted">{STAGE_LABEL[c.stage]}</span>
                <span className="h-2 rounded-full bg-[var(--color-series-1)]" style={{ width: `${Math.max(2, (c.count / Math.max(1, apps.length)) * 100)}%` }} aria-hidden="true" />
                <span className="tabular-nums">{c.count}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {due.length > 0 && (
        <Section title="Follow-ups due">
          <Card className="divide-y divide-line">
            {due.map((a) => (
              <AppRow key={a.id} app={a} today={today} onOpen={() => setEditing(a)} />
            ))}
          </Card>
        </Section>
      )}

      {PIPELINE.map((stage) => {
        const list = apps.filter((a) => a.stage === stage)
        if (!list.length) return null
        return (
          <Section key={stage} title={`${STAGE_LABEL[stage]} (${list.length})`}>
            <Card className="divide-y divide-line">
              {list.map((a) => (
                <AppRow key={a.id} app={a} today={today} onOpen={() => setEditing(a)} />
              ))}
            </Card>
          </Section>
        )
      })}

      {offers.length > 0 && (
        <Section title={`Offers (${offers.length})`}>
          <Card className="divide-y divide-line">
            {offers.map((a) => (
              <button key={a.id} type="button" className="flex w-full items-center gap-2 py-3 text-left" onClick={() => setEditing(a)}>
                <span className="flex-1 font-medium">{a.company}</span>
                <Badge tone="ok">Offer</Badge>
              </button>
            ))}
          </Card>
        </Section>
      )}

      {rejected.length > 0 && (
        <Section title={`Closed (${rejected.length})`}>
          <Button size="sm" variant="ghost" onClick={() => setShowClosed(!showClosed)}>
            {showClosed ? 'Hide' : 'Show'}
          </Button>
          {showClosed && (
            <Card className="divide-y divide-line">
              {rejected.map((a) => (
                <button key={a.id} type="button" className="flex w-full items-center gap-2 py-3 text-left" onClick={() => setEditing(a)}>
                  <span className="flex-1">{a.company}</span>
                  <span className="text-sm text-faint">reached {STAGE_LABEL[a.history.filter((h) => h.stage !== 'rejected').at(-1)?.stage ?? 'target']}</span>
                </button>
              ))}
            </Card>
          )}
        </Section>
      )}

      {apps.length === 0 && <p className="px-1 text-sm text-muted">Add the companies you're targeting; move each one forward as you ask for referrals and apply.</p>}

      {adding && <ApplicationSheet onClose={() => setAdding(false)} />}
      {editing && <ApplicationSheet app={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
