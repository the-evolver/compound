import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { planPosition } from '../../domain/plan'
import { Link } from 'react-router'
import { Button, Card, Section } from '../../ui/primitives'
import { TODAY_CARDS } from './cards'
import { DayNote } from './DayNote'
import { FirstWeekPreview } from './FirstWeekPreview'
import { HabitItem } from './HabitItem'
import { NumbersRow } from './NumbersRow'
import { TodayHeader } from './TodayHeader'
import { useTodayData } from './useTodayData'

export function TodayScreen() {
  const { settings, today } = useAppData()
  const data = useTodayData()
  const [showMore, setShowMore] = useState(false)
  const pos = planPosition(today, settings.planStart, settings.planEnd)

  if (!data) {
    return (
      <div className="space-y-6">
        <TodayHeader />
      </div>
    )
  }

  if (data.habits.length === 0) {
    return (
      <div className="space-y-6">
        <TodayHeader />
        <Card className="space-y-3">
          <div className="font-semibold">Your plan is empty</div>
          <p className="text-sm text-muted">Add an area (a part of life to improve) and its first habit. Today then shows what is due each day.</p>
          <Link to="/plan?tab=habits" className="flex min-h-12 items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink">
            Build my plan
          </Link>
        </Card>
      </div>
    )
  }

  if (pos.kind === 'before') {
    return (
      <div className="space-y-6">
        <TodayHeader />
        <FirstWeekPreview data={data} startDay={settings.planStart} />
      </div>
    )
  }

  const { model } = data
  const cards = [...TODAY_CARDS].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6">
      <TodayHeader />

      {model.total > 0 && (
        <p className="-mt-3 px-1 text-sm text-faint" aria-live="polite">
          {model.resolved === model.total ? `All ${model.total} done for today.` : `${model.resolved} of ${model.total} done`}
        </p>
      )}

      {model.pinned.length > 0 && (
        <Section title="Never miss twice">
          <p className="-mt-1 px-1 text-sm text-muted">Missed last time. Even the minimum version keeps it alive.</p>
          <div className="space-y-3">
            {model.pinned.map((item) => (
              <HabitItem key={item.habit.id} item={item} day={today} />
            ))}
          </div>
        </Section>
      )}

      {model.groups.map((g) => (
        <Section key={g.block} title={g.label}>
          <div className="space-y-3">
            {g.items.map((item) => (
              <HabitItem key={item.habit.id} item={item} day={today} />
            ))}
          </div>
        </Section>
      ))}

      {model.overflow.length > 0 &&
        (showMore ? (
          <Section title="More">
            <div className="space-y-3">
              {model.overflow.map((item) => (
                <HabitItem key={item.habit.id} item={item} day={today} />
              ))}
            </div>
          </Section>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setShowMore(true)}>
            +{model.overflow.length} more
          </Button>
        ))}

      {model.total === 0 && <p className="px-1 text-muted">Nothing due today.</p>}

      <Section title="Numbers">
        <NumbersRow data={data} day={today} />
      </Section>

      {cards.map(({ id, Component }) => (
        <Component key={id} day={today} />
      ))}

      <DayNote day={today} note={data.entry?.note ?? ''} />

      <p className="px-1 text-xs leading-relaxed text-faint">
        Strength builds slowly: habits take about 66 days on average to feel automatic (it varies a lot). One missed day
        doesn't undo it, so never miss twice.
      </p>
    </div>
  )
}
