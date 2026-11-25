import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { buildCsv, CSV_EXPORTS, type CsvExport } from '../../db/csvExports'
import { describeBackup } from '../../domain/backupStatus'
import { saveFile } from '../../platform/files'
import { Icon } from '../../ui/icons'
import { Button, Card, Row, Section } from '../../ui/primitives'
import { BackupButton } from './BackupButton'
import { RestoreButton } from './RestoreButton'
import { useBackupStatus } from './useBackupStatus'

function CsvList() {
  const { today } = useAppData()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const available = useLiveQuery(async () => {
    const counts = await Promise.all(CSV_EXPORTS.map((e) => e.count()))
    return CSV_EXPORTS.map((e, i) => ({ exp: e, count: counts[i]! })).filter((x) => x.count > 0)
  }, [])

  const exportOne = async (exp: CsvExport) => {
    setMessage(null)
    const result = await saveFile(`compound-${exp.id}-${today}.csv`, 'text/csv', await buildCsv(exp))
    if (result === 'needs-tap') setMessage('Tap the log again to save the file.')
  }

  return (
    <div className="border-t border-line pt-2">
      <button type="button" className="flex min-h-12 w-full items-center justify-between text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>Export a log as CSV</span>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} className="text-faint" />
      </button>
      {open &&
        (available && available.length > 0 ? (
          <div className="space-y-2 pb-2">
            {available.map(({ exp, count }) => (
              <Button key={exp.id} variant="outline" className="w-full justify-between" onClick={() => void exportOne(exp)}>
                <span>{exp.label}</span>
                <span className="text-sm text-faint">{count}</span>
              </Button>
            ))}
            <p className="text-xs text-faint">Logs appear here once they have entries.</p>
            {message && <p className="text-sm text-warn">{message}</p>}
          </div>
        ) : (
          <p className="pb-2 text-sm text-muted">Nothing logged yet.</p>
        ))}
    </div>
  )
}

export function BackupSection() {
  const status = useBackupStatus()
  if (!status) return null
  return (
    <Section title="Backup">
      <Card className="space-y-3">
        <Row
          label={describeBackup(status)}
          hint="Everything lives only in this browser, which can clear it (especially on iPhone). Save a backup at least weekly, somewhere off the phone, such as Google Drive."
        />
        <BackupButton />
        <RestoreButton hasData />
        <CsvList />
      </Card>
    </Section>
  )
}
