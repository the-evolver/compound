import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Icon } from '../ui/icons'
import { cx } from '../ui/primitives'
import { NAV_TABS } from './screens'
import { ReviewBanner } from '../features/review/ReviewBanner'

function BottomNav() {
  // A single tab is not navigation; show the bar once there are two.
  if (NAV_TABS.length < 2) return null
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${NAV_TABS.length}, minmax(0, 1fr))` }}>
        {NAV_TABS.map((tab) => (
          <li key={tab.path}>
            <NavLink
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) =>
                cx(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs',
                  isActive ? 'text-accent' : 'text-faint',
                )
              }
            >
              <Icon name={tab.nav.icon} />
              {tab.nav.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  // A new screen starts at the top, not at the previous screen's scroll position.
  // Block body on purpose: scrollTo() returns a Promise in newer browsers,
  // and an effect must not return anything but a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <ReviewBanner />
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
