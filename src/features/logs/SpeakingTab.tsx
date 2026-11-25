import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { deleteDrill, saveDrill, savePeopleLog } from '../../db/actions/bodySkinVoice'
import { db } from '../../db/db'
import { fillersPer2Min, PEOPLE_QUESTS, rubricAverage, suggestPrompts, type PromptSuggestion } from '../../domain/skinVoice'
import { nextTopic } from '../../domain/study'
import { formatDay, startOfWeek } from '../../domain/time/day'
import type { Drill } from '../../model/skinVoice'
import { Field, inputClass, Segmented, textareaClass } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Button, Card, cx, Section } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { formatDuration } from './BodyTab'

type RatingKey = keyof Drill['ratings']
const RATING_LABELS: Record<RatingKey, string> = { clarity: 'Clarity', structure: 'Structure', pace: 'Pace', confidence: 'Confidence' }
const FIVE = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))

function DrillSheet({ drill, suggestions, onClose }: { drill?: Drill; suggestions: PromptSuggestion[]; onClose: () => void }) {
  const { today } = useAppData()
  const [prompt, setPrompt] = useState(drill?.prompt ?? suggestions[0]?.text ?? '')
  const [source, setSource] = useState<Drill['promptSource']>(drill?.promptSource ?? suggestions[0]?.source ?? 'custom')
  const [seconds, setSeconds] = useState<number | undefined>(drill?.seconds ?? 120)
  const [recorded, setRecorded] = useState(drill?.recorded ?? true)
  const [fillers, setFillers] = useState<number | undefined>(drill?.fillers ?? 0)
  const [ratings, setRatings] = useState<Drill['ratings']>(drill?.ratings ?? { clarity: 3, structure: 3, pace: 3, confidence: 3 })
  const [fix, setFix] = useState(drill?.fix ?? '')
  const rate = seconds ? fillersPer2Min({ fillers: fillers ?? 0, seconds }) : 0

  return (
    <Sheet title={drill ? 'Edit drill' : 'Log a speaking drill'} onClose={onClose}>
      <div className="max-h-[66dvh] space-y-1 overflow-y-auto pb-1">
        {!drill && (
          <div className="flex flex-col gap-2 py-1">
            {suggestions.map((s) => (
              <button
                key={s.text}
                type="button"
                className={cx('rounded-xl px-3 py-2 text-left text-sm', prompt === s.text ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}
                onClick={() => {
                  setPrompt(s.text)
                  setSource(s.source)
                }}
              >
                {s.text}
              </button>
            ))}
          </div>
        )}
        <Field label="Prompt">
          {(id) => (
            <textarea
              id={id}
              className={textareaClass}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
                setSource('custom')
              }}
            />
          )}
        </Field>
        <Field label={`Length · ${seconds ? formatDuration(seconds) : '–'}`}>
          {() => <Stepper label="Length in seconds" value={seconds} step={15} min={15} max={1800} unit="s" onChange={setSeconds} />}
        </Field>
        <Field label="Recorded">
          {() => (
            <Segmented
              label="Recorded"
              value={recorded ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
              onChange={(v) => setRecorded(v === 'yes')}
            />
          )}
        </Field>
        <Field label="Filler words (counted on replay at 1.5×)" hint={`${rate} per 2 minutes`}>
          {() => <Stepper label="Filler words" value={fillers} step={1} min={0} max={300} onChange={setFillers} />}
        </Field>
        {(Object.keys(RATING_LABELS) as RatingKey[]).map((k) => (
          <Field key={k} label={`${RATING_LABELS[k]} (1–5)`}>
            {() => <Segmented label={RATING_LABELS[k]} value={String(ratings[k])} options={FIVE} onChange={(v) => setRatings({ ...ratings, [k]: Number(v) })} />}
          </Field>
        ))}
        <Field label="One fix for next time">{(id) => <input id={id} className={inputClass} value={fix} onChange={(e) => setFix(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button
          variant="primary"
          disabled={!prompt.trim() || !seconds}
          onClick={() =>
            void saveDrill({
              id: drill?.id,
              day: drill?.day ?? today,
              prompt: prompt.trim(),
              promptSource: source,
              seconds: seconds!,
              recorded,
              fillers: fillers ?? 0,
              ratings,
              fix: fix.trim(),
            }).then(onClose)
          }
        >
          Save drill
        </Button>
        {drill && (
          <Button variant="ghost" onClick={() => void deleteDrill(drill.id).then(onClose)}>
            Delete
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function PeopleCard({ weekStart }: { weekStart: string }) {
  const log = useLiveQuery(() => db.peopleLogs.get(`people|${weekStart}`), [weekStart])
  const [notes, setNotes] = useState<string | null>(null)
  const quests = log?.quests ?? []
  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-sm text-muted">Conversations started</div>
          <Stepper size="sm" label="Conversations started" value={log?.conversationsStarted ?? 0} step={1} min={0} max={100} onChange={(v) => void savePeopleLog(weekStart, { conversationsStarted: v ?? 0 })} />
        </div>
        <div>
          <div className="mb-1 text-sm text-muted">Follow-up questions</div>
          <Stepper size="sm" label="Follow-up questions" value={log?.followUps ?? 0} step={1} min={0} max={200} onChange={(v) => void savePeopleLog(weekStart, { followUps: v ?? 0 })} />
        </div>
      </div>
      <div>
        <div className="mb-1 text-sm text-muted">Quests done this week (pick 2)</div>
        {PEOPLE_QUESTS.map((q) => (
          <label key={q.id} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-accent)]"
              checked={quests.includes(q.id)}
              onChange={(e) => void savePeopleLog(weekStart, { quests: e.target.checked ? [...quests, q.id] : quests.filter((x) => x !== q.id) })}
            />
            <span>{q.label}</span>
          </label>
        ))}
      </div>
      <textarea
        className={textareaClass}
        placeholder="Notes: who, what you learned"
        value={notes ?? log?.notes ?? ''}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== null) void savePeopleLog(weekStart, { notes: notes.trim() })
        }}
      />
    </Card>
  )
}

export function SpeakingTab() {
  const { settings, today } = useAppData()
  const [sheet, setSheet] = useState<Drill | 'new' | null>(null)
  const weekStart = startOfWeek(today, settings.weekStartsOn)
  const data = useLiveQuery(async () => {
    const [drills, active, session] = await Promise.all([
      db.drills.orderBy('day').reverse().toArray(),
      db.subjects.where('status').equals('active').first(),
      db.studySessions.get(`study|${today}`),
    ])
    const topics = active ? await db.topics.where('subjectId').equals(active.id).toArray() : []
    const studied = session?.topicId ? topics.find((t) => t.id === session.topicId) : undefined
    return { drills, topicTitle: studied?.title ?? nextTopic(topics)?.title }
  }, [today])
  if (!data) return null

  const recent = data.drills.slice(0, 7)
  const avg = (f: (d: Drill) => number) => (recent.length ? Math.round((recent.reduce((s, d) => s + f(d), 0) / recent.length) * 10) / 10 : undefined)
  const thisWeek = data.drills.filter((d) => d.day >= weekStart).length
  const lastFix = data.drills.find((d) => d.fix)?.fix

  return (
    <div className="space-y-6">
      <Button variant="primary" className="w-full" onClick={() => setSheet('new')}>
        <Icon name="plus" size={18} /> Log a speaking drill
      </Button>
      {lastFix && (
        <Card className="border border-accent/30">
          <div className="text-xs font-semibold uppercase tracking-wider text-faint">Fix from your last drill</div>
          <p className="mt-1">{lastFix}</p>
        </Card>
      )}
      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{thisWeek}</div>
          <div className="text-xs text-faint">drills this week</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{avg(fillersPer2Min) ?? '–'}</div>
          <div className="text-xs text-faint">fillers / 2 min (last 7)</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{avg(rubricAverage) ?? '–'}</div>
          <div className="text-xs text-faint">rubric avg / 5</div>
        </div>
      </Card>

      <Section title="People this week">
        <PeopleCard weekStart={weekStart} />
      </Section>

      <Section title="Drills">
        <Card>
          {data.drills.length === 0 ? (
            <p className="text-sm text-muted">Record yourself explaining today's topic simply, replay at 1.5×, count fillers, rate, write one fix. The app stores no audio.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.drills.slice(0, 20).map((d) => (
                <li key={d.id}>
                  <button type="button" className="flex min-h-12 w-full items-center gap-2 py-2 text-left" onClick={() => setSheet(d)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{d.prompt}</span>
                      <span className="text-xs text-faint">
                        {formatDay(d.day, { day: 'numeric', month: 'short' })} · {formatDuration(d.seconds)} · {fillersPer2Min(d)} fillers/2 min · rubric {rubricAverage(d).toFixed(1)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      {sheet && <DrillSheet drill={sheet === 'new' ? undefined : sheet} suggestions={suggestPrompts(today, data.topicTitle)} onClose={() => setSheet(null)} />}
    </div>
  )
}
