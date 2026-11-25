import { useState } from 'react'
import { Link } from 'react-router'
import { LOG_SOURCE_ROUTES } from '../logs/tabs'
import { clearHabitStatus, setHabitStatus } from '../../db/actions/daily'
import { LOG_SOURCES } from '../../domain/metrics'
import type { TodayItem } from '../../domain/today'
import type { DayKey } from '../../domain/time/day'
import { Icon } from '../../ui/icons'
import { Badge, Button, cx } from '../../ui/primitives'
import { SKIP_REASONS, SkipSheet } from './SkipSheet'

const STATUS_LABEL = { done: 'Done', min: 'Minimum', skip: 'Skipped' } as const

function progressText(item: TodayItem): string | null {
  if (item.week) return `${item.week.done} of ${item.week.times} this week`
  const p = item.result.progress
  const c = item.rule.completion
  // "0 of 1" says nothing a Done button doesn't; show counts only for targets above 1.
  if (!p || p.target === undefined || p.target <= 1 || c.kind !== 'log') return null
  const unit = LOG_SOURCES[c.source as keyof typeof LOG_SOURCES]?.unit ?? ''
  return `${p.value} of ${p.target} ${unit}`.trim()
}

export function StrengthPill({ value }: { value: number }) {
  return (
    <div className="shrink-0 text-right" aria-label={`Strength ${value} of 100`}>
      <div className="text-sm font-semibold tabular-nums text-muted">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-faint">strength</div>
    </div>
  )
}

export function HabitDetails({ item }: { item: TodayItem }) {
  const { habit, rule } = item
  const lines: Array<[string, string]> = [
    ['Plan', habit.ifThen],
    ['If blocked', habit.obstacle],
    ['Minimum', habit.minVersion],
    ['Target', rule.targetText],
    ['Counts as done', habit.doneHint],
  ]
  return (
    <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
      {lines
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-faint">{k}</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
    </dl>
  )
}

export function HabitItem({ item, day }: { item: TodayItem; day: DayKey }) {
  const [open, setOpen] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const { habit, area, result } = item
  const outcome = result.outcome
  const resolved = outcome === 'done' || outcome === 'min' || outcome === 'skip'
  const fromLog = result.source === 'evidence'
  const progress = progressText(item)
  const skipLabel = SKIP_REASONS.find((r) => r.id === item.skipReason)?.label
  const logRoute = item.rule.completion.kind === 'log' ? LOG_SOURCE_ROUTES[item.rule.completion.source] : undefined

  return (
    <article className={cx('relative overflow-hidden rounded-2xl bg-surface', resolved && 'opacity-80')}>
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: area.color }} aria-hidden="true" />
      <div className="p-4 pl-5">
        <button type="button" className="flex w-full items-start gap-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold leading-snug">{habit.name}</h3>
              {item.neverMissTwice && !resolved && <Badge tone="warn">Never miss twice</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{habit.ifThen}</p>
            {progress && <p className="mt-1 text-xs text-faint">{progress}</p>}
          </div>
          <StrengthPill value={item.strength} />
        </button>
        {/* Shown whether or not the item is done, so the card keeps its height. */}
        {logRoute && (
          <Link to={logRoute} className="mt-1 inline-flex min-h-8 items-center text-sm text-accent">
            Log it →
          </Link>
        )}

        {open && <HabitDetails item={item} />}

        {/* Both rows are the same height, so marking an item never moves the cards below it. */}
        {resolved ? (
          <div className="mt-3 flex min-h-12 items-center gap-2">
            <span
              className={cx(
                'inline-flex items-center gap-1.5 text-sm font-medium',
                outcome === 'done' ? 'text-ok' : outcome === 'min' ? 'text-warn' : 'text-muted',
              )}
            >
              {outcome !== 'skip' && <Icon name="check" size={18} />}
              {STATUS_LABEL[outcome]}
              {outcome === 'skip' && skipLabel && <span className="font-normal text-faint">· {skipLabel}</span>}
              {fromLog && <span className="font-normal text-faint">· from your log</span>}
            </span>
            <span className="flex-1" />
            {!fromLog && (
              <Button variant="ghost" onClick={() => void clearHabitStatus(habit.id, day)}>
                <Icon name="undo" size={16} />
                Undo
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="primary" onClick={() => void setHabitStatus(habit.id, day, 'done')}>
              Done
            </Button>
            <Button onClick={() => void setHabitStatus(habit.id, day, 'min')}>Min</Button>
            <Button variant="outline" disabled={!item.canSkip} onClick={() => setSkipping(true)}>
              {item.canSkip ? 'Skip' : 'No skips'}
            </Button>
          </div>
        )}
      </div>

      {skipping && (
        <SkipSheet
          habitName={habit.name}
          skipsLeft={item.skipsLeft}
          onClose={() => setSkipping(false)}
          onPick={(reason) => {
            setSkipping(false)
            void setHabitStatus(habit.id, day, 'skip', reason)
          }}
        />
      )}
    </article>
  )
}
