import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { db } from '../../db/db'
import { patchKv, readKv } from '../../db/repo'
import { buildIcs, icsEvents, icsFingerprint, type IcsInput } from '../../domain/ics'
import { clock } from '../../domain/time/clock'
import { saveFile } from '../../platform/files'

function useIcsInput(): IcsInput | undefined {
  const { settings, today } = useAppData()
  return useLiveQuery(
    async () => ({
      habits: await db.habits.toArray(),
      timeZone: settings.timeZone,
      planStart: settings.planStart,
      planEnd: settings.planEnd,
      reviewTime: settings.weeklyReviewTime,
      today,
    }),
    [settings, today],
  )
}

export interface ReminderStatus {
  eventCount: number
  lastExportAt?: number
  /** A file was exported before, and the reminders have changed since. */
  stale: boolean
}

export function useReminders() {
  const input = useIcsInput()
  const meta = useLiveQuery(() => readKv('ics'), [])
  const [message, setMessage] = useState<string | null>(null)

  const status: ReminderStatus | undefined =
    input && meta
      ? {
          eventCount: icsEvents(input).length,
          lastExportAt: meta.lastExportAt,
          stale: meta.scheduleHash !== undefined && meta.scheduleHash !== icsFingerprint(input),
        }
      : undefined

  const exportIcs = async () => {
    if (!input) return
    setMessage(null)
    const now = clock.now()
    const result = await saveFile('compound-reminders.ics', 'text/calendar', buildIcs(input, now))
    if (result === 'needs-tap') return setMessage('Tap again to save the calendar file.')
    if (result === 'cancelled') return
    await patchKv('ics', { lastExportAt: now, scheduleHash: icsFingerprint(input) })
  }

  return { status, exportIcs, message }
}
