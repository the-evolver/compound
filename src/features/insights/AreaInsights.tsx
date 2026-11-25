import { useAppData } from '../../app/AppData'
import { strengthSeries } from '../../domain/habits/strength'
import { complianceByWeek, dailyScores, heatmapRange, planWeeks, weekLabel } from '../../domain/insights'
import { addDays } from '../../domain/time/day'
import type { Area } from '../../model/core'
import { BarTrend, Heatmap, Sparkline } from '../../ui/charts'
import { Card, Section } from '../../ui/primitives'
import type { InsightsData } from './useInsightsData'

const pct = (v: number) => `${Math.round(v * 100)}%`

/** The parts every area has: weekly lead compliance, habit strength, and the heatmap calendar. */
export function AreaInsights({ area, data }: { area: Area; data: InsightsData }) {
  const { settings, today } = useAppData()
  const habits = data.habits.filter((h) => h.areaId === area.id && h.activeFrom && h.activeFrom <= today)
  const weeks = planWeeks(settings.planStart, today, settings.weekStartsOn)
  const weekly = complianceByWeek(habits, data.ctx, weeks, settings.weekStartsOn)
  const range = heatmapRange(settings.planStart, today, settings.weekStartsOn)
  const cells = dailyScores(habits, data.ctx, range.from, range.to)

  if (!habits.length) {
    return (
      <Card>
        <p className="text-sm text-muted">No {area.name.toLowerCase()} habits have started yet.</p>
      </Card>
    )
  }

  return (
    <>
      <Section title="Lead compliance by week">
        <Card>
          <BarTrend
            ariaLabel={`${area.name} lead compliance by week`}
            name="Compliance"
            data={weekly.map((w) => ({ label: weekLabel(w.weekStart), value: w.ratio }))}
            color={area.color as `#${string}`}
            yDomain={[0, 1]}
            yTicks={[0, 0.5, 0.8, 1]}
            target={{ value: 0.8, label: '80% target' }}
            format={pct}
          />
        </Card>
      </Section>

      <Section title="Habit strength">
        <Card>
          <ul className="divide-y divide-line">
            {habits.map((h) => {
              const series = strengthSeries(h, data.ctx)
              const sampled = series.filter((_, i) => i % 3 === 0 || i === series.length - 1).map((p) => p.strength)
              const current = Math.round((series.at(-1)?.strength ?? 0) * 100)
              return (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  <Sparkline values={sampled} color={area.color} label={`${h.name} strength trend, now ${current}`} />
                  <span className="w-8 text-right tabular-nums">{current}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-faint">0–100. Rises with every done day, dips slowly on misses; ~66 days to become automatic on average.</p>
        </Card>
      </Section>

      <Section title="Calendar">
        <Card>
          <Heatmap cells={cells} color={area.color} label={`${area.name} daily completion from ${range.from} to ${addDays(range.to, 0)}`} />
        </Card>
      </Section>
    </>
  )
}
