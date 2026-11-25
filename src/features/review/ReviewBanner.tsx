import { Link, useLocation } from 'react-router'
import { describeWeek } from '../../domain/review'
import { formatDay } from '../../domain/time/day'
import { Icon } from '../../ui/icons'
import { useDueReviews } from './useDueReviews'

/** Stays at the top of every screen until the due review is finished. */
export function ReviewBanner() {
  const due = useDueReviews()
  const { pathname } = useLocation()
  if (!due || pathname.startsWith('/review')) return null
  const items = [
    due.week && { to: `/review/week/${due.week}`, text: `Weekly review · ${describeWeek(due.week)} · about 15 min` },
    due.month && { to: `/review/month/${due.month}`, text: `Monthly review · ${formatDay(`${due.month}-01`, { month: 'long' })}` },
  ].filter((x): x is { to: string; text: string } => !!x)
  if (!items.length) return null
  return (
    <div className="mb-4 space-y-2">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="flex min-h-12 items-center gap-3 rounded-2xl bg-accent/15 px-4 text-sm font-medium text-accent">
          <Icon name="review" size={20} />
          <span className="flex-1">{i.text}</span>
          <span>Start</span>
          <Icon name="chevronRight" size={18} />
        </Link>
      ))}
    </div>
  )
}
