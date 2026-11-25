import { useLiveQuery } from 'dexie-react-hooks'
import { useAppData } from '../../app/AppData'
import { db } from '../../db/db'
import { planPosition, spanOn, type PlanPosition } from '../../domain/plan'
import { formatDay } from '../../domain/time/day'
import { ScreenHeader, SettingsLink } from '../../ui/ScreenHeader'
import { BackupDot } from '../backup/BackupDot'

function describePosition(pos: PlanPosition): string {
  switch (pos.kind) {
    case 'before':
      return pos.daysUntilStart === 1 ? 'Plan starts tomorrow' : `Plan starts in ${pos.daysUntilStart} days`
    case 'during':
      return `Day ${pos.dayNumber} of ${pos.totalDays}`
    case 'after':
      return pos.daysSinceEnd === 1 ? 'Plan ended yesterday' : `Plan ended ${pos.daysSinceEnd} days ago`
  }
}

export function TodayHeader() {
  const { settings, today } = useAppData()
  const phases = useLiveQuery(() => db.phases.orderBy('start').toArray(), [])
  const phase = phases ? spanOn(today, phases) : undefined
  const pos = planPosition(today, settings.planStart, settings.planEnd)

  return (
    <ScreenHeader
      title={formatDay(today, { weekday: 'long', day: 'numeric', month: 'long' })}
      subtitle={
        <span>
          {describePosition(pos)}
          {phase && <span className="text-faint"> · {phase.name}</span>}
        </span>
      }
      actions={
        <>
          <BackupDot />
          <SettingsLink />
        </>
      }
    />
  )
}
