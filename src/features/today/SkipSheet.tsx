import type { SkipReason } from '../../model/habits'
import { Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

export const SKIP_REASONS: ReadonlyArray<{ id: SkipReason; label: string }> = [
  { id: 'sick', label: 'Sick' },
  { id: 'travel', label: 'Travel' },
  { id: 'rest', label: 'Planned rest' },
  { id: 'other', label: 'Other' },
]

export function SkipSheet({
  habitName,
  skipsLeft,
  onPick,
  onClose,
}: {
  habitName: string
  skipsLeft: number
  onPick: (reason: SkipReason) => void
  onClose: () => void
}) {
  return (
    <Sheet title={`Skip ${habitName}?`} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        A skip with a reason doesn't lower strength. {skipsLeft === 1 ? '1 skip' : `${skipsLeft} skips`} left for this habit this week.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SKIP_REASONS.map((r, i) => (
          <Button key={r.id} autoFocus={i === 0} onClick={() => onPick(r.id)}>
            {r.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
        Cancel
      </Button>
    </Sheet>
  )
}
