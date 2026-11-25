import { useSearchParams } from 'react-router'
import { cx } from '../../ui/primitives'
import { ScreenHeader, SettingsLink } from '../../ui/ScreenHeader'
import { LOG_TABS } from './tabs'

export function LogsScreen() {
  const [params, setParams] = useSearchParams()
  const tabs = [...LOG_TABS].sort((a, b) => a.order - b.order)
  const active = tabs.find((t) => t.id === params.get('tab')) ?? tabs[0]!
  const { Component } = active
  return (
    <div className="space-y-5">
      <ScreenHeader title="Logs" actions={<SettingsLink />} />
      <div role="tablist" aria-label="Logs" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={cx(
              'min-h-10 shrink-0 rounded-full px-4 text-sm',
              t.id === active.id ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2 text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <Component />
      </div>
    </div>
  )
}
