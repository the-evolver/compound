import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '../../db/db'
import { describeWeek } from '../../domain/review'
import { formatDay } from '../../domain/time/day'
import { Icon } from '../../ui/icons'
import { Badge, Card, Section } from '../../ui/primitives'
import { ScreenHeader, SettingsLink } from '../../ui/ScreenHeader'
import { useDueReviews } from './useDueReviews'

export function ReviewScreen() {
  const due = useDueReviews()
  const history = useLiveQuery(async () => {
    const [weeks, months] = await Promise.all([db.weeklyReviews.orderBy('weekStart').reverse().toArray(), db.monthlyReviews.orderBy('month').reverse().toArray()])
    return { weeks, months }
  }, [])

  return (
    <div className="space-y-6">
      <ScreenHeader title="Review" actions={<SettingsLink />} />

      {due && (due.week || due.month) ? (
        <div className="space-y-3">
          {due.week && (
            <Link to={`/review/week/${due.week}`} className="block rounded-2xl bg-accent p-4 text-accent-ink">
              <div className="text-lg font-semibold">Weekly review</div>
              <div className="text-sm opacity-90">{describeWeek(due.week)} · about 15 minutes, one step per screen</div>
            </Link>
          )}
          {due.month && (
            <Link to={`/review/month/${due.month}`} className="block rounded-2xl bg-surface-2 p-4">
              <div className="text-lg font-semibold">Monthly review</div>
              <div className="text-sm text-muted">{formatDay(`${due.month}-01`, { month: 'long', year: 'numeric' })}: results vs plan, checkpoints, keep/adjust/add habits</div>
            </Link>
          )}
        </div>
      ) : (
        <Card>
          <p className="text-muted">Nothing due. The weekly review opens on Sunday; the monthly review on the 1st.</p>
        </Card>
      )}

      <Section title="Weekly reviews">
        <Card>
          {history?.weeks.length ? (
            <ul className="divide-y divide-line">
              {history.weeks.map((w) => (
                <li key={w.id}>
                  <Link to={`/review/week/${w.weekStart}`} className="flex min-h-12 items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block">{describeWeek(w.weekStart)}</span>
                      {w.change && <span className="block truncate text-xs text-faint">Change: {w.change}</span>}
                    </span>
                    {w.completedAt ? <Badge tone="ok">Done</Badge> : <Badge tone="warn">In progress</Badge>}
                    <Icon name="chevronRight" className="text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Finished reviews are kept here, with the numbers as they were that week.</p>
          )}
        </Card>
      </Section>

      {history && history.months.length > 0 && (
        <Section title="Monthly reviews">
          <Card>
            <ul className="divide-y divide-line">
              {history.months.map((m) => (
                <li key={m.id}>
                  <Link to={`/review/month/${m.month}`} className="flex min-h-12 items-center gap-2 py-2">
                    <span className="flex-1">{formatDay(`${m.month}-01`, { month: 'long', year: 'numeric' })}</span>
                    {m.completedAt ? <Badge tone="ok">Done</Badge> : <Badge tone="warn">In progress</Badge>}
                    <Icon name="chevronRight" className="text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </div>
  )
}
