import { useState } from 'react'
import { resetAll } from '../../db/backup'
import { BackupButton } from '../backup/BackupButton'
import { inputClass } from '../../ui/fields'
import { Button, Card, Section } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

const WORD = 'RESET'

export function ResetSection() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setOpen(false)
    setTyped('')
  }

  return (
    <Section title="Danger zone">
      <Card>
        <Button variant="danger" className="w-full" onClick={() => setOpen(true)}>
          Erase this account's data…
        </Button>
        <p className="mt-2 text-sm text-muted">Removes everything in this account and starts again from setup. The account and its password stay.</p>
      </Card>
      {open && (
        <Sheet title="Erase this account's data?" onClose={close}>
          <p className="text-sm text-muted">
            Every habit, log, review and setting in this account is deleted. It can't be undone unless you have a backup file.
          </p>
          <BackupButton className="mt-3" label="Back up first" />
          <label className="mt-4 block text-sm">
            Type <span className="font-mono font-semibold">{WORD}</span> to confirm
            <input
              className={`${inputClass} mt-1 font-mono`}
              value={typed}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          <div className="mt-3 grid gap-2">
            <Button
              variant="danger"
              disabled={typed !== WORD || busy}
              onClick={async () => {
                setBusy(true)
                await resetAll()
                // The app returns to onboarding by itself once settings are gone.
              }}
            >
              {busy ? 'Deleting…' : 'Delete everything'}
            </Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </Sheet>
      )}
    </Section>
  )
}
