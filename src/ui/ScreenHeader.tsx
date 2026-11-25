import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from './icons'

export function ScreenHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** Show a back button that returns to the previous screen (or this path). */
  back?: string
  actions?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="flex items-start gap-2 pb-4">
      {back !== undefined && (
        <button
          type="button"
          aria-label="Back"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-surface-2"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(back))}
        >
          <Icon name="back" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold leading-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}

export function SettingsLink() {
  return (
    <Link
      to="/settings"
      aria-label="Settings"
      className="grid size-11 place-items-center rounded-full text-muted active:bg-surface-2"
    >
      <Icon name="settings" />
    </Link>
  )
}
