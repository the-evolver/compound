import { useEffect, useState } from 'react'
import { requestPersistence, storagePersistState, type PersistState } from '../../db/persist'
import { Button, Card, Row } from '../../ui/primitives'

const LABELS: Record<PersistState, { value: string; hint: string }> = {
  persisted: {
    value: 'Protected',
    hint: 'The browser has agreed not to clear this app’s data. Keep backing up anyway.',
  },
  'not-persisted': {
    value: 'Not protected',
    hint: 'The browser may clear data when the phone runs low on space. Installing the app to the home screen usually fixes this.',
  },
  unsupported: {
    value: 'No guarantee',
    hint: 'This browser can clear stored data (common on iPhone). Regular backups are your safety net.',
  },
}

export function StorageCard() {
  const [state, setState] = useState<PersistState | null>(null)

  useEffect(() => {
    void storagePersistState().then(setState)
  }, [])

  if (!state) return null
  const label = LABELS[state]

  return (
    <Card>
      <Row label="Data on this device" value={label.value} hint={label.hint} />
      {state === 'not-persisted' && (
        <Button className="mt-2 w-full" onClick={() => void requestPersistence().then(setState)}>
          Ask the browser to protect it
        </Button>
      )}
    </Card>
  )
}
