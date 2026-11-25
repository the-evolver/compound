import { Button } from '../../ui/primitives'
import { useBackupAction } from './useBackupAction'

/** "Back up now", including the extra tap some phones ask for before sharing. */
export function BackupButton({ className, label = 'Back up now' }: { className?: string; label?: string }) {
  const { state, start, finish } = useBackupAction()

  if (state.kind === 'ready') {
    return (
      <Button variant="primary" className={className} onClick={() => void finish()}>
        Save backup file
      </Button>
    )
  }
  return (
    <div className={className}>
      <Button variant="primary" className="w-full" disabled={state.kind === 'working'} onClick={() => void start()}>
        {state.kind === 'working' ? 'Preparing…' : label}
      </Button>
      {state.kind === 'done' && <p className="mt-2 text-sm text-ok">Backup saved.</p>}
      {state.kind === 'error' && <p className="mt-2 text-sm text-bad">{state.message}</p>}
    </div>
  )
}
