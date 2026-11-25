import { useLiveQuery } from 'dexie-react-hooks'
import { useAppData } from '../../app/AppData'
import { readKv } from '../../db/repo'
import { backupState, type BackupState } from '../../domain/backupStatus'
import { clock } from '../../domain/time/clock'

/** How old the last backup is. Re-evaluated when the day changes or a backup is made. */
export function useBackupStatus(): BackupState | undefined {
  const { settings, today } = useAppData()
  return useLiveQuery(
    async () => backupState((await readKv('backup')).lastExportAt, clock.now(), settings.backupNudgeDays),
    [today, settings.backupNudgeDays],
  )
}
