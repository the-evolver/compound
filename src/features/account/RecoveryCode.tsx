import { useState } from 'react'
import { saveFile } from '../../platform/files'
import { Button } from '../../ui/primitives'

/** The recovery code, large and easy to copy, with ways to keep it off this phone. */
export function RecoveryCodeDisplay({ code, username }: { code: string; username: string }) {
  const [copied, setCopied] = useState(false)
  const [save, setSave] = useState<'idle' | 'again' | 'saved'>('idle')

  const saveAsFile = async () => {
    const text = `Compound recovery code\nAccount: ${username}\n\n${code}\n\nIf you forget your password: Log in → Forgot password? → enter this code.\n`
    const result = await saveFile(`compound-recovery-${username}.txt`, 'text/plain', text)
    setSave(result === 'needs-tap' ? 'again' : result === 'cancelled' ? 'idle' : 'saved')
  }

  return (
    <div className="space-y-3">
      <p
        data-testid="recovery-code"
        aria-label="Recovery code"
        className="select-all rounded-2xl bg-surface-2 px-3 py-4 text-center font-mono text-lg font-semibold tracking-wider break-all"
      >
        {code}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={() => void saveAsFile()}>{save === 'again' ? 'Tap again to save' : save === 'saved' ? 'Saved' : 'Save as a file'}</Button>
      </div>
    </div>
  )
}

/** Shown once, right after an account is created. */
export function RecoveryCodeScreen({ code, username, onDone }: { code: string; username: string; onDone: () => void }) {
  const [kept, setKept] = useState(false)
  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Save your recovery code</h1>
        <p className="text-sm text-muted">
          If you forget your password, this code is the only other way into your data. Keep it somewhere other than this phone: a password manager,
          a note on paper, or a file in your Drive. It's shown only now.
        </p>
      </header>
      <RecoveryCodeDisplay code={code} username={username} />
      <label className="flex min-h-12 items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" checked={kept} onChange={(e) => setKept(e.target.checked)} />
        <span>I've saved my recovery code somewhere safe</span>
      </label>
      <Button variant="primary" className="w-full" disabled={!kept} onClick={onDone}>
        Continue
      </Button>
      <p className="text-xs text-faint">Lost it later? Settings → Account → Make a new recovery code (needs your password).</p>
    </div>
  )
}
