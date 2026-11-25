import { describeBackup } from '../../domain/backupStatus'
import { Icon } from '../../ui/icons'
import { Card } from '../../ui/primitives'
import { BackupButton } from './BackupButton'
import { useBackupStatus } from './useBackupStatus'

/** The weekly review's last step: one tap to keep a copy of the week off this phone. */
export function ReviewBackupCard() {
  const status = useBackupStatus()
  if (!status) return null
  const doneToday = status.kind === 'fresh' && status.days === 0

  return (
    <Card className="space-y-3">
      <div>
        <div className="font-medium">Last step: back up</div>
        <p className="text-sm text-muted">
          {doneToday ? (
            <span className="inline-flex items-center gap-1 text-ok">
              <Icon name="check" size={16} /> Backed up today.
            </span>
          ) : (
            `${describeBackup(status)}. Save the encrypted file somewhere off this phone, like Drive or Files.`
          )}
        </p>
      </div>
      {!doneToday && <BackupButton />}
    </Card>
  )
}
