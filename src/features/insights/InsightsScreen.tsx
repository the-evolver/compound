import { useSearchParams } from 'react-router'
import { recentStatus } from '../../domain/habits/compliance'
import { cx } from '../../ui/primitives'
import { ScreenHeader, SettingsLink } from '../../ui/ScreenHeader'
import { StatusBadge } from '../review/ScoreboardView'
import { AreaInsights } from './AreaInsights'
import { BodyCharts, CareerCharts, SkinCharts, VoiceCharts } from './AreaCharts'
import { useInsightsData } from './useInsightsData'

const AREA_CHARTS = { career: CareerCharts, body: BodyCharts, skin: SkinCharts, voice: VoiceCharts } as const

export function InsightsScreen() {
  const data = useInsightsData()
  const [params, setParams] = useSearchParams()
  if (!data) return <ScreenHeader title="Insights" actions={<SettingsLink />} />

  const areas = data.areas.filter((a) => !a.archivedAt)
  if (!areas.length) {
    return (
      <div className="space-y-6">
        <ScreenHeader title="Insights" actions={<SettingsLink />} />
        <p className="text-muted">Insights appear once your plan has areas and habits.</p>
      </div>
    )
  }
  const area = areas.find((a) => a.id === params.get('area')) ?? areas[0]
  const Charts = area ? (area.charts ? AREA_CHARTS[area.charts] : undefined) : undefined

  return (
    <div className="space-y-6">
      <ScreenHeader title="Insights" actions={<SettingsLink />} />

      <section aria-label="Status per area" className="grid grid-cols-2 gap-2">
        {areas.map((a) => {
          const s = recentStatus(
            data.habits.filter((h) => h.areaId === a.id),
            data.ctx,
          )
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={a.id === area?.id}
              onClick={() => setParams({ area: a.id }, { replace: true })}
              className={cx('rounded-2xl bg-surface p-3 text-left', a.id === area?.id && 'ring-2 ring-accent/60')}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                <span className="font-semibold">{a.name}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusBadge status={s.status} />
                <span className="text-sm tabular-nums text-muted">{s.ratio === null ? '' : `${Math.round(s.ratio * 100)}%`}</span>
              </div>
            </button>
          )
        })}
      </section>
      <p className="-mt-3 px-1 text-xs text-faint">From the last 14 complete days: on track ≥ 80%, slipping 50–79%, off track below 50%.</p>

      {area && (
        <>
          <h2 className="text-lg font-semibold">{area.name}</h2>
          <AreaInsights area={area} data={data} />
          {Charts && <Charts data={data} color={area.color as `#${string}`} />}
        </>
      )}
    </div>
  )
}
