import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { AppDataProvider, useAppData } from './AppData'
import { AuthGate } from './Auth'
import { Layout } from './Layout'
import { SCREENS } from './screens'
import { UpdatePrompt } from './UpdatePrompt'
import { ErrorBoundary } from './ErrorBoundary'

function Routed() {
  const { settings } = useAppData()
  if (!settings.onboardedAt) return <OnboardingScreen />
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {SCREENS.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export function App() {
  return (
    <>
      {/* Registered before login, so the app works offline from the first visit. */}
      <UpdatePrompt />
      <ErrorBoundary>
        <AuthGate>
          <AppDataProvider>
            <Routed />
          </AppDataProvider>
        </AuthGate>
      </ErrorBoundary>
    </>
  )
}
