import type { TrackStatus } from '../../domain/habits/compliance'
import type { WeeklyScoreboard } from '../../domain/review'
import { Badge, Card } from '../../ui/primitives'

const STATUS: Record<TrackStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral'; mark: string }> = {
  on_track: { label: 'On track', tone: 'ok', mark: '✓' },
  slipping: { label: 'Slipping', tone: 'warn', mark: '!' },
  off_track: { label: 'Off track', tone: 'bad', mark: '✕' },
  no_data: { label: 'No data', tone: 'neutral', mark: '·' },
}

export function StatusBadge({ status }: { status: TrackStatus }) {
  const s = STATUS[status]
  return (
    <Badge tone={s.tone}>
      <span aria-hidden="true" className="mr-1">
        {s.mark}
      </span>
      {s.label}
    </Badge>
  )
}

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

/** Step 1: lead-measure compliance per area against the 80% target, plus habit strengths. */
export function ScoreboardView({ board }: { board: WeeklyScoreboard }) {
  return (
    <div className="space-y-3">
      {board.areas.map((a) => (
        <Card key={a.areaId} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: a.color }} aria-hidden="true" />
            <span className="flex-1 font-semibold">{a.name}</span>
            <span className="tabular-nums">{pct(a.compliance)}</span>
            <StatusBadge status={a.status} />
          </div>
          <div className="relative h-2 rounded-full bg-surface-2" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round((a.compliance ?? 0) * 100)}%`, background: a.color }} />
            <div className="absolute inset-y-[-3px] w-0.5 bg-text/60" style={{ left: '80%' }} title="80% target" />
          </div>
          {a.habits.length > 0 && (
            <ul className="space-y-1 pt-1 text-sm">
              {a.habits.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-muted">
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  <span className="w-12 text-right tabular-nums">{pct(h.compliance)}</span>
                  <span className="w-20 text-right text-xs text-faint tabular-nums">strength {h.strength}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      <p className="px-1 text-xs text-faint">The line marks the 80% target. Done counts 1, the minimum version ½, skips are left out.</p>
      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xl font-semibold tabular-nums">{board.dsa.reviewsDone}</div>
          <div className="text-xs text-faint">DSA reviews done</div>
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums">{board.dsa.reviewsStillDue}</div>
          <div className="text-xs text-faint">reviews still due</div>
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums">{board.topicsMoved}</div>
          <div className="text-xs text-faint">study topics moved</div>
        </div>
      </Card>
    </div>
  )
}

/** Step 2: results that lag behind the actions. */
export function LagView({ board }: { board: WeeklyScoreboard }) {
  const { lag } = board
  const delta = lag.weightAvg !== undefined && lag.weightAvgPrev !== undefined ? lag.weightAvg - lag.weightAvgPrev : undefined
  return (
    <Card className="divide-y divide-line">
      <div className="flex items-baseline justify-between py-3">
        <span>Weight, 7-day average</span>
        <span className="tabular-nums">
          {lag.weightAvg !== undefined ? `${lag.weightAvg.toFixed(1)} kg` : 'No weigh-ins'}
          {delta !== undefined && <span className="ml-2 text-sm text-muted">{`${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs last week`}</span>}
        </span>
      </div>
      <div className="flex items-baseline justify-between py-3">
        <span>Latest mock</span>
        <span className="tabular-nums">
          {lag.latestMock ? `${lag.latestMock.average}/4 · communication ${lag.latestMock.communication}/4` : 'None yet'}
        </span>
      </div>
      <div className="flex items-baseline justify-between py-3">
        <span>Applications moved</span>
        <span className="tabular-nums">{lag.applicationsMoved}</span>
      </div>
      <div className="flex items-baseline justify-between py-3">
        <span>New DSA problems</span>
        <span className="tabular-nums">{board.dsa.newProblems}</span>
      </div>
    </Card>
  )
}
