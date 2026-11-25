import { Link } from 'react-router'
import { describeBackup } from '../../domain/backupStatus'
import { cx } from '../../ui/primitives'
import { useBackupStatus } from './useBackupStatus'

/** Header dot: green when backed up within the nudge window, amber when overdue, red when never. */
export function BackupDot() {
  const status = useBackupStatus()
  if (!status) return null
  const color = status.kind === 'fresh' ? 'bg-ok' : status.kind === 'stale' ? 'bg-warn' : 'bg-bad'
  return (
    <Link
      to="/settings?section=backup"
      aria-label={describeBackup(status)}
      title={describeBackup(status)}
      className="grid size-11 place-items-center rounded-full active:bg-surface-2"
    >
      <span className={cx('size-2.5 rounded-full', color)} />
    </Link>
  )
}
