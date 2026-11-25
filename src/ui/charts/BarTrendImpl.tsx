import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarTrendProps } from './types'
import { useThemeColors } from './useThemeColors'

/*
 * Single-series bars per the data-viz rules: thin bars with 4px rounded
 * tops anchored to the baseline, a 2px gap between bars, horizontal grid
 * only, quiet axes, a hover tooltip, and an optional dashed target line.
 */
export default function BarTrendImpl({ data, color, target, yDomain, yTicks, height = 160, format = (v) => String(v), name, ariaLabel }: BarTrendProps) {
  const theme = useThemeColors(['line', 'faint', 'muted', 'surface-2', 'text', ...(color.startsWith('#') ? [] : [color])] as const)
  const fill = color.startsWith('#') ? color : (theme as Record<string, string>)[color]
  return (
    <figure aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={theme.line} />
          <XAxis dataKey="label" tick={{ fill: theme.faint, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis domain={yDomain} ticks={yTicks} tick={{ fill: theme.faint, fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => format(Number(v))} />
          <Tooltip
            cursor={{ fill: theme['surface-2'] }}
            contentStyle={{ background: theme['surface-2'], border: `1px solid ${theme.line}`, borderRadius: 12, color: theme.text, fontSize: 13 }}
            labelStyle={{ color: theme.muted, marginBottom: 4 }}
            formatter={(value) => [value === null || value === undefined ? 'No data' : format(Number(value)), name]}
          />
          {target && (
            <ReferenceLine y={target.value} stroke={theme.muted} strokeDasharray="4 4" label={{ value: target.label, position: 'insideTopRight', fill: theme.muted, fontSize: 11 }} />
          )}
          <Bar dataKey="value" name={name} fill={fill} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}
