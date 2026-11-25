import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createAccount,
  forgetSession,
  getAccount,
  hasLegacyData,
  migrateLegacyInto,
  openAccountDb,
  recoverAccount,
  rememberSession,
  restoreSession,
  unlockAccount,
  type Account,
} from '../db/accounts'
import { db, hasCurrentDb, setCurrentDb } from '../db/db'
import { AccountScreen } from '../features/account/AccountScreen'
import { RecoveryCodeScreen } from '../features/account/RecoveryCode'

interface AuthValue {
  account: Account
  /** The account's data key (in memory only, unless "keep me logged in"). */
  key: Uint8Array
  logout: () => Promise<void>
  refreshAccount: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

type State =
  | { status: 'loading' }
  | { status: 'locked'; legacy: boolean }
  /** Just created: the recovery code is shown once before the app opens. */
  | { status: 'new'; account: Account; key: Uint8Array; code: string; remember: boolean }
  | { status: 'open'; account: Account; key: Uint8Array }

/**
 * Nothing of the app renders until an account is unlocked. Each account's
 * data is in its own database, encrypted with a key that only its password
 * (or a remembered login on this device) can unlock.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const open = useCallback((account: Account, key: Uint8Array) => {
    setCurrentDb(openAccountDb(account, key))
    setState({ status: 'open', account, key })
  }, [])

  useEffect(() => {
    void (async () => {
      const remembered = await restoreSession()
      if (remembered) open(remembered.account, remembered.key)
      else setState({ status: 'locked', legacy: await hasLegacyData() })
    })()
  }, [open])

  /** A new session starts on Today, not wherever the previous person left off. */
  const goHome = () => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)

  const login = async (username: string, password: string, remember: boolean) => {
    const { account, key } = await unlockAccount(username, password)
    await rememberSession(account.id, remember ? key : null)
    goHome()
    open(account, key)
  }

  const signup = async (username: string, password: string, remember: boolean) => {
    const { account, key, recoveryCode } = await createAccount(username, password)
    // Data from before accounts moves into the first account, encrypted.
    if (state.status === 'locked' && state.legacy) await migrateLegacyInto(openAccountDb(account, key))
    setState({ status: 'new', account, key, code: recoveryCode, remember })
  }

  /** After the recovery code was saved. The login is remembered only now, so a reload before this asks for the password. */
  const finishSignup = async () => {
    if (state.status !== 'new') return
    await rememberSession(state.account.id, state.remember ? state.key : null)
    goHome()
    open(state.account, state.key)
  }

  const recover = async (username: string, code: string, newPassword: string, remember: boolean) => {
    const { account, key } = await recoverAccount(username, code, newPassword)
    await rememberSession(account.id, remember ? key : null)
    goHome()
    open(account, key)
  }

  const logout = async () => {
    await forgetSession()
    if (hasCurrentDb()) db.close()
    setCurrentDb(null)
    goHome()
    setState({ status: 'locked', legacy: false })
  }

  const refreshAccount = async () => {
    if (state.status !== 'open') return
    const account = await getAccount(state.account.id)
    if (account) setState({ ...state, account })
  }

  if (state.status === 'loading') return null
  if (state.status === 'locked') return <AccountScreen legacy={state.legacy} onLogin={login} onSignup={signup} onRecover={recover} />
  if (state.status === 'new') return <RecoveryCodeScreen code={state.code} username={state.account.username} onDone={() => void finishSignup()} />
  return (
    <AuthContext.Provider value={{ account: state.account, key: state.key, logout, refreshAccount }}>
      {/* Remount everything when the account changes, so no data carries over. */}
      <div key={state.account.id}>{children}</div>
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthGate')
  return ctx
}
