import { useState } from 'react'
import { clearHabitStatus, setHabitStatus, setMetric } from '../../db/actions/daily'
import { METRICS, type MetricDef } from '../../domain/metrics'
import type { TodayItem } from '../../domain/today'
import type { DayKey } from '../../domain/time/day'
import { Badge, Button, Card } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { SKIP_REASONS } from './SkipSheet'
import type { TodayData } from './useTodayData'

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

function StatusBadge({ item }: { item: TodayItem }) {
  switch (item.result.outcome) {
    case 'done':
      return <Badge tone="ok">Done</Badge>
    case 'min':
      return <Badge tone="warn">Minimum</Badge>
    case 'skip':
      return <Badge>Skipped</Badge>
    default:
      return item.neverMissTwice ? <Badge tone="warn">Never miss twice</Badge> : null
  }
}

function NumberHabitSheet({ item, day, onClose }: { item: TodayItem; day: DayKey; onClose: () => void }) {
  const [skipping, setSkipping] = useState(false)
  const tapped = item.result.source === 'tap'
  const act = (p: Promise<void>) => void p.then(onClose)

  return (
    <Sheet title={item.habit.name} onClose={onClose}>
      <p className="mb-1 text-sm text-muted">{item.habit.ifThen}</p>
      <p className="mb-4 text-sm text-muted">Minimum: {item.habit.minVersion}</p>
      {skipping ? (
        <>
          <p className="mb-2 text-sm text-muted">
            Skipping doesn't lower strength. {item.skipsLeft} left this week.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SKIP_REASONS.map((r) => (
              <Button key={r.id} onClick={() => act(setHabitStatus(item.habit.id, day, 'skip', r.id))}>
                {r.label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Button onClick={() => act(setHabitStatus(item.habit.id, day, 'done'))}>Mark done</Button>
          <Button onClick={() => act(setHabitStatus(item.habit.id, day, 'min'))}>Mark minimum version</Button>
          <Button variant="ghost" disabled={!item.canSkip} onClick={() => setSkipping(true)}>
            {item.canSkip ? 'Skip today' : 'No skips left this week'}
          </Button>
          {tapped && (
            <Button variant="ghost" onClick={() => act(clearHabitStatus(item.habit.id, day))}>
              Go back to the number
            </Button>
          )}
        </div>
      )}
      <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
        Close
      </Button>
    </Sheet>
  )
}

function MetricLine({
  def,
  day,
  value,
  last,
  item,
  caption,
}: {
  def: MetricDef
  day: DayKey
  value: number | undefined
  last: number | undefined
  item?: TodayItem
  caption: string
}) {
  const [sheet, setSheet] = useState(false)
  const label = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{def.label}</span>
        {item && <StatusBadge item={item} />}
      </div>
      <div className="text-xs text-faint">{caption}</div>
    </>
  )
  return (
    <div className="flex items-center gap-3 py-2">
      {item ? (
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSheet(true)}>
          {label}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{label}</div>
      )}
      <div className="w-44 shrink-0">
        <Stepper
          size="sm"
          label={def.label}
          value={value}
          start={last}
          step={def.step}
          min={def.min}
          max={def.max}
          decimals={def.decimals}
          unit={def.unit}
          onChange={(v) => void setMetric(day, def.key, v)}
        />
      </div>
      {sheet && item && <NumberHabitSheet item={item} day={day} onClose={() => setSheet(false)} />}
    </div>
  )
}

export function NumbersRow({ data, day }: { data: TodayData; day: DayKey }) {
  const metrics = data.entry?.metrics ?? {}
  return (
    <Card className="divide-y divide-line py-2">
      {data.model.numbers.map((item) => {
        const c = item.rule.completion
        if (c.kind !== 'metric') return null
        const def = (METRICS as Record<string, MetricDef>)[c.metric]
        if (!def) return null
        const target = item.result.progress?.target
        const caption = target !== undefined ? `Target ${num.format(target)}${def.unit ? ` ${def.unit}` : ''}` : item.rule.targetText
        return <MetricLine key={item.habit.id} def={def} day={day} value={metrics[def.key]} last={data.last[def.key]} item={item} caption={caption} />
      })}
      <MetricLine
        def={METRICS.weightKg}
        day={day}
        value={metrics.weightKg}
        last={data.last.weightKg}
        caption={data.bodyweightKg !== undefined ? `Optional · 7-day avg ${num.format(data.bodyweightKg)} kg` : 'Optional'}
      />
    </Card>
  )
}
