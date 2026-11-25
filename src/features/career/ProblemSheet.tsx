import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { deleteProblem, knownTags, saveProblem } from '../../db/actions/career'
import type { DsaProblem } from '../../model/career'
import { ChipSelect, TagInput } from '../../ui/Chips'
import { Field, inputClass, Segmented } from '../../ui/fields'
import { Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'

export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const

export const OUTCOMES = [
  { value: 'alone', label: 'Solved alone' },
  { value: 'hint', label: 'With a hint' },
  { value: 'solution', label: 'Saw solution' },
] as const

export const MISTAKES = [
  { value: 'pattern', label: "Didn't spot the pattern" },
  { value: 'edge_case', label: 'Edge case' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'impl_bug', label: 'Implementation bug' },
  { value: 'misread', label: 'Misread constraints' },
] as const

type Difficulty = DsaProblem['difficulty']
type Outcome = DsaProblem['outcome']
type Mistake = NonNullable<DsaProblem['mistake']>

/** Log a new DSA problem (or edit one). Its first review is scheduled automatically. */
export function ProblemSheet({ problem, onClose }: { problem?: DsaProblem; onClose: () => void }) {
  const { today } = useAppData()
  const tags = useLiveQuery(knownTags, []) ?? []
  const [title, setTitle] = useState(problem?.title ?? '')
  const [link, setLink] = useState(problem?.link ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(problem?.difficulty ?? 'medium')
  const [chosenTags, setChosenTags] = useState<string[]>(problem?.tags ?? [])
  const [minutes, setMinutes] = useState<number | undefined>(problem?.minutes)
  const [outcome, setOutcome] = useState<Outcome>(problem?.outcome ?? 'alone')
  const [mistake, setMistake] = useState<Mistake | undefined>(problem?.mistake)
  const [insight, setInsight] = useState(problem?.insight ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    await saveProblem({
      id: problem?.id,
      day: problem?.day ?? today,
      title: title.trim(),
      link: link.trim(),
      difficulty,
      tags: chosenTags,
      minutes,
      outcome,
      mistake,
      insight: insight.trim(),
    })
    onClose()
  }

  return (
    <Sheet title={problem ? 'Edit problem' : 'Log a problem'} onClose={onClose}>
      <div className="max-h-[68dvh] space-y-1 overflow-y-auto pb-1">
        <Field label="Problem">{(id) => <input id={id} className={inputClass} autoFocus={!problem} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Link (optional)">
          {(id) => <input id={id} className={inputClass} inputMode="url" value={link} placeholder="https://leetcode.com/problems/…" onChange={(e) => setLink(e.target.value)} />}
        </Field>
        <Field label="Difficulty">{() => <Segmented label="Difficulty" value={difficulty} options={DIFFICULTIES} onChange={setDifficulty} />}</Field>
        <Field label="Patterns">{() => <TagInput label="Patterns" value={chosenTags} suggestions={tags} onChange={setChosenTags} />}</Field>
        <Field label="Outcome">{() => <Segmented label="Outcome" value={outcome} options={OUTCOMES} onChange={setOutcome} />}</Field>
        <Field label="Time taken">
          {() => <Stepper label="Minutes" value={minutes} start={30} step={5} min={1} max={240} unit="min" onChange={setMinutes} />}
        </Field>
        <Field label="Main mistake (optional)">{() => <ChipSelect label="Mistake" value={mistake} options={MISTAKES} onChange={setMistake} />}</Field>
        <Field label="Key insight, one line">
          {(id) => <input id={id} className={inputClass} value={insight} placeholder="What would make this obvious next time?" onChange={(e) => setInsight(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!title.trim()} onClick={() => void save()}>
          {problem ? 'Save' : 'Log it · review tomorrow'}
        </Button>
        {problem &&
          (confirmDelete ? (
            <Button variant="danger" onClick={() => void deleteProblem(problem.id).then(onClose)}>
              Delete problem and its reviews
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
