import { useEffect, useState } from 'react'
import { AccountError, listAccounts, MIN_PASSWORD, validateNewAccount } from '../../db/accounts'
import { inputClass, Segmented } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Button } from '../../ui/primitives'

type Mode = 'login' | 'signup'

export function AccountScreen({
  legacy,
  onLogin,
  onSignup,
}: {
  legacy: boolean
  onLogin: (username: string, password: string, remember: boolean) => Promise<void>
  onSignup: (username: string, password: string, remember: boolean) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listAccounts().then((accounts) => setMode(accounts.length && !legacy ? 'login' : 'signup'))
  }, [legacy])
  if (!mode) return null

  const submit = async () => {
    setError(null)
    if (mode === 'signup') {
      const problem = validateNewAccount(username, password, confirm)
      if (problem) return setError(problem)
    } else if (!username.trim() || !password) {
      return setError('Enter your username and password.')
    }
    setBusy(true)
    try {
      await (mode === 'login' ? onLogin : onSignup)(username, password, remember)
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Something went wrong. Please try again.')
      console.error(e)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="space-y-2 text-center">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto size-16" />
        <h1 className="text-2xl font-semibold">Compound</h1>
        <p className="text-sm text-muted">A calm, honest daily tracker. Your plan stays on this device, encrypted with your password.</p>
      </header>

      {legacy && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          This device has a plan from before accounts. Create an account and it moves in, encrypted with your new password.
        </div>
      )}

      <Segmented
        label="Account"
        value={mode}
        options={[
          { value: 'login', label: 'Log in' },
          { value: 'signup', label: 'Create account' },
        ]}
        onChange={(m) => {
          setMode(m)
          setError(null)
        }}
      />

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="block text-sm">
          <span className="text-muted">Username</span>
          <input
            className={`${inputClass} mt-1`}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password{mode === 'signup' ? ` (at least ${MIN_PASSWORD} characters)` : ''}</span>
          <input
            type="password"
            className={`${inputClass} mt-1`}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'signup' && (
          <label className="block text-sm">
            <span className="text-muted">Password again</span>
            <input type="password" className={`${inputClass} mt-1`} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        )}
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>
            Keep me logged in on this device
            <span className="block text-faint">Anyone who can unlock this phone could then open your plan. Turn off on shared devices.</span>
          </span>
        </label>
        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? (mode === 'login' ? 'Unlocking…' : 'Creating…') : mode === 'login' ? 'Log in' : 'Create account'}
        </Button>
      </form>

      <p className="flex items-start gap-2 text-xs text-faint">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
        <span>
          There is no password reset: your password is the only key to your data, and nothing is sent anywhere. Keep backups, and remember the
          password.
        </span>
      </p>
    </div>
  )
}
