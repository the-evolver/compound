import { useAppData } from '../../app/AppData'
import { describeBackupDate } from '../../db/backup'
import { Button, Card, Row, Section } from '../../ui/primitives'
import { useReminders } from './useReminders'

export function RemindersSection() {
  const { settings } = useAppData()
  const { status, exportIcs, message } = useReminders()
  if (!status) return null

  return (
    <Section title="Reminders">
      <Card className="space-y-3">
        <Row
          label="Calendar reminders"
          value={status.lastExportAt ? (status.stale ? 'Out of date' : 'Up to date') : 'Not set up'}
          hint={
            status.lastExportAt
              ? `Last exported ${describeBackupDate(status.lastExportAt, settings.timeZone)}. ${status.eventCount} repeating events.`
              : `${status.eventCount} repeating events: each habit's reminder time, plus the Sunday and monthly reviews.`
          }
        />
        {status.stale && <p className="text-sm text-warn">Your habits changed since the last file. Export a new one and replace the old calendar.</p>}
        <Button variant={status.stale || !status.lastExportAt ? 'primary' : 'secondary'} className="w-full" onClick={() => void exportIcs()}>
          Export calendar file (.ics)
        </Button>
        {message && <p className="text-sm text-warn">{message}</p>}
        <details className="text-sm text-muted">
          <summary className="min-h-10 cursor-pointer py-2 text-text">How to add it to Google Calendar</summary>
          <ol className="list-decimal space-y-1 pl-5">
            <li>On a computer, open Google Calendar → Settings → Add calendar → Create new calendar. Name it “Compound”.</li>
            <li>Settings → Import & export → Import: choose the .ics file and the “Compound” calendar.</li>
            <li>Under the Compound calendar’s settings, set the default notification to “at time of event”.</li>
            <li>When habits change, delete the Compound calendar and repeat with the new file, so events never double up.</li>
          </ol>
        </details>
      </Card>
    </Section>
  )
}
