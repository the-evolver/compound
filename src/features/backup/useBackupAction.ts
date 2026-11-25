import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { useAuth } from '../../app/Auth'
import { backupFileName, buildBackup, markBackedUp, sealBackup } from '../../db/backup'
import { clock } from '../../domain/time/clock'
import { saveFile } from '../../platform/files'

export type BackupActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  /** The browser wants another tap before showing the share sheet. */
  | { kind: 'ready'; name: string; content: string; at: number }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

/**
 * "Back up now": builds the file, encrypts it with the account's key (only
 * the account password opens it), and saves or shares it. The backup only
 * counts once the file was actually saved, not when the share was cancelled.
 */
export function useBackupAction() {
  const { settings } = useAppData()
  const { account, key } = useAuth()
  const [state, setState] = useState<BackupActionState>({ kind: 'idle' })

  const deliver = async (name: string, content: string, at: number) => {
    const result = await saveFile(name, 'application/json', content)
    if (result === 'needs-tap') return setState({ kind: 'ready', name, content, at })
    if (result === 'cancelled') return setState({ kind: 'idle' })
    await markBackedUp(at)
    setState({ kind: 'done' })
  }

  const start = async () => {
    setState({ kind: 'working' })
    try {
      const at = clock.now()
      const file = await buildBackup(at)
      const content = sealBackup(file, { kdf: account.kdf, wrappedKey: account.wrappedKey }, key)
      await deliver(backupFileName(file, settings.timeZone), content, at)
    } catch (e) {
      console.error(e)
      setState({ kind: 'error', message: 'Could not create the backup. Please try again.' })
    }
  }

  const finish = async () => {
    if (state.kind !== 'ready') return
    try {
      await deliver(state.name, state.content, state.at)
    } catch (e) {
      console.error(e)
      setState({ kind: 'error', message: 'Could not save the file. Please try again.' })
    }
  }

  return { state, start, finish, reset: () => setState({ kind: 'idle' }) }
}
