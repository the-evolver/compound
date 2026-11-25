import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { reviewProblem } from '../../db/actions/career'
import type { DsaProblem, ReviewRating } from '../../model/career'
import { Badge, Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'

const RATINGS: ReadonlyArray<{ value: ReviewRating; label: string; hint: string }> = [
  { value: 'easy', label: 'Easy', hint: 'Skips the next interval' },
  { value: 'ok', label: 'OK', hint: 'Next interval' },
  { value: 'failed', label: 'Failed', hint: 'Back to tomorrow' },
]

/** A review is a re-solve from scratch, then a rating. */
export function ReviewSheet({ problem, onClose }: { problem: DsaProblem; onClose: () => void }) {
  const { today } = useAppData()
  const [showInsight, setShowInsight] = useState(false)
  const [minutes, setMinutes] = useState<number | undefined>()
  return (
    <Sheet title={problem.title} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{problem.difficulty}</Badge>
        {problem.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">Re-solve it from scratch without looking at your old code, then rate how it went.</p>
      {problem.link && (
        <a href={problem.link} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-sm text-accent underline">
          Open the problem
        </a>
      )}
      {problem.insight &&
        (showInsight ? (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{problem.insight}</p>
        ) : (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowInsight(true)}>
            Show my key insight (after trying)
          </Button>
        ))}
      <div className="mt-3">
        <Stepper label="Minutes" size="sm" value={minutes} start={20} step={5} min={1} max={240} unit="min" onChange={setMinutes} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {RATINGS.map((r) => (
          <Button
            key={r.value}
            variant={r.value === 'failed' ? 'outline' : r.value === 'ok' ? 'primary' : 'secondary'}
            className="flex-col gap-0 py-2"
            onClick={() => void reviewProblem(problem.id, r.value, today, minutes).then(onClose)}
          >
            <span>{r.label}</span>
            <span className="text-[11px] font-normal opacity-80">{r.hint}</span>
          </Button>
        ))}
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
        Not now
      </Button>
    </Sheet>
  )
}
