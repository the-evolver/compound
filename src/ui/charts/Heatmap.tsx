import type { HeatCell } from '../../domain/insights'
import { formatDay } from '../../domain/time/day'

/*
 * Calendar heatmap: one column per week, one row per weekday. One hue
 * (the area's), lighter to darker with the share of habits done. Days with
 * nothing due are outlined only, so "nothing due" never looks like "0%".
 */
const LEVELS = [0.18, 0.4, 0.65, 1]

function level(score: number): number {
  if (score <= 0) return LEVELS[0]!
  if (score < 0.5) return LEVELS[1]!
  if (score < 1) return LEVELS[2]!
  return LEVELS[3]!
}

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

export function Heatmap({ cells, color, label }: { cells: readonly HeatCell[]; color: string; label: string }) {
  const weeks: HeatCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7) as HeatCell[])
  const describe = (c: HeatCell) =>
    `${formatDay(c.day, { weekday: 'short', day: 'numeric', month: 'short' })}: ${c.future ? 'upcoming' : c.score === null ? 'nothing due' : `${Math.round(c.score * 100)}% done`}`

  return (
    <figure aria-label={label} className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] pr-1 text-[10px] leading-[14px] text-faint" aria-hidden="true">
          {WEEKDAY_LABELS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.day} className="grid shrink-0 grid-rows-7 gap-[3px]">
            {week.map((c) => (
              <span
                key={c.day}
                title={describe(c)}
                aria-label={describe(c)}
                role="img"
                className="block size-[14px] rounded-[3px]"
                style={
                  c.future
                    ? { background: 'transparent' }
                    : c.score === null
                      ? { boxShadow: 'inset 0 0 0 1px var(--color-line)' }
                      : { background: color, opacity: level(c.score) }
                }
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="flex items-center gap-1.5 text-xs text-faint">
        <span>Less</span>
        {LEVELS.map((o) => (
          <span key={o} className="inline-block size-3 rounded-[3px]" style={{ background: color, opacity: o }} aria-hidden="true" />
        ))}
        <span>More</span>
        <span className="ml-3 inline-block size-3 rounded-[3px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-line)' }} aria-hidden="true" />
        <span>Nothing due</span>
      </figcaption>
    </figure>
  )
}
