import { useSearchParams } from 'react-router'
import { Segmented } from '../../ui/fields'
import { ScreenHeader, SettingsLink } from '../../ui/ScreenHeader'
import { HabitsTab } from './HabitsTab'
import { StudyTab } from './StudyTab'
import { TimelineTab } from './TimelineTab'

const TABS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'study', label: 'Study' },
  { value: 'habits', label: 'Habits' },
] as const

type Tab = (typeof TABS)[number]['value']

export function PlanScreen() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.value === params.get('tab')) ? (params.get('tab') as Tab) : 'timeline'
  return (
    <div className="space-y-5">
      <ScreenHeader title="Plan" actions={<SettingsLink />} />
      <Segmented label="Plan section" value={tab} options={TABS} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'timeline' && <TimelineTab />}
      {tab === 'study' && <StudyTab />}
      {tab === 'habits' && <HabitsTab />}
    </div>
  )
}
