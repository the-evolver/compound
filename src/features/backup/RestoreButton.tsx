import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { describeBackupDate, isSealedBackup, openSealedBackup, parseBackup, restoreBackup, type ParsedBackup } from '../../db/backup'
import { inputClass } from '../../ui/fields'
import { pickTextFile } from '../../platform/files'
import { Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

type Ready = Extract<ParsedBackup, { ok: true }>

const TABLE_LABELS: Record<string, [one: string, many: string]> = {
  habits: ['habit', 'habits'],
  habitLogs: ['habit check-in', 'habit check-ins'],
  dayEntries: ['day of numbers and notes', 'days of numbers and notes'],
  dsaProblems: ['DSA problem', 'DSA problems'],
  dsaReviews: ['DSA review', 'DSA reviews'],
  workoutSessions: ['workout', 'workouts'],
  mocks: ['mock', 'mocks'],
  applications: ['application', 'applications'],
  drills: ['drill', 'drills'],
  weeklyReviews: ['weekly review', 'weekly reviews'],
}

/**
 * Restore from a backup file: pick, check every record, show what's in it,
 * then replace everything only after an explicit confirmation.
 */
export function RestoreButton({ className, variant = 'secondary', hasData }: { className?: string; variant?: 'secondary' | 'outline'; hasData: boolean }) {
  const { settings } = useAppData()
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  // An encrypted backup waiting for its password.
  const [locked, setLocked] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const check = (text: string) => {
    const parsed = parseBackup(text)
    if (!parsed.ok) return setError(parsed.error)
    setReady(parsed)
  }

  const pick = async () => {
    setError(null)
    setDone(false)
    const file = await pickTextFile('application/json,.json')
    if (!file) return
    if (isSealedBackup(file.text)) {
      setPassword('')
      setLocked(file.text)
      return
    }
    check(file.text)
  }

  const unlock = async () => {
    if (!locked) return
    setUnlocking(true)
    setError(null)
    try {
      const plain = await openSealedBackup(locked, password)
      setLocked(null)
      check(plain)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this backup.')
    } finally {
      setUnlocking(false)
    }
  }

  const confirm = async () => {
    if (!ready) return
    setBusy(true)
    try {
      await restoreBackup(ready.rows)
      setReady(null)
      setDone(true)
    } catch (e) {
      console.error(e)
      setError('Restoring failed; your data was not changed.')
    } finally {
      setBusy(false)
    }
  }

  const highlights = ready?.counts.flatMap((c) => {
    const label = TABLE_LABELS[c.table]
    return label ? [`${c.count} ${c.count === 1 ? label[0] : label[1]}`] : []
  })

  return (
    <div className={className}>
      <Button variant={variant} className="w-full" onClick={() => void pick()}>
        Restore from a backup file
      </Button>
      {error && !locked && <p className="mt-2 text-sm text-bad">{error}</p>}
      {done && <p className="mt-2 text-sm text-ok">Restored.</p>}
      {locked && (
        <Sheet title="Encrypted backup" onClose={() => setLocked(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void unlock()
            }}
          >
            <p className="text-sm text-muted">Enter the password of the account this backup came from (the password it had when the backup was made).</p>
            <input
              type="password"
              aria-label="Backup password"
              autoComplete="current-password"
              className={`${inputClass} mt-3`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
            <div className="mt-3 grid gap-2">
              <Button type="submit" variant="primary" disabled={!password || unlocking}>
                {unlocking ? 'Unlocking…' : 'Unlock backup'}
              </Button>
              <Button variant="ghost" onClick={() => setLocked(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Sheet>
      )}
      {ready && (
        <Sheet title="Restore this backup?" onClose={() => setReady(null)}>
          <p className="text-sm text-muted">Backup from {describeBackupDate(ready.exportedAt, settings.timeZone)}.</p>
          {highlights && highlights.length > 0 && <p className="mt-1 text-sm text-muted">Contains {highlights.join(', ')}.</p>}
          {hasData && (
            <p className="mt-3 text-sm text-warn">
              This replaces everything currently on this device. Back up first if you might need today's data.
            </p>
          )}
          <div className="mt-4 grid gap-2">
            <Button variant={hasData ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>
              {busy ? 'Restoring…' : hasData ? 'Replace all data with this backup' : 'Restore'}
            </Button>
            <Button variant="ghost" onClick={() => setReady(null)}>
              Cancel
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
