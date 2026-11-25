import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './app/App'
import { requestPersistence } from './db/persist'
import { clock } from './domain/time/clock'

// Dev only: keep the time-travel offset across reloads in this tab.
if (import.meta.env.DEV) {
  const KEY = 'compound:clockOffset'
  const saved = Number(sessionStorage.getItem(KEY) ?? 0)
  if (saved) clock.setOffset(saved)
  clock.subscribe(() => sessionStorage.setItem(KEY, String(clock.offset())))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Ask the browser not to evict our data. Settings shows the result.
void requestPersistence()
