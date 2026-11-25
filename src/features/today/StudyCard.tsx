import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { clearStudy, logStudy } from '../../db/actions/plan'
import { db } from '../../db/db'
import { nextTopic, TOPIC_STATUS_SHORT } from '../../domain/study'
import type { DayKey } from '../../domain/time/day'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card } from '../../ui/primitives'
import { TopicStatusSheet } from '../plan/StudyTab'

/** Today card: the active subject's next topic, with Done / Not today. */
export function StudyCard({ day }: { day: DayKey }) {
  const [rating, setRating] = useState(false)
  const data = useLiveQuery(async () => {
    const active = (await db.subjects.where('status').equals('active').toArray())[0]
    if (!active) return { active: undefined }
    const [topics, session] = await Promise.all([db.topics.where('subjectId').equals(active.id).toArray(), db.studySessions.get(`study|${day}`)])
    return { active, topics, session }
  }, [day])
  if (!data?.active) return null
  const { active, topics, session } = data
  const next = nextTopic(topics)
  const studied = session?.topicId ? topics.find((t) => t.id === session.topicId) : undefined

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Study</h2>
        <Badge tone="accent">{active.name}</Badge>
      </div>

      {session ? (
        <div className="flex min-h-12 items-center gap-2">
          {session.outcome === 'done' ? (
            <>
              <Icon name="check" size={18} className="text-ok" />
              <span className="min-w-0 flex-1">
                Studied {studied ? <span className="font-medium">{studied.title}</span> : 'today'}
              </span>
              {studied && (
                <button type="button" onClick={() => setRating(true)} aria-label="Update how well you know it">
                  <Badge tone="accent">{TOPIC_STATUS_SHORT[studied.status]}</Badge>
                </button>
              )}
            </>
          ) : (
            <span className="flex-1 text-muted">Not today. Back to it tomorrow.</span>
          )}
          <Button variant="ghost" onClick={() => void clearStudy(day)}>
            <Icon name="undo" size={16} /> Undo
          </Button>
        </div>
      ) : next ? (
        <>
          <div>
            <div className="text-sm text-muted">Next topic{next.group ? ` · ${next.group}` : ''}</div>
            <div className="text-lg font-semibold">{next.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => void logStudy(day, active.id, 'done', next.id)}>
              Done
            </Button>
            <Button variant="outline" onClick={() => void logStudy(day, active.id, 'not_today')}>
              Not today
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">
          {topics.length === 0 ? 'This subject has no topics yet. ' : 'Every topic can be explained. '}
          <Link to="/plan?tab=study" className="text-accent underline">
            {topics.length === 0 ? 'Add or paste topics' : 'Move to the next subject'}
          </Link>
        </p>
      )}
      {session?.outcome === 'done' && studied && <p className="text-xs text-faint">Tap the label to update how well you know it.</p>}
      {rating && studied && <TopicStatusSheet topic={studied} onClose={() => setRating(false)} />}
    </Card>
  )
}
