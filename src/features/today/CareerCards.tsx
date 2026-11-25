import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import { dueFollowUps, dueReviews } from '../../domain/career'
import { isActiveOn, ruleOn } from '../../domain/habits/rules'
import type { DayKey } from '../../domain/time/day'
import type { Application, DsaProblem } from '../../model/career'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card } from '../../ui/primitives'
import { ApplicationSheet } from '../career/ApplicationSheet'
import { ProblemSheet } from '../career/ProblemSheet'
import { ReviewSheet } from '../career/ReviewSheet'
import { AppRow } from '../logs/ApplicationsTab'
import { DueReviewList } from '../logs/DsaTab'

/** Today card: reviews due and a quick "Log a problem". Shown while the DSA habit is active. */
export function DsaCard({ day }: { day: DayKey }) {
  const [logging, setLogging] = useState(false)
  const [reviewing, setReviewing] = useState<DsaProblem | null>(null)
  const data = useLiveQuery(async () => {
    const [habits, problems, reviewsToday, newToday] = await Promise.all([
      db.habits.toArray(),
      db.dsaProblems.toArray(),
      db.dsaReviews.where('day').equals(day).count(),
      db.dsaProblems.where('day').equals(day).count(),
    ])
    // Shown while any habit is counted from the DSA log.
    const active = habits.some((h) => isActiveOn(h, day) && ruleOn(h, day).completion.kind === 'log' && (ruleOn(h, day).completion as { source: string }).source === 'dsa')
    return { active, due: dueReviews(problems, day), reviewsToday, newToday }
  }, [day])
  if (!data || (!data.active && data.due.length === 0)) return null

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">DSA</h2>
        <Badge tone={data.due.length ? 'accent' : 'neutral'}>Reviews due today: {data.due.length}</Badge>
      </div>
      {data.due.length > 0 && <DueReviewList problems={data.due.slice(0, 5)} onReview={setReviewing} />}
      {data.due.length > 5 && <p className="text-xs text-faint">+{data.due.length - 5} more in Logs → DSA</p>}
      <p className="text-sm text-muted">
        Today: {data.reviewsToday} review{data.reviewsToday === 1 ? '' : 's'}, {data.newToday} new. Reviews first, then new.
      </p>
      <Button className="w-full" onClick={() => setLogging(true)}>
        <Icon name="plus" size={18} /> Log a problem
      </Button>
      {logging && <ProblemSheet onClose={() => setLogging(false)} />}
      {reviewing && <ReviewSheet problem={reviewing} onClose={() => setReviewing(null)} />}
    </Card>
  )
}

/** Today card: application follow-ups that are due or overdue. */
export function FollowUpsCard({ day }: { day: DayKey }) {
  const [editing, setEditing] = useState<Application | null>(null)
  const due = useLiveQuery(async () => dueFollowUps(await db.applications.toArray(), day), [day])
  if (!due?.length) return null
  return (
    <Card>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Follow-ups due</h2>
      <div className="divide-y divide-line">
        {due.map((a) => (
          <AppRow key={a.id} app={a} today={day} onOpen={() => setEditing(a)} />
        ))}
      </div>
      {editing && <ApplicationSheet app={editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}
