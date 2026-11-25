import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/primitives'

const HOUR_MS = 3_600_000

/**
 * Tells the user when the app is ready offline, and when a new version is
 * waiting. Updates apply only when they tap Reload, so nothing half-entered
 * is lost.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), HOUR_MS)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 px-4" role="status">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 shadow-lg">
        <p className="flex-1 text-sm">{needRefresh ? 'A new version is ready.' : 'Ready to work offline.'}</p>
        {needRefresh && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
            <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
              Reload
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
