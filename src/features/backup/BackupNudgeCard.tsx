import { useAppData } from '../../app/AppData'
import { describeBackup } from '../../domain/backupStatus'
import { clock } from '../../domain/time/clock'
import { DAY_MS } from '../../domain/time/day'
import { Card } from '../../ui/primitives'
import { BackupButton } from './BackupButton'
import { useBackupStatus } from './useBackupStatus'

/** Today card: shown when there has been no backup for a week (or ever, after the first day). */
export function BackupNudgeCard() {
  const { settings } = useAppData()
  const status = useBackupStatus()
  if (!status || status.kind === 'fresh') return null
  // Give a brand-new install a day before nagging.
  if (status.kind === 'never' && clock.now() - (settings.onboardedAt ?? 0) < DAY_MS) return null

  return (
    <Card className="space-y-3 border border-warn/30">
      <div>
        <div className="font-medium">{describeBackup(status)}</div>
        <p className="text-sm text-muted">Browser storage can be cleared without warning, especially on iPhone. A backup takes a few seconds.</p>
      </div>
      <BackupButton />
    </Card>
  )
}
