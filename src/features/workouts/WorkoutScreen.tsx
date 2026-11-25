import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useAppData } from '../../app/AppData'
import { deleteSession, saveSession } from '../../db/actions/bodySkinVoice'
import { db } from '../../db/db'
import { formatDay } from '../../domain/time/day'
import { lastSetsFor, loggedSets, prefillSets, progression } from '../../domain/workouts'
import type { Exercise, WorkoutSession, WorkoutSet, WorkoutTemplate } from '../../model/body'
import { Segmented } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Button, Card } from '../../ui/primitives'
import { ScreenHeader } from '../../ui/ScreenHeader'
import { Stepper } from '../../ui/Stepper'

type Entry = { exerciseId: string; sets: WorkoutSet[] }

function ExerciseBlock({
  exercise,
  entry,
  lastSets,
  onChange,
}: {
  exercise: Exercise
  entry: Entry
  lastSets: WorkoutSet[] | undefined
  onChange: (sets: WorkoutSet[]) => void
}) {
  const suggestion = progression(exercise, lastSets)
  const seconds = exercise.measure === 'seconds'
  const setAt = (i: number, patch: Partial<WorkoutSet>) => onChange(entry.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{exercise.name}</h2>
        <p className="text-sm text-faint">
          {exercise.repMin}–{exercise.repMax} {seconds ? 's' : 'reps'}
          {!exercise.bodyweight && ` · +${exercise.increment} kg when every set hits ${exercise.repMax}`}
        </p>
        {lastSets && (
          <p className="text-xs text-faint">
            Last time: {lastSets.map((s) => (exercise.bodyweight ? `${s.reps}` : `${s.reps}×${s.kg}`)).join(', ')}
          </p>
        )}
      </div>
      {suggestion && suggestion.kind !== 'add-reps' && (
        <div className="flex items-center gap-2 rounded-xl bg-accent/10 p-2.5 text-sm">
          <span className="flex-1">
            {suggestion.kind === 'add-weight' ? `Go up to ${suggestion.kg} kg. ` : ''}
            {suggestion.reason}
          </span>
          {suggestion.kind === 'add-weight' && (
            <Button size="sm" variant="primary" onClick={() => onChange(entry.sets.map(() => ({ reps: exercise.repMin, kg: suggestion.kg })))}>
              Apply
            </Button>
          )}
        </div>
      )}
      {/* Units once as column headings, so each number has room on a phone (e.g. 102.5). */}
      <div className="flex gap-2 text-xs text-faint" aria-hidden="true">
        <span className="w-7 shrink-0">Set</span>
        <span className="flex-1 text-center">{seconds ? 'Seconds' : 'Reps'}</span>
        {!exercise.bodyweight && <span className="flex-1 text-center">kg</span>}
      </div>
      <ol className="!mt-1 space-y-2">
        {entry.sets.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-sm text-faint">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Stepper size="sm" showUnit={false} label={`Set ${i + 1} ${seconds ? 'seconds' : 'reps'}`} value={s.reps} step={seconds ? 5 : 1} min={0} max={seconds ? 600 : 100} unit={seconds ? 's' : 'reps'} onChange={(v) => setAt(i, { reps: v ?? 0 })} />
            </div>
            {!exercise.bodyweight && (
              <div className="min-w-0 flex-1">
                <Stepper size="sm" showUnit={false} label={`Set ${i + 1} weight`} value={s.kg} step={2.5} min={0} max={400} decimals={1} unit="kg" onChange={(v) => setAt(i, { kg: v ?? 0 })} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {!exercise.bodyweight && entry.sets.some((s) => s.kg === 0) && (
        <p className="text-xs text-faint">Sets left at 0 kg aren't saved: enter the weight you lifted.</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onChange([...entry.sets, entry.sets.at(-1) ?? { reps: exercise.repMin, kg: 0 }])}>
          <Icon name="plus" size={16} /> Set
        </Button>
        {entry.sets.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onChange(entry.sets.slice(0, -1))}>
            <Icon name="minus" size={16} /> Remove last set
          </Button>
        )}
      </div>
    </Card>
  )
}

function SessionForm({
  session,
  template,
  exercises,
  sessions,
}: {
  session?: WorkoutSession
  template?: WorkoutTemplate
  exercises: Map<string, Exercise>
  sessions: WorkoutSession[]
}) {
  const navigate = useNavigate()
  const { today } = useAppData()
  const others = sessions.filter((s) => s.id !== session?.id)
  const [entries, setEntries] = useState<Entry[]>(() =>
    session
      ? session.entries.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ ...s })) }))
      : (template?.items ?? []).flatMap((item) => {
          const ex = exercises.get(item.exerciseId)
          return ex ? [{ exerciseId: ex.id, sets: prefillSets(ex, item.sets, lastSetsFor(ex.id, others)) }] : []
        }),
  )
  const [location, setLocation] = useState<'gym' | 'home'>(session?.location ?? (template && /home/i.test(template.name) ? 'home' : 'gym'))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const day = session?.day ?? today

  const save = async () => {
    const logged = entries.map((e) => {
      const ex = exercises.get(e.exerciseId)
      return ex ? { ...e, sets: loggedSets(ex, e.sets) } : e
    })
    await saveSession({ id: session?.id, day, templateId: session?.templateId ?? template?.id, location, entries: logged })
    navigate(-1)
  }

  return (
    <div className="space-y-5">
      <ScreenHeader
        title={template?.name ?? 'Workout'}
        subtitle={`${formatDay(day, { weekday: 'long', day: 'numeric', month: 'short' })} · pre-filled from last time`}
        back="/logs?tab=workouts"
      />
      <Segmented
        label="Where"
        value={location}
        options={[
          { value: 'gym', label: 'Gym' },
          { value: 'home', label: 'Home (minimum version)' },
        ]}
        onChange={setLocation}
      />
      {entries.map((entry, i) => {
        const ex = exercises.get(entry.exerciseId)
        if (!ex) return null
        return (
          <ExerciseBlock
            key={entry.exerciseId + i}
            exercise={ex}
            entry={entry}
            lastSets={lastSetsFor(ex.id, others)}
            onChange={(sets) => setEntries(entries.map((e, j) => (j === i ? { ...e, sets } : e)))}
          />
        )
      })}
      <Button variant="primary" className="w-full" disabled={!entries.some((e) => e.sets.length)} onClick={() => void save()}>
        {session ? 'Save changes' : 'Save workout'}
      </Button>
      {session &&
        (confirmDelete ? (
          <Button variant="danger" className="w-full" onClick={() => void deleteSession(session.id).then(() => navigate(-1))}>
            Delete this workout
          </Button>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
            Delete…
          </Button>
        ))}
    </div>
  )
}

export function WorkoutScreen() {
  const { id = 'new' } = useParams()
  const [params] = useSearchParams()
  const sessionId = id === 'new' ? undefined : decodeURIComponent(id)
  const data = useLiveQuery(async () => {
    const [session, exercises, sessions, templates] = await Promise.all([
      sessionId ? db.workoutSessions.get(sessionId) : Promise.resolve(undefined),
      db.exercises.toArray(),
      db.workoutSessions.toArray(),
      db.workoutTemplates.toArray(),
    ])
    const templateId = session?.templateId ?? params.get('template') ?? undefined
    return { session, sessions, exercises: new Map(exercises.map((e) => [e.id, e])), template: templates.find((t) => t.id === templateId) }
  }, [sessionId])
  if (!data) return null
  if (sessionId && !data.session) {
    return (
      <div className="space-y-4">
        <ScreenHeader title="Workout not found" back="/logs?tab=workouts" />
      </div>
    )
  }
  return <SessionForm key={sessionId ?? `new-${data.template?.id}`} session={data.session} template={data.template} exercises={data.exercises} sessions={data.sessions} />
}
