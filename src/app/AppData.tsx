import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { readKv } from '../db/repo'
import type { Settings } from '../model/core'
import { clock } from '../domain/time/clock'
import type { DayKey } from '../domain/time/day'
import { logicalDay } from '../domain/time/zone'

export interface AppData {
  settings: Settings
  /** The current logical day (respects timezone and rollover hour). */
  today: DayKey
}

const AppDataContext = createContext<AppData | null>(null)

function subscribeToTime(onChange: () => void): () => void {
  const timer = setInterval(onChange, 30_000)
  const offClock = clock.subscribe(onChange)
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onChange)
  return () => {
    clearInterval(timer)
    offClock()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onChange)
  }
}

/** Re-renders when the logical day changes (rollover, returning to the app, time travel). */
function useLogicalDay(timeZone: string, rolloverHour: number): DayKey {
  return useSyncExternalStore(subscribeToTime, () => logicalDay(clock.now(), timeZone, rolloverHour))
}

function Provider({ settings, children }: { settings: Settings; children: ReactNode }) {
  const today = useLogicalDay(settings.timeZone, settings.rolloverHour)
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])
  return <AppDataContext.Provider value={{ settings, today }}>{children}</AppDataContext.Provider>
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => readKv('settings'), [])
  // The settings read takes a few milliseconds; render nothing until then
  // rather than flash defaults.
  if (!settings) return null
  return <Provider settings={settings}>{children}</Provider>
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider')
  return ctx
}
