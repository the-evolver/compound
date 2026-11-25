import { lazy, Suspense } from 'react'
import type { BarTrendProps, LineTrendProps } from './types'

export type { BarTrendProps, ChartSeries, LineTrendProps, SeriesColor } from './types'
export { Sparkline } from './Sparkline'
export { Heatmap } from './Heatmap'

// Charts load on demand, so Today doesn't pay for the chart library at startup.
const LineTrendImpl = lazy(() => import('./LineTrendImpl'))
const BarTrendImpl = lazy(() => import('./BarTrendImpl'))

export function LineTrend(props: LineTrendProps) {
  return (
    <Suspense fallback={<div style={{ height: (props.height ?? 180) + 24 }} />}>
      <LineTrendImpl {...props} />
    </Suspense>
  )
}

export function BarTrend(props: BarTrendProps) {
  return (
    <Suspense fallback={<div style={{ height: props.height ?? 160 }} />}>
      <BarTrendImpl {...props} />
    </Suspense>
  )
}
