import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import {
  activateSubject,
  addTopics,
  completeSubject,
  deleteSubject,
  deleteTopic,
  moveSubject,
  moveTopic,
  saveSubject,
  setTopicStatus,
  updateTopic,
} from '../../db/actions/plan'
import { db } from '../../db/db'
import { nextTopic, parseTopicLines, sortTopics, statusCounts, TOPIC_STATUS_LABEL, TOPIC_STATUS_SHORT } from '../../domain/study'
import { TOPIC_STATUSES, type Subject, type Topic, type TopicStatus } from '../../model/career'
import { Field, inputClass, textareaClass } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, cx, Section } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

const STATUS_TONE: Record<TopicStatus, 'neutral' | 'warn' | 'accent' | 'ok'> = {
  not_started: 'neutral',
  learning: 'warn',
  can_explain: 'accent',
  under_pressure: 'ok',
}

export function TopicStatusSheet({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const { today } = useAppData()
  return (
    <Sheet title={topic.title} onClose={onClose}>
      <div className="grid gap-2">
        {TOPIC_STATUSES.map((s) => (
          <Button
            key={s}
            variant={topic.status === s ? 'primary' : 'secondary'}
            className="justify-start"
            onClick={() => void setTopicStatus(topic.id, s, today).then(onClose)}
          >
            {TOPIC_STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
        Close
      </Button>
    </Sheet>
  )
}

function TopicEditSheet({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const [title, setTitle] = useState(topic.title)
  const [group, setGroup] = useState(topic.group)
  const [notes, setNotes] = useState(topic.notes)
  return (
    <Sheet title="Edit topic" onClose={onClose}>
      <div className="max-h-[60dvh] overflow-y-auto">
        <Field label="Topic">{(id) => <input id={id} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Group" hint="Optional, e.g. Patterns">
          {(id) => <input id={id} className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)} />}
        </Field>
        <Field label="Notes">{(id) => <textarea id={id} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => void moveTopic(topic.id, -1)}>Move up</Button>
        <Button onClick={() => void moveTopic(topic.id, 1)}>Move down</Button>
      </div>
      <div className="mt-2 grid gap-2">
        <Button
          variant="primary"
          disabled={!title.trim()}
          onClick={() => void updateTopic(topic.id, { title: title.trim(), group: group.trim(), notes: notes.trim() }).then(onClose)}
        >
          Save
        </Button>
        <Button variant="danger" onClick={() => void deleteTopic(topic.id).then(onClose)}>
          Delete topic
        </Button>
      </div>
    </Sheet>
  )
}

function PasteTopicsSheet({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const [text, setText] = useState('')
  const parsed = parseTopicLines(text)
  return (
    <Sheet title={`Add topics to ${subject.name}`} onClose={onClose}>
      <p className="mb-2 text-sm text-muted">
        Paste your list, one topic per line. Bullets and numbers are removed. A line ending in “:” starts a group.
      </p>
      <textarea
        className={cx(textareaClass, 'min-h-48 font-mono text-sm')}
        value={text}
        autoFocus
        placeholder={'Patterns:\n- Strategy\n- Observer\nMachine coding:\n1. Parking Lot'}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={parsed.length === 0} onClick={() => void addTopics(subject.id, parsed).then(onClose)}>
          {parsed.length ? `Add ${parsed.length} topic${parsed.length === 1 ? '' : 's'}` : 'Add topics'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

function SubjectSheet({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const [name, setName] = useState(subject.name)
  const [note, setNote] = useState(subject.note)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <Sheet title={subject.name} onClose={onClose}>
      <Field label="Name">{(id) => <input id={id} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Note">{(id) => <input id={id} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button onClick={() => void moveSubject(subject.id, -1)}>Move up</Button>
        <Button onClick={() => void moveSubject(subject.id, 1)}>Move down</Button>
      </div>
      <div className="mt-2 grid gap-2">
        <Button variant="primary" disabled={!name.trim()} onClick={() => void saveSubject({ id: subject.id, name: name.trim(), note: note.trim() }).then(onClose)}>
          Save
        </Button>
        {subject.status === 'active' && (
          <Button onClick={() => void completeSubject(subject.id).then(onClose)}>Mark done and start the next subject</Button>
        )}
        {subject.status !== 'active' && <Button onClick={() => void activateSubject(subject.id).then(onClose)}>Make this the active subject</Button>}
        {confirmDelete ? (
          <Button variant="danger" onClick={() => void deleteSubject(subject.id).then(onClose)}>
            Delete subject and all its topics
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Delete subject…
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function SubjectCard({ subject, topics, open, onToggle }: { subject: Subject; topics: Topic[]; open: boolean; onToggle: () => void }) {
  const [statusTopic, setStatusTopic] = useState<Topic | null>(null)
  const [editTopic, setEditTopic] = useState<Topic | null>(null)
  const [pasting, setPasting] = useState(false)
  const [options, setOptions] = useState(false)
  const counts = statusCounts(topics)
  const next = nextTopic(topics)
  const sorted = sortTopics(topics)
  const groups: Array<[string, Topic[]]> = []
  for (const t of sorted) {
    const last = groups[groups.length - 1]
    if (last && last[0] === t.group) last[1].push(t)
    else groups.push([t.group, [t]])
  }
  const explained = counts.can_explain + counts.under_pressure

  return (
    <Card className={cx(subject.status === 'active' && 'ring-1 ring-accent/40')}>
      <div className="flex items-start gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={open} onClick={onToggle}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{subject.name}</h3>
            {subject.status === 'active' && <Badge tone="accent">Active</Badge>}
            {subject.status === 'done' && <Badge tone="ok">Done</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {topics.length === 0
              ? 'No topics yet'
              : `${explained} of ${topics.length} can be explained${next && subject.status === 'active' ? ` · next: ${next.title}` : ''}`}
          </p>
          {subject.note && <p className="text-xs text-faint">{subject.note}</p>}
        </button>
        <button type="button" aria-label={`Options for ${subject.name}`} className="grid size-11 place-items-center rounded-full text-muted active:bg-surface-2" onClick={() => setOptions(true)}>
          <Icon name="settings" size={20} />
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {groups.map(([group, list]) => (
            <div key={group || '_'}>
              {group && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">{group}</div>}
              <ul className="divide-y divide-line">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-1.5">
                    <button type="button" className="min-h-10 min-w-0 flex-1 text-left" onClick={() => setEditTopic(t)}>
                      <span className={cx(t.id === next?.id && subject.status === 'active' && 'font-semibold')}>{t.title}</span>
                    </button>
                    <button type="button" onClick={() => setStatusTopic(t)} aria-label={`${t.title}: ${TOPIC_STATUS_LABEL[t.status]}. Change`}>
                      <Badge tone={STATUS_TONE[t.status]}>{TOPIC_STATUS_SHORT[t.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => setPasting(true)}>
            <Icon name="plus" size={18} /> Add or paste topics
          </Button>
        </div>
      )}

      {statusTopic && <TopicStatusSheet topic={statusTopic} onClose={() => setStatusTopic(null)} />}
      {editTopic && <TopicEditSheet topic={editTopic} onClose={() => setEditTopic(null)} />}
      {pasting && <PasteTopicsSheet subject={subject} onClose={() => setPasting(false)} />}
      {options && <SubjectSheet subject={subject} onClose={() => setOptions(false)} />}
    </Card>
  )
}

function NewSubjectSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  return (
    <Sheet title="New subject" onClose={onClose}>
      <Field label="Name">{(id) => <input id={id} className={inputClass} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!name.trim()} onClick={() => void saveSubject({ name: name.trim() }).then(onClose)}>
          Add to the queue
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

export function StudyTab() {
  const data = useLiveQuery(async () => {
    const [subjects, topics] = await Promise.all([db.subjects.orderBy('order').toArray(), db.topics.toArray()])
    return { subjects, topics }
  }, [])
  const [openIds, setOpenIds] = useState<Set<string> | null>(null)
  const [adding, setAdding] = useState(false)
  if (!data) return null

  const active = data.subjects.find((s) => s.status === 'active')
  const open = openIds ?? new Set(active ? [active.id] : [])
  const toggle = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpenIds(next)
  }
  const ordered = [
    ...data.subjects.filter((s) => s.status === 'active'),
    ...data.subjects.filter((s) => s.status === 'queued'),
    ...data.subjects.filter((s) => s.status === 'done'),
  ]

  return (
    <Section
      title="Subject queue"
      action={
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Subject
        </Button>
      }
    >
      <p className="-mt-1 px-1 text-sm text-muted">One active subject at a time; DSA runs alongside. Tap a status to move a topic up the ladder.</p>
      <div className="space-y-3">
        {ordered.map((s) => (
          <SubjectCard key={s.id} subject={s} topics={data.topics.filter((t) => t.subjectId === s.id)} open={open.has(s.id)} onToggle={() => toggle(s.id)} />
        ))}
      </div>
      {adding && <NewSubjectSheet onClose={() => setAdding(false)} />}
    </Section>
  )
}
