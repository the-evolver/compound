import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { db } from '../../db/db'
import { dueReviews, reviewPassRate, weakPatterns } from '../../domain/career'
import { formatDay, startOfWeek } from '../../domain/time/day'
import type { DsaProblem } from '../../model/career'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { ProblemSheet } from '../career/ProblemSheet'
import { ReviewSheet } from '../career/ReviewSheet'

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

export function DueReviewList({ problems, onReview }: { problems: DsaProblem[]; onReview: (p: DsaProblem) => void }) {
  return (
    <ul className="divide-y divide-line">
      {problems.map((p) => (
        <li key={p.id}>
          <button type="button" className="flex min-h-12 w-full items-center gap-3 py-2 text-left" onClick={() => onReview(p)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{p.title}</span>
              <span className="text-xs text-faint">{p.tags.join(', ') || p.difficulty}</span>
            </span>
            <Badge tone="accent">Review</Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function DsaTab() {
  const { settings, today } = useAppData()
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<DsaProblem | null>(null)
  const [reviewing, setReviewing] = useState<DsaProblem | null>(null)
  const [allPatterns, setAllPatterns] = useState(false)
  const data = useLiveQuery(async () => {
    const [problems, reviews] = await Promise.all([db.dsaProblems.orderBy('day').reverse().toArray(), db.dsaReviews.toArray()])
    return { problems, reviews }
  }, [])
  if (!data) return null

  const due = dueReviews(data.problems, today)
  const weekStart = startOfWeek(today, settings.weekStartsOn)
  const newThisWeek = data.problems.filter((p) => p.day >= weekStart).length
  const reviewsThisWeek = data.reviews.filter((r) => r.day >= weekStart).length
  const patterns = weakPatterns(data.problems, data.reviews)
  const shownPatterns = allPatterns ? patterns : patterns.slice(0, 6)

  return (
    <div className="space-y-6">
      <Button variant="primary" className="w-full" onClick={() => setLogging(true)}>
        <Icon name="plus" size={18} /> Log a problem
      </Button>

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{newThisWeek}</div>
          <div className="text-xs text-faint">new this week</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{reviewsThisWeek}</div>
          <div className="text-xs text-faint">reviews this week</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{pct(reviewPassRate(data.reviews))}</div>
          <div className="text-xs text-faint">review pass rate</div>
        </div>
      </Card>

      <Section title={`Reviews due (${due.length})`}>
        <Card>
          {due.length ? (
            <DueReviewList problems={due} onReview={setReviewing} />
          ) : (
            <p className="text-sm text-muted">Nothing due. Reviews come back after 1, 3, 7, 14, 30 and 60 days.</p>
          )}
        </Card>
      </Section>

      {patterns.length > 0 && (
        <Section title="Weak patterns">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="py-1 font-normal">Pattern</th>
                  <th className="py-1 text-right font-normal">Attempts</th>
                  <th className="py-1 text-right font-normal">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shownPatterns.map((p) => (
                  <tr key={p.tag}>
                    <td className="py-2">{p.tag}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{p.attempts}</td>
                    <td className="py-2 text-right tabular-nums">{pct(p.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-faint">Failed = saw the solution on the first try, or failed a review.</p>
            {patterns.length > 6 && (
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => setAllPatterns(!allPatterns)}>
                {allPatterns ? 'Show fewer' : `Show all ${patterns.length}`}
              </Button>
            )}
          </Card>
        </Section>
      )}

      <Section title="Problems">
        <Card>
          {data.problems.length === 0 ? (
            <p className="text-sm text-muted">No problems yet. Log each one right after you solve it; it comes back for review tomorrow.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.problems.slice(0, 30).map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex min-h-12 w-full items-center gap-3 py-2 text-left" onClick={() => setEditing(p)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.title}</span>
                      <span className="text-xs text-faint">
                        {formatDay(p.day, { day: 'numeric', month: 'short' })} · {p.difficulty} ·{' '}
                        {p.srs.graduated ? 'graduated' : p.srs.dueDay <= today ? 'review due' : `review ${formatDay(p.srs.dueDay, { day: 'numeric', month: 'short' })}`}
                      </span>
                    </span>
                    {p.outcome !== 'alone' && <Badge tone={p.outcome === 'solution' ? 'bad' : 'warn'}>{p.outcome === 'solution' ? 'saw solution' : 'hint'}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.problems.length > 30 && <p className="pt-2 text-xs text-faint">Showing the latest 30. The full list is in the CSV export.</p>}
        </Card>
      </Section>

      {logging && <ProblemSheet onClose={() => setLogging(false)} />}
      {editing && <ProblemSheet problem={editing} onClose={() => setEditing(null)} />}
      {reviewing && <ReviewSheet problem={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  )
}

