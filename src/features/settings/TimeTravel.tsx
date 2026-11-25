import { useSyncExternalStore } from 'react'
import { useAppData } from '../../app/AppData'
import { clock } from '../../domain/time/clock'
import { Button, Card, Row, Section } from '../../ui/primitives'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * Development only (never in a production build): shifts the app clock to
 * test rollover, missed days, review queues and weekly reviews.
 */
export function TimeTravel() {
  const { today } = useAppData()
  const offset = useSyncExternalStore(clock.subscribe, clock.offset)
  const shift = (ms: number) => clock.setOffset(offset + ms)
  const days = offset / DAY

  return (
    <Section title="Time travel (dev only)">
      <Card>
        <Row label="App day" value={today} hint={offset === 0 ? 'Real time' : `Shifted ${days.toFixed(2)} days`} />
        <div className="mt-2 grid grid-cols-4 gap-2">
          <Button size="sm" onClick={() => shift(-DAY)}>−1 d</Button>
          <Button size="sm" onClick={() => shift(HOUR)}>+1 h</Button>
          <Button size="sm" onClick={() => shift(DAY)}>+1 d</Button>
          <Button size="sm" onClick={() => shift(7 * DAY)}>+7 d</Button>
        </div>
        <Button size="sm" variant="ghost" className="mt-2 w-full" disabled={offset === 0} onClick={() => clock.setOffset(0)}>
          Back to real time
        </Button>
      </Card>
    </Section>
  )
}
