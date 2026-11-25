import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LineTrendProps } from './types'
import { useThemeColors } from './useThemeColors'

/*
 * Line chart per the data-viz rules: 2px lines, 8px markers ringed with the
 * surface colour, horizontal grid only, quiet axes, a crosshair tooltip,
 * and a legend only when there is more than one series.
 */
export default function LineTrendImpl({ data, series, yDomain, yTicks, height = 180, format = (v) => String(v), ariaLabel }: LineTrendProps) {
  const tokens = series.map((s) => s.color).filter((c) => !c.startsWith('#'))
  const theme = useThemeColors(['line', 'faint', 'surface', 'surface-2', 'text', 'muted', ...tokens] as const)
  // Series may use a theme token or an area's own hex colour.
  const colors = new Proxy(theme as Record<string, string>, { get: (t, k: string) => (k.startsWith('#') ? k : t[k]) })

  return (
    <figure aria-label={ariaLabel} className="space-y-2">
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: colors[s.color] }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={colors.line} />
            <XAxis dataKey="label" tick={{ fill: colors.faint, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis domain={yDomain} ticks={yTicks} tick={{ fill: colors.faint, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ stroke: colors.faint, strokeWidth: 1 }}
              contentStyle={{ background: colors['surface-2'], border: `1px solid ${colors.line}`, borderRadius: 12, color: colors.text, fontSize: 13 }}
              labelStyle={{ color: colors.muted, marginBottom: 4 }}
              formatter={(value, name) => [format(Number(value)), series.find((s) => s.key === name)?.label ?? String(name)]}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={colors[s.color]}
                strokeWidth={2}
                dot={{ r: 4, fill: colors[s.color], stroke: colors.surface, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: colors[s.color], stroke: colors.surface, strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
