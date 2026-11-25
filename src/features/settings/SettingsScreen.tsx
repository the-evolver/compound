import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { version } from '../../../package.json'
import { Section } from '../../ui/primitives'
import { ScreenHeader } from '../../ui/ScreenHeader'
import { BackupSection } from '../backup/BackupSection'
import { RemindersSection } from '../reminders/RemindersSection'
import { DaySection, DisplaySection, HabitRulesSection, PlanSection, ProfileSection } from './GeneralSections'
import { ResetSection } from './ResetSection'
import { AccountSection } from './AccountSection'
import { StorageCard } from './StorageCard'
import { TimeTravel } from './TimeTravel'

export function SettingsScreen() {
  const [params] = useSearchParams()
  const section = params.get('section')

  // Jump to a section (e.g. from the backup dot) once it has rendered its content.
  useEffect(() => {
    if (!section) return
    let frame = 0
    let tries = 0
    const tick = () => {
      const el = document.getElementById(`settings-${section}`)
      if (el && el.childElementCount > 0) {
        el.scrollIntoView({ block: 'start' })
        return
      }
      if (++tries < 60) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [section])

  return (
    <div className="space-y-6">
      <ScreenHeader title="Settings" back="/" />

      <div id="settings-account" className="scroll-mt-4">
        <AccountSection />
      </div>

      <div id="settings-backup" className="scroll-mt-4">
        <BackupSection />
      </div>
      <div id="settings-reminders" className="scroll-mt-4">
        <RemindersSection />
      </div>
      <PlanSection />
      <DaySection />
      <HabitRulesSection />
      <ProfileSection />
      <DisplaySection />
      <Section title="Storage">
        <StorageCard />
      </Section>
      <ResetSection />

      {import.meta.env.DEV && <TimeTravel />}

      <p className="px-1 text-center text-xs text-faint">Compound {version} · all data stays on this device</p>
    </div>
  )
}
