import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { setTaskDone } from '../../db/actions/career'
import { db } from '../../db/db'
import { mockAverage } from '../../domain/career'
import { formatDay } from '../../domain/time/day'
import type { Mock } from '../../model/career'
import type { Task } from '../../model/core'
import { LineTrend } from '../../ui/charts'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, cx, Section } from '../../ui/primitives'
import { MockSheet, MOCK_TYPES } from '../career/MockSheet'

export function TaskCheck({ task }: { task: Task }) {
  const done = !!task.doneAt
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1.5">
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-[var(--color-accent)]"
        checked={done}
        onChange={(e) => void setTaskDone(task.id, e.target.checked)}
      />
      <span className={cx('min-w-0 flex-1', done && 'text-faint line-through')}>{task.text}</span>
    </label>
  )
}

export function MocksTab() {
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<Mock | null>(null)
  const [showDone, setShowDone] = useState(false)
  const data = useLiveQuery(async () => {
    const [mocks, fixes] = await Promise.all([db.mocks.orderBy('day').toArray(), db.tasks.where('kind').equals('mock-fix').toArray()])
    return { mocks, fixes: fixes.sort((a, b) => a.createdAt - b.createdAt) }
  }, [])
  if (!data) return null

  const open = data.fixes.filter((f) => !f.doneAt)
  const done = data.fixes.filter((f) => f.doneAt)
  const typeLabel = (t: Mock['type']) => MOCK_TYPES.find((x) => x.value === t)?.label ?? t
  const chartData = data.mocks.map((m) => ({
    label: formatDay(m.day, { day: 'numeric', month: 'short' }),
    average: Math.round(mockAverage(m) * 10) / 10,
    communication: m.scores.communication,
  }))

  return (
    <div className="space-y-6">
      <Button variant="primary" className="w-full" onClick={() => setLogging(true)}>
        <Icon name="plus" size={18} /> Log a mock interview
      </Button>

      {data.mocks.length >= 2 && (
        <Section title="Score trend">
          <Card>
            <LineTrend
              ariaLabel="Mock interview scores over time"
              data={chartData}
              series={[
                { key: 'average', label: 'Average score', color: 'series-1' },
                { key: 'communication', label: 'Communication', color: 'series-2' },
              ]}
              yDomain={[1, 4]}
              yTicks={[1, 2, 3, 4]}
              format={(v) => `${v} / 4`}
            />
          </Card>
        </Section>
      )}

      <Section title={`Fixes to work on (${open.length})`}>
        <Card>
          {open.length === 0 && done.length === 0 && <p className="text-sm text-muted">Each mock's top 3 fixes land here as a checklist.</p>}
          {open.length === 0 && done.length > 0 && <p className="text-sm text-muted">All fixes done.</p>}
          <div className="divide-y divide-line">
            {open.map((t) => (
              <TaskCheck key={t.id} task={t} />
            ))}
          </div>
          {done.length > 0 && (
            <Button size="sm" variant="ghost" className="mt-1" onClick={() => setShowDone(!showDone)}>
              {showDone ? 'Hide done' : `Show done (${done.length})`}
            </Button>
          )}
          {showDone && (
            <div className="divide-y divide-line">
              {done.map((t) => (
                <TaskCheck key={t.id} task={t} />
              ))}
            </div>
          )}
        </Card>
      </Section>

      <Section title="Mocks">
        <Card>
          {data.mocks.length === 0 ? (
            <p className="text-sm text-muted">No mocks yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="py-1 font-normal">Date</th>
                  <th className="py-1 font-normal">Type</th>
                  <th className="py-1 text-right font-normal" title="Technical / Problem solving / Communication">
                    T · PS · C
                  </th>
                  <th className="py-1 text-right font-normal">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...data.mocks].reverse().map((m) => (
                  <tr key={m.id} className="cursor-pointer" onClick={() => setEditing(m)}>
                    <td className="py-2.5">{formatDay(m.day, { day: 'numeric', month: 'short' })}</td>
                    <td className="py-2.5">{typeLabel(m.type)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {m.scores.technical} · {m.scores.problemSolving} · {m.scores.communication}
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge tone={m.verdict === 'hire' ? 'ok' : 'neutral'}>{m.verdict === 'hire' ? 'Hire' : 'No hire'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Section>

      {logging && <MockSheet onClose={() => setLogging(false)} />}
      {editing && <MockSheet mock={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
