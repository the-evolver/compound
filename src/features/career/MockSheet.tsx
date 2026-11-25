import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { deleteMock, saveMock } from '../../db/actions/career'
import { isDayKey } from '../../domain/time/day'
import type { Mock } from '../../model/career'
import { Field, inputClass, Segmented, textareaClass } from '../../ui/fields'
import { Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

export const MOCK_TYPES = [
  { value: 'dsa', label: 'DSA' },
  { value: 'lld', label: 'LLD' },
  { value: 'hld', label: 'HLD' },
  { value: 'behavioural', label: 'Behavioural' },
] as const

const SCORE_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: String(n) as '1' | '2' | '3' | '4', label: String(n) }))
type ScoreKey = keyof Mock['scores']
const SCORE_LABELS: Record<ScoreKey, string> = { technical: 'Technical', problemSolving: 'Problem solving', communication: 'Communication' }

export function MockSheet({ mock, onClose }: { mock?: Mock; onClose: () => void }) {
  const { today } = useAppData()
  const [day, setDay] = useState(mock?.day ?? today)
  const [type, setType] = useState<Mock['type']>(mock?.type ?? 'dsa')
  const [platform, setPlatform] = useState(mock?.platform ?? '')
  const [scores, setScores] = useState<Mock['scores']>(mock?.scores ?? { technical: 2, problemSolving: 2, communication: 2 })
  const [verdict, setVerdict] = useState<Mock['verdict']>(mock?.verdict ?? 'no_hire')
  const [fixes, setFixes] = useState<string[]>(() => [...(mock?.fixes ?? []), '', '', ''].slice(0, 3))
  const [notes, setNotes] = useState(mock?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    await saveMock({ id: mock?.id, day, type, platform: platform.trim(), scores, verdict, fixes, notes: notes.trim() })
    onClose()
  }

  return (
    <Sheet title={mock ? 'Edit mock' : 'Log a mock interview'} onClose={onClose}>
      <div className="max-h-[68dvh] space-y-1 overflow-y-auto pb-1">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">{(id) => <input id={id} type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />}</Field>
          <Field label="Platform or peer">{(id) => <input id={id} className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value)} />}</Field>
        </div>
        <Field label="Type">{() => <Segmented label="Type" value={type} options={MOCK_TYPES} onChange={setType} />}</Field>
        {(Object.keys(SCORE_LABELS) as ScoreKey[]).map((k) => (
          <Field key={k} label={`${SCORE_LABELS[k]} (1–4)`}>
            {() => (
              <Segmented
                label={SCORE_LABELS[k]}
                value={String(scores[k]) as '1' | '2' | '3' | '4'}
                options={SCORE_OPTIONS}
                onChange={(v) => setScores({ ...scores, [k]: Number(v) })}
              />
            )}
          </Field>
        ))}
        <Field label="Verdict">
          {() => (
            <Segmented
              label="Verdict"
              value={verdict}
              options={[
                { value: 'hire', label: 'Hire' },
                { value: 'no_hire', label: 'No hire' },
              ]}
              onChange={setVerdict}
            />
          )}
        </Field>
        <Field label="Top 3 fixes" hint={mock ? undefined : 'Each becomes a checklist item.'}>
          {() => (
            <div className="space-y-2">
              {fixes.map((f, i) => (
                <input
                  key={i}
                  className={inputClass}
                  value={f}
                  placeholder={`Fix ${i + 1}`}
                  onChange={(e) => setFixes(fixes.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
            </div>
          )}
        </Field>
        <Field label="Notes">{(id) => <textarea id={id} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!isDayKey(day)} onClick={() => void save()}>
          Save
        </Button>
        {mock &&
          (confirmDelete ? (
            <Button variant="danger" onClick={() => void deleteMock(mock.id).then(onClose)}>
              Delete mock and its fixes
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete…
            </Button>
          ))}
      </div>
    </Sheet>
  )
}
