import { useState } from 'react'
import { saveExercise, saveTemplate } from '../../db/actions/bodySkinVoice'
import type { Exercise, WorkoutTemplate } from '../../model/body'
import { Field, inputClass, Segmented, Select } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'

export function ExerciseSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (exercise: Exercise) => void }) {
  const [name, setName] = useState('')
  const [repMin, setRepMin] = useState<number | undefined>(8)
  const [repMax, setRepMax] = useState<number | undefined>(12)
  const [increment, setIncrement] = useState<number | undefined>(2.5)
  const [kind, setKind] = useState<'weighted' | 'bodyweight' | 'hold'>('weighted')
  const valid = name.trim() && repMin && repMax && repMax >= repMin
  return (
    <Sheet title="New exercise" onClose={onClose}>
      <Field label="Name">{(id) => <input id={id} className={inputClass} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Type">
        {() => (
          <Segmented
            label="Type"
            value={kind}
            options={[
              { value: 'weighted', label: 'Weighted' },
              { value: 'bodyweight', label: 'Bodyweight' },
              { value: 'hold', label: 'Hold (seconds)' },
            ]}
            onChange={setKind}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={kind === 'hold' ? 'Range from (s)' : 'Reps from'}>{() => <Stepper size="sm" label="Range from" value={repMin} step={1} min={1} max={300} onChange={setRepMin} />}</Field>
        <Field label="to">{() => <Stepper size="sm" label="Range to" value={repMax} step={1} min={1} max={300} onChange={setRepMax} />}</Field>
      </div>
      {kind === 'weighted' && (
        <Field label="Add this much when every set hits the top">
          {() => <Stepper size="sm" label="Increment" value={increment} step={0.5} min={0.5} max={20} decimals={1} unit="kg" onChange={setIncrement} />}
        </Field>
      )}
      <div className="mt-3 grid gap-2">
        <Button
          variant="primary"
          disabled={!valid}
          onClick={async () => {
            const exercise: Omit<Exercise, 'id'> = {
              name: name.trim(),
              repMin: repMin!,
              repMax: repMax!,
              increment: increment ?? 2.5,
              bodyweight: kind !== 'weighted',
              measure: kind === 'hold' ? 'seconds' : 'reps',
              notes: '',
            }
            const id = await saveExercise(exercise)
            onCreated({ ...exercise, id })
          }}
        >
          Add exercise
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

/** Create or edit a workout template (Full Body A/B, Push/Pull/Legs…). */
export function TemplateSheet({ template, exercises, onClose }: { template?: WorkoutTemplate; exercises: Exercise[]; onClose: () => void }) {
  const [name, setName] = useState(template?.name ?? '')
  const [items, setItems] = useState(template?.items ?? [])
  const [archived, setArchived] = useState(template?.archived ?? false)
  const [creating, setCreating] = useState(false)
  const [allExercises, setAllExercises] = useState(exercises)
  const options = allExercises.map((e) => ({ value: e.id, label: e.name }))
  const valid = name.trim() && items.length > 0

  return (
    <Sheet title={template ? 'Edit template' : 'New template'} onClose={onClose}>
      <div className="max-h-[66dvh] space-y-1 overflow-y-auto pb-1">
        <Field label="Name">{(id) => <input id={id} className={inputClass} value={name} placeholder="e.g. Push" onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="space-y-2 py-2">
          <div className="text-sm font-medium">Exercises</div>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select value={item.exerciseId} options={options} onChange={(exerciseId) => setItems(items.map((x, j) => (j === i ? { ...x, exerciseId } : x)))} />
              </div>
              <div className="w-36 shrink-0">
                <Stepper size="sm" label="Sets" value={item.sets} step={1} min={1} max={10} unit="sets" onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, sets: v ?? 1 } : x)))} />
              </div>
              <button type="button" aria-label="Remove exercise" className="grid size-10 place-items-center text-faint" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!allExercises.length} onClick={() => setItems([...items, { exerciseId: allExercises[0]!.id, sets: 3 }])}>
              <Icon name="plus" size={16} /> Exercise
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
              New exercise…
            </Button>
          </div>
        </div>
        {template && (
          <Field label="Status">
            {() => (
              <Segmented
                label="Status"
                value={archived ? 'archived' : 'active'}
                options={[
                  { value: 'active', label: 'In use' },
                  { value: 'archived', label: 'Archived' },
                ]}
                onChange={(v) => setArchived(v === 'archived')}
              />
            )}
          </Field>
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!valid} onClick={() => void saveTemplate({ id: template?.id, name: name.trim(), items, archived }).then(onClose)}>
          Save template
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {creating && (
        <ExerciseSheet
          onClose={() => setCreating(false)}
          onCreated={(exercise) => {
            setCreating(false)
            setAllExercises((prev) => [...prev, exercise])
            setItems([...items, { exerciseId: exercise.id, sets: 3 }])
          }}
        />
      )}
    </Sheet>
  )
}
