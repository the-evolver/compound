import { Button, Card } from '../../ui/primitives'
import { useReminders } from './useReminders'

/** Today card: offers a new calendar file when the habits behind the reminders changed. */
export function RemindersChangedCard() {
  const { status, exportIcs, message } = useReminders()
  if (!status?.stale) return null
  return (
    <Card className="space-y-3">
      <div>
        <div className="font-medium">Reminders changed</div>
        <p className="text-sm text-muted">Your habits changed since you last exported the calendar. Export a new file and replace the old Compound calendar.</p>
      </div>
      <Button className="w-full" onClick={() => void exportIcs()}>
        Export new calendar file
      </Button>
      {message && <p className="text-sm text-warn">{message}</p>}
    </Card>
  )
}
