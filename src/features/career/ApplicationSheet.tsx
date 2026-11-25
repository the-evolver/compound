import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { deleteApplication, saveApplication } from '../../db/actions/career'
import { STAGE_LABEL } from '../../domain/career'
import { formatDay, isDayKey } from '../../domain/time/day'
import { APPLICATION_STAGES, type Application } from '../../model/career'
import { Field, inputClass, Segmented, Select, textareaClass } from '../../ui/fields'
import { Button } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

const SOURCES = [
  { value: 'referral', label: 'Referral' },
  { value: 'direct', label: 'Direct' },
  { value: 'recruiter', label: 'Recruiter' },
] as const

export function ApplicationSheet({ app, onClose }: { app?: Application; onClose: () => void }) {
  const { today } = useAppData()
  const [company, setCompany] = useState(app?.company ?? '')
  const [role, setRole] = useState(app?.role ?? '')
  const [source, setSource] = useState<Application['source']>(app?.source ?? 'referral')
  const [referrer, setReferrer] = useState(app?.referrer ?? '')
  const [stage, setStage] = useState<Application['stage']>(app?.stage ?? 'target')
  const [nextAction, setNextAction] = useState(app?.nextAction ?? '')
  const [nextActionDay, setNextActionDay] = useState(app?.nextActionDay ?? '')
  const [notes, setNotes] = useState(app?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const valid = company.trim() && (!nextActionDay || isDayKey(nextActionDay))
  const save = async () => {
    await saveApplication(
      {
        id: app?.id,
        company: company.trim(),
        role: role.trim(),
        source,
        referrer: referrer.trim(),
        stage,
        nextAction: nextAction.trim(),
        nextActionDay: nextActionDay || undefined,
        notes: notes.trim(),
      },
      today,
    )
    onClose()
  }

  return (
    <Sheet title={app ? app.company : 'Add a company'} onClose={onClose}>
      <div className="max-h-[68dvh] space-y-1 overflow-y-auto pb-1">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Company">{(id) => <input id={id} className={inputClass} autoFocus={!app} value={company} onChange={(e) => setCompany(e.target.value)} />}</Field>
          <Field label="Role">{(id) => <input id={id} className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} />}</Field>
        </div>
        <Field label="Source">{() => <Segmented label="Source" value={source} options={SOURCES} onChange={setSource} />}</Field>
        <Field label="Referrer">{(id) => <input id={id} className={inputClass} value={referrer} onChange={(e) => setReferrer(e.target.value)} />}</Field>
        <Field label="Stage">
          {(id) => <Select id={id} value={stage} options={APPLICATION_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} onChange={setStage} />}
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Next action">{(id) => <input id={id} className={inputClass} value={nextAction} placeholder="e.g. Ping referrer" onChange={(e) => setNextAction(e.target.value)} />}</Field>
          <Field label="By">{(id) => <input id={id} type="date" className={inputClass} value={nextActionDay} onChange={(e) => setNextActionDay(e.target.value)} />}</Field>
        </div>
        <Field label="Notes">{(id) => <textarea id={id} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        {app && app.history.length > 0 && (
          <div className="py-2 text-sm text-faint">
            {app.history.map((h) => `${formatDay(h.day, { day: 'numeric', month: 'short' })}: ${STAGE_LABEL[h.stage]}`).join(' → ')}
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!valid} onClick={() => void save()}>
          Save
        </Button>
        {app &&
          (confirmDelete ? (
            <Button variant="danger" onClick={() => void deleteApplication(app.id).then(onClose)}>
              Delete {app.company}
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
