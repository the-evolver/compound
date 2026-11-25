import { useEffect, useState } from 'react'
import { useAuth } from '../../app/Auth'
import { AccountError, changePassword, deleteAccount, isSessionRemembered, MIN_PASSWORD, rememberSession } from '../../db/accounts'
import { db } from '../../db/db'
import { inputClass, Segmented } from '../../ui/fields'
import { Button, Card, Row, Section } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const { account, refreshAccount } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setError(null)
    if (next.length < MIN_PASSWORD) return setError(`The new password needs at least ${MIN_PASSWORD} characters.`)
    if (next !== confirm) return setError("The new passwords don't match.")
    setBusy(true)
    try {
      await changePassword(account.id, current, next)
      await refreshAccount()
      setDone(true)
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Change password" onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-ok">Password changed.</p>
          <p className="text-sm text-muted">Backups made before today still open with the old password. Make a fresh backup now.</p>
          <Button className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input type="password" aria-label="Current password" placeholder="Current password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input type="password" aria-label="New password" placeholder={`New password (at least ${MIN_PASSWORD} characters)`} autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
          <input type="password" aria-label="New password again" placeholder="New password again" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-bad">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !current}>
            {busy ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      )}
    </Sheet>
  )
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { account, logout } = useAuth()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title="Delete this account?" onClose={onClose}>
      <p className="text-sm text-muted">
        The account <span className="font-semibold text-text">{account.username}</span> and all of its data are removed from this device. Only a backup file can bring them back.
      </p>
      <label className="mt-4 block text-sm">
        Type the username to confirm
        <input className={`${inputClass} mt-1`} autoCapitalize="none" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      <div className="mt-3 grid gap-2">
        <Button
          variant="danger"
          disabled={typed.trim().toLowerCase() !== account.handle || busy}
          onClick={async () => {
            setBusy(true)
            db.close()
            await deleteAccount(account.id)
            await logout()
          }}
        >
          {busy ? 'Deleting…' : 'Delete account and its data'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

export function AccountSection() {
  const { account, key, logout } = useAuth()
  const [remembered, setRemembered] = useState<boolean | null>(null)
  const [sheet, setSheet] = useState<'password' | 'delete' | null>(null)
  useEffect(() => {
    void isSessionRemembered(account.id).then(setRemembered)
  }, [account.id])

  return (
    <Section title="Account">
      <Card className="space-y-3">
        <Row label={`Signed in as ${account.username}`} hint="Your data on this device is encrypted with your password." />
        {remembered !== null && (
          <div>
            <div className="mb-1 text-sm font-medium">Keep me logged in on this device</div>
            <Segmented
              label="Keep me logged in"
              value={remembered ? 'on' : 'off'}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off: ask every time' },
              ]}
              onChange={(v) => {
                const on = v === 'on'
                void rememberSession(account.id, on ? key : null).then(() => setRemembered(on))
              }}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setSheet('password')}>Change password</Button>
          <Button onClick={() => void logout()}>Log out</Button>
        </div>
        <Button variant="ghost" className="w-full text-bad" onClick={() => setSheet('delete')}>
          Delete account…
        </Button>
      </Card>
      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteAccountSheet onClose={() => setSheet(null)} />}
    </Section>
  )
}
