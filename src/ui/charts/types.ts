/** Colour token names usable for chart series (fixed order: series-1 first), or an area's hex colour. */
export type SeriesColor = 'series-1' | 'series-2' | 'series-3' | 'series-4' | 'accent' | `#${string}`

export interface ChartSeries {
  key: string
  label: string
  color: SeriesColor
}

export interface LineTrendProps {
  data: Array<Record<string, string | number | null>>
  series: ChartSeries[]
  yDomain?: [number | 'auto', number | 'auto']
  yTicks?: number[]
  height?: number
  format?: (v: number) => string
  ariaLabel: string
}

export interface BarTrendProps {
  data: Array<{ label: string; value: number | null }>
  color: SeriesColor
  /** Draws a dashed reference line (e.g. the 80% target). */
  target?: { value: number; label: string }
  yDomain?: [number | 'auto', number | 'auto']
  yTicks?: number[]
  height?: number
  format?: (v: number) => string
  name: string
  ariaLabel: string
}
