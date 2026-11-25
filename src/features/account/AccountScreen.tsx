import { useEffect, useState } from 'react'
import { AccountError, listAccounts, MIN_PASSWORD, validateNewAccount } from '../../db/accounts'
import { inputClass, Segmented } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Button } from '../../ui/primitives'

type Mode = 'login' | 'signup' | 'recover'

const LABEL: Record<Mode, string> = { login: 'Log in', signup: 'Create account', recover: 'Reset password and log in' }
const BUSY_LABEL: Record<Mode, string> = { login: 'Unlocking…', signup: 'Creating…', recover: 'Resetting…' }

export function AccountScreen({
  legacy,
  onLogin,
  onSignup,
  onRecover,
}: {
  legacy: boolean
  onLogin: (username: string, password: string, remember: boolean) => Promise<void>
  onSignup: (username: string, password: string, remember: boolean) => Promise<void>
  onRecover: (username: string, code: string, newPassword: string, remember: boolean) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listAccounts().then((accounts) => setMode(accounts.length && !legacy ? 'login' : 'signup'))
  }, [legacy])
  if (!mode) return null

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  const submit = async () => {
    setError(null)
    if (mode === 'signup') {
      const problem = validateNewAccount(username, password, confirm)
      if (problem) return setError(problem)
    } else if (mode === 'recover') {
      if (!username.trim() || !code.trim()) return setError('Enter your username and recovery code.')
      if (password.length < MIN_PASSWORD) return setError(`New password: at least ${MIN_PASSWORD} characters.`)
      if (password !== confirm) return setError("The new passwords don't match.")
    } else if (!username.trim() || !password) {
      return setError('Enter your username and password.')
    }
    setBusy(true)
    try {
      if (mode === 'recover') await onRecover(username, code, password, remember)
      else await (mode === 'login' ? onLogin : onSignup)(username, password, remember)
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

      {mode === 'recover' ? (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Reset your password</h2>
          <p className="text-sm text-muted">Use the recovery code you saved when you created the account. Your data stays as it is.</p>
        </div>
      ) : (
        <Segmented
          label="Account"
          value={mode}
          options={[
            { value: 'login', label: 'Log in' },
            { value: 'signup', label: 'Create account' },
          ]}
          onChange={switchTo}
        />
      )}

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
        {mode === 'recover' && (
          <label className="block text-sm">
            <span className="text-muted">Recovery code</span>
            <input
              className={`${inputClass} mt-1 font-mono uppercase`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-muted">
            {mode === 'recover' ? 'New password' : 'Password'}
            {mode !== 'login' ? ` (at least ${MIN_PASSWORD} characters)` : ''}
          </span>
          <input
            type="password"
            className={`${inputClass} mt-1`}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode !== 'login' && (
          <label className="block text-sm">
            <span className="text-muted">{mode === 'recover' ? 'New password again' : 'Password again'}</span>
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
          {busy ? BUSY_LABEL[mode] : LABEL[mode]}
        </Button>
        {mode === 'login' && (
          <Button variant="ghost" className="w-full" onClick={() => switchTo('recover')}>
            Forgot password?
          </Button>
        )}
        {mode === 'recover' && (
          <Button variant="ghost" className="w-full" onClick={() => switchTo('login')}>
            Back to log in
          </Button>
        )}
      </form>

      <p className="flex items-start gap-2 text-xs text-faint">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
        <span>
          Nothing is sent anywhere: your password, or the recovery code you get when you create the account, is the only key to your data. No one
          else can reset it. Keep backups.
        </span>
      </p>
    </div>
  )
}
