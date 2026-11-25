import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { deleteCheckpoint, deletePhase, saveCheckpoint, savePhase } from '../../db/actions/plan'
import { db } from '../../db/db'
import { addDays, daysBetween, formatDay, isDayKey, monthOf, type DayKey } from '../../domain/time/day'
import type { Area, Checkpoint, CheckpointResult, Phase } from '../../model/core'
import { Field, inputClass, Segmented, Select, textareaClass } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

const short = (d: DayKey) => formatDay(d, { day: 'numeric', month: 'short' })

function PhaseCard({ phase, today, onEdit }: { phase: Phase; today: DayKey; onEdit: () => void }) {
  const total = daysBetween(phase.start, phase.end) + 1
  const done = Math.min(total, Math.max(0, daysBetween(phase.start, today) + 1))
  const current = today >= phase.start && today <= phase.end
  return (
    <button type="button" onClick={onEdit} className="block w-full rounded-2xl bg-surface p-4 text-left">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{phase.name}</h3>
        {current && <Badge tone="accent">Now</Badge>}
        {today > phase.end && <Badge>Done</Badge>}
        <span className="flex-1" />
        <span className="text-sm text-muted">
          {short(phase.start)} – {short(phase.end)}
        </span>
      </div>
      {phase.goal && <p className="mt-1 text-sm text-muted">{phase.goal}</p>}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label={`${done} of ${total} days`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </button>
  )
}

function PhaseSheet({ phase, defaultStart, defaultEnd, onClose }: { phase?: Phase; defaultStart: DayKey; defaultEnd: DayKey; onClose: () => void }) {
  const [name, setName] = useState(phase?.name ?? '')
  const [start, setStart] = useState(phase?.start ?? defaultStart)
  const [end, setEnd] = useState(phase?.end ?? defaultEnd)
  const [goal, setGoal] = useState(phase?.goal ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const valid = name.trim() && isDayKey(start) && isDayKey(end) && start <= end
  return (
    <Sheet title={phase ? 'Edit phase' : 'New phase'} onClose={onClose}>
      <div className="max-h-[70dvh] space-y-1 overflow-y-auto">
        <Field label="Name">{(id) => <input id={id} className={inputClass} value={name} placeholder="e.g. Foundation" onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts">{(id) => <input id={id} type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Ends">{(id) => <input id={id} type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </div>
        <Field label="Goal">{(id) => <textarea id={id} className={textareaClass} value={goal} onChange={(e) => setGoal(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!valid} onClick={() => void savePhase({ id: phase?.id, order: phase?.order, name: name.trim(), start, end, goal: goal.trim() }).then(onClose)}>
          {phase ? 'Save' : 'Add phase'}
        </Button>
        {phase &&
          (confirmDelete ? (
            <Button variant="danger" onClick={() => void deletePhase(phase.id).then(onClose)}>
              Delete {phase.name}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete phase…
            </Button>
          ))}
      </div>
    </Sheet>
  )
}

const RESULT_OPTIONS: ReadonlyArray<{ value: CheckpointResult; label: string }> = [
  { value: 'pending', label: 'Not yet' },
  { value: 'pass', label: 'Passed' },
  { value: 'fail', label: 'Missed' },
]

function CheckpointSheet({ checkpoint, areas, defaultDay, onClose }: { checkpoint?: Checkpoint; areas: Area[]; defaultDay: DayKey; onClose: () => void }) {
  const [title, setTitle] = useState(checkpoint?.title ?? '')
  const [day, setDay] = useState(checkpoint?.day ?? defaultDay)
  const [areaId, setAreaId] = useState(checkpoint?.areaId ?? areas[0]?.id ?? '')
  const [result, setResult] = useState<CheckpointResult>(checkpoint?.result ?? 'pending')
  const [notes, setNotes] = useState(checkpoint?.notes ?? '')
  const valid = title.trim() && isDayKey(day) && areaId

  const save = async () => {
    await saveCheckpoint({ id: checkpoint?.id, title: title.trim(), day, areaId, notes: notes.trim(), result })
    onClose()
  }

  return (
    <Sheet title={checkpoint ? 'Checkpoint' : 'New checkpoint'} onClose={onClose}>
      <div className="max-h-[70dvh] space-y-1 overflow-y-auto">
        <Field label="Test">{(id) => <textarea id={id} className={textareaClass} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">{(id) => <input id={id} type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />}</Field>
          <Field label="Area">{(id) => <Select id={id} value={areaId} options={areas.map((a) => ({ value: a.id, label: a.name }))} onChange={setAreaId} />}</Field>
        </div>
        <Field label="Result">{() => <Segmented label="Result" value={result} options={RESULT_OPTIONS} onChange={setResult} />}</Field>
        <Field label="Notes">{(id) => <textarea id={id} className={textareaClass} value={notes} placeholder="What happened, what to change" onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!valid} onClick={() => void save()}>
          Save
        </Button>
        {checkpoint && (
          <Button variant="danger" onClick={() => void deleteCheckpoint(checkpoint.id).then(onClose)}>
            Delete checkpoint
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

function ResultBadge({ cp, today }: { cp: Checkpoint; today: DayKey }) {
  if (cp.result === 'pass') return <Badge tone="ok">Passed</Badge>
  if (cp.result === 'fail') return <Badge tone="bad">Missed</Badge>
  if (cp.day <= today) return <Badge tone="warn">Record result</Badge>
  return null
}

export function TimelineTab() {
  const { settings, today } = useAppData()
  const data = useLiveQuery(async () => {
    const [phases, checkpoints, areas] = await Promise.all([
      db.phases.orderBy('start').toArray(),
      db.checkpoints.orderBy('day').toArray(),
      db.areas.orderBy('order').toArray(),
    ])
    return { phases, checkpoints, areas }
  }, [])
  const [editPhase, setEditPhase] = useState<Phase | "new" | null>(null)
  const [editCp, setEditCp] = useState<Checkpoint | 'new' | null>(null)
  if (!data) return null

  const areaById = new Map(data.areas.map((a) => [a.id, a]))
  const months = new Map<string, Checkpoint[]>()
  for (const cp of data.checkpoints) {
    const key = monthOf(cp.day)
    months.set(key, [...(months.get(key) ?? []), cp])
  }

  return (
    <div className="space-y-6">
      <Section
        title="Phases"
        action={
          <Button size="sm" variant="ghost" onClick={() => setEditPhase("new")}>
            <Icon name="plus" size={16} /> Phase
          </Button>
        }
      >
        {data.phases.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Phases split the plan into stretches with one goal each, e.g. Foundation, Build, Perform. Optional.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.phases.map((p) => (
              <PhaseCard key={p.id} phase={p} today={today} onEdit={() => setEditPhase(p)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Checkpoints"
        action={
          <Button size="sm" variant="ghost" disabled={!data.areas.length} onClick={() => setEditCp('new')}>
            <Icon name="plus" size={16} /> Add
          </Button>
        }
      >
        <p className="-mt-1 px-1 text-sm text-muted">
          Real tests on a date. Record pass or miss honestly; the notes feed the monthly review.
          {!data.areas.length && " Add an area first (Plan → Habits)."}
        </p>
        {[...months.entries()].map(([month, cps]) => (
          <Card key={month} className="divide-y divide-line py-1">
            <div className="py-2 text-xs font-semibold uppercase tracking-wider text-faint">{formatDay(`${month}-01`, { month: 'long', year: 'numeric' })}</div>
            {cps.map((cp) => (
              <button key={cp.id} type="button" onClick={() => setEditCp(cp)} className="flex w-full items-start gap-3 py-3 text-left">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: areaById.get(cp.areaId)?.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block">{cp.title}</span>
                  <span className="text-sm text-faint">
                    {formatDay(cp.day, { weekday: 'short', day: 'numeric', month: 'short' })} · {areaById.get(cp.areaId)?.name}
                  </span>
                </span>
                <ResultBadge cp={cp} today={today} />
              </button>
            ))}
          </Card>
        ))}
      </Section>

      {editPhase && (
        <PhaseSheet
          phase={editPhase === "new" ? undefined : editPhase}
          defaultStart={data.phases.at(-1) ? addDays(data.phases.at(-1)!.end, 1) : settings.planStart}
          defaultEnd={settings.planEnd}
          onClose={() => setEditPhase(null)}
        />
      )}
      {editCp && (
        <CheckpointSheet
          checkpoint={editCp === 'new' ? undefined : editCp}
          areas={data.areas}
          defaultDay={today}
          onClose={() => setEditCp(null)}
        />
      )}
    </div>
  )
}
