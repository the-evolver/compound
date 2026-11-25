import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { deleteDermVisit, deleteMeasurement, deleteProduct, saveDermVisit, saveMeasurement, saveProduct } from '../../db/actions/bodySkinVoice'
import { db } from '../../db/db'
import { newProductCheck, skinPhotoSchedule } from '../../domain/skinVoice'
import { addDays, formatDay, startOfWeek, type DayKey } from '../../domain/time/day'
import type { DermVisit, SkinProduct } from '../../model/skinVoice'
import { Field, inputClass, Segmented, Select, textareaClass } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'
import { AreaNotes } from '../plan/HabitsTab'
import { TaskCheck } from './MocksTab'

const fmt = (d: DayKey) => formatDay(d, { day: 'numeric', month: 'short', year: 'numeric' })

const ROLES = [
  { value: 'cleanser', label: 'Cleanser' },
  { value: 'sunscreen', label: 'Sunscreen' },
  { value: 'moisturiser', label: 'Moisturiser' },
  { value: 'active', label: 'Active' },
  { value: 'other', label: 'Other' },
] as const

const PATCH = [
  { value: 'not_done', label: 'Not done' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Reacted' },
] as const

function ProductSheet({ product, products, onClose }: { product?: SkinProduct; products: SkinProduct[]; onClose: () => void }) {
  const { today } = useAppData()
  const [name, setName] = useState(product?.name ?? '')
  const [role, setRole] = useState<SkinProduct['role']>(product?.role ?? 'active')
  const [startDay, setStartDay] = useState(product?.startDay ?? today)
  const [patchTest, setPatchTest] = useState<SkinProduct['patchTest']>(product?.patchTest ?? 'not_done')
  const [baseline, setBaseline] = useState(product?.baseline ?? false)
  const [stopped, setStopped] = useState(!!product?.stoppedDay)
  const [notes, setNotes] = useState(product?.notes ?? '')
  const check = newProductCheck(products, { id: product?.id, startDay, baseline })

  return (
    <Sheet title={product ? product.name : 'Add a product'} onClose={onClose}>
      <div className="max-h-[66dvh] space-y-1 overflow-y-auto pb-1">
        <Field label="Product">{(id) => <input id={id} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Type">{(id) => <Select id={id} value={role} options={ROLES} onChange={setRole} />}</Field>
        <Field label="Part of the starting routine?" hint="Cleanser and sunscreen from week 1 don't count as “new”.">
          {() => (
            <Segmented
              label="Starting routine"
              value={baseline ? 'yes' : 'no'}
              options={[
                { value: 'no', label: 'No, it is new' },
                { value: 'yes', label: 'Yes' },
              ]}
              onChange={(v) => setBaseline(v === 'yes')}
            />
          )}
        </Field>
        <Field label="Start date">{(id) => <input id={id} type="date" className={inputClass} value={startDay} onChange={(e) => setStartDay(e.target.value)} />}</Field>
        {!check.ok && (
          <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
            One new product at a time, at least 4 weeks apart: {check.blockedBy.name} started {fmt(check.blockedBy.startDay!)}.
            <Button size="sm" className="mt-2" onClick={() => setStartDay(check.earliest)}>
              Start on {fmt(check.earliest)}
            </Button>
          </div>
        )}
        <Field label="Patch test" hint="Test behind the ear or inner arm for 2–3 days before using it on the face.">
          {() => <Segmented label="Patch test" value={patchTest} options={PATCH} onChange={setPatchTest} />}
        </Field>
        {product && (
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={stopped} onChange={(e) => setStopped(e.target.checked)} />
            <span>Stopped using it</span>
          </label>
        )}
        <Field label="Notes">{(id) => <textarea id={id} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button
          variant="primary"
          disabled={!name.trim() || !check.ok}
          onClick={() =>
            void saveProduct({
              id: product?.id,
              name: name.trim(),
              role,
              startDay,
              patchTest,
              baseline,
              stoppedDay: stopped ? (product?.stoppedDay ?? today) : undefined,
              notes: notes.trim(),
            }).then(onClose)
          }
        >
          Save
        </Button>
        {product && (
          <Button variant="ghost" onClick={() => void deleteProduct(product.id).then(onClose)}>
            Delete
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function DermSheet({ visit, onClose }: { visit?: DermVisit; onClose: () => void }) {
  const { today } = useAppData()
  const [day, setDay] = useState(visit?.day ?? today)
  const [advice, setAdvice] = useState(visit?.advice ?? '')
  const [plan, setPlan] = useState(visit?.plan ?? '')
  const [nextVisit, setNextVisit] = useState(visit?.nextVisit ?? '')
  return (
    <Sheet title={visit ? 'Dermatologist visit' : 'Log a dermatologist visit'} onClose={onClose}>
      <div className="max-h-[66dvh] space-y-1 overflow-y-auto pb-1">
        <Field label="Date">{(id) => <input id={id} type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />}</Field>
        <Field label="Advice">{(id) => <textarea id={id} className={textareaClass} value={advice} onChange={(e) => setAdvice(e.target.value)} />}</Field>
        <Field label="Plan" hint="What you'll do, and for how long. Follow it here, one change at a time.">
          {(id) => <textarea id={id} className={textareaClass} value={plan} onChange={(e) => setPlan(e.target.value)} />}
        </Field>
        <Field label="Next visit">{(id) => <input id={id} type="date" className={inputClass} value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button
          variant="primary"
          onClick={() => void saveDermVisit({ id: visit?.id, day, advice: advice.trim(), plan: plan.trim(), nextVisit: nextVisit || undefined }).then(onClose)}
        >
          Save
        </Button>
        {visit && (
          <Button variant="ghost" onClick={() => void deleteDermVisit(visit.id).then(onClose)}>
            Delete
          </Button>
        )}
      </div>
    </Sheet>
  )
}

export function SkinTab() {
  const { settings, today } = useAppData()
  const [productSheet, setProductSheet] = useState<SkinProduct | 'new' | null>(null)
  const [dermSheet, setDermSheet] = useState<DermVisit | 'new' | null>(null)
  const data = useLiveQuery(async () => {
    const weekStart = startOfWeek(today, settings.weekStartsOn)
    const [areas, habits, products, visits, photos, tasks, logs] = await Promise.all([
      db.areas.toArray(),
      db.habits.toArray(),
      db.skinProducts.toArray(),
      db.dermVisits.orderBy('day').reverse().toArray(),
      db.measurements.where('kind').equals('skinPhoto').toArray(),
      db.tasks.where('kind').equals('todo').toArray(),
      db.habitLogs.where('day').between(weekStart, today, true, true).toArray(),
    ])
    // The skin area and its sunscreen habit, if the plan has them.
    const area = areas.find((a) => a.charts === 'skin')
    const sunscreen = habits.find((h) => h.role === 'sunscreen')
    return {
      area,
      products,
      visits,
      photos,
      todos: area ? tasks.filter((t) => t.areaId === area.id) : [],
      sunscreenDays: sunscreen ? logs.filter((l) => l.habitId === sunscreen.id && l.status !== 'skip').length : null,
    }
  }, [today, settings.weekStartsOn])
  if (!data) return null

  const schedule = skinPhotoSchedule(settings.planStart, settings.planEnd)
  const taken = new Set(data.photos.map((p) => p.id.split('|')[1]))
  const visibleSchedule = schedule.filter((s) => s.day <= addDays(today, 31))
  const products = [...data.products].sort((a, b) => ((a.startDay ?? '') < (b.startDay ?? '') ? 1 : -1))

  return (
    <div className="space-y-6">
      {data.area && <AreaNotes area={data.area} />}

      {data.sunscreenDays !== null && (
        <Card>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{data.sunscreenDays}</span>
            <span className="text-sm text-muted">sunscreen days this week</span>
          </div>
        </Card>
      )}

      <Section title="Photo checkpoints">
        <Card>
          <p className="mb-2 text-sm text-muted">Same place, same light, no filter. Photos stay on your phone; the app stores only the checkmark.</p>
          <ul className="divide-y divide-line">
            {visibleSchedule.map((s) => {
              const done = taken.has(s.day)
              const due = !done && s.day <= today
              return (
                <li key={s.day}>
                  <label className="flex min-h-12 items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-accent)]"
                      checked={done}
                      disabled={s.day > today}
                      onChange={(e) => void (e.target.checked ? saveMeasurement('skinPhoto', s.day, today, 1) : deleteMeasurement('skinPhoto', s.day))}
                    />
                    <span className="flex-1">{s.label}</span>
                    <span className="text-sm text-faint">{formatDay(s.day, { day: 'numeric', month: 'short' })}</span>
                    {due && <Badge tone="warn">Due</Badge>}
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
      </Section>

      {data.todos.length > 0 && (
        <Section title="To-dos">
          <Card className="divide-y divide-line">
            {data.todos.map((t) => (
              <div key={t.id}>
                <TaskCheck task={t} />
                {t.dueDay && <p className="-mt-1 pb-2 pl-8 text-xs text-faint">from {formatDay(t.dueDay, { day: 'numeric', month: 'short' })}</p>}
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section
        title="Products"
        action={
          <Button size="sm" variant="ghost" onClick={() => setProductSheet('new')}>
            <Icon name="plus" size={16} /> Product
          </Button>
        }
      >
        <Card>
          {products.length === 0 ? (
            <p className="text-sm text-muted">Add your cleanser and sunscreen as the starting routine. After that, one new product at a time, 4 weeks apart, patch-tested.</p>
          ) : (
            <ul className="divide-y divide-line">
              {products.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex min-h-12 w-full items-center gap-2 py-2 text-left" onClick={() => setProductSheet(p)}>
                    <span className="min-w-0 flex-1">
                      <span className="block">{p.name}</span>
                      <span className="text-xs text-faint">
                        {ROLES.find((r) => r.value === p.role)?.label}
                        {p.startDay ? ` · since ${formatDay(p.startDay, { day: 'numeric', month: 'short' })}` : ''}
                        {p.baseline ? ' · starting routine' : ''}
                      </span>
                    </span>
                    {p.stoppedDay ? (
                      <Badge>Stopped</Badge>
                    ) : p.patchTest === 'failed' ? (
                      <Badge tone="bad">Reacted</Badge>
                    ) : p.patchTest === 'passed' ? (
                      <Badge tone="ok">Patch OK</Badge>
                    ) : (
                      <Badge tone="warn">Patch test</Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Section
        title="Dermatologist"
        action={
          <Button size="sm" variant="ghost" onClick={() => setDermSheet('new')}>
            <Icon name="plus" size={16} /> Visit
          </Button>
        }
      >
        <Card>
          {data.visits.length === 0 ? (
            <p className="text-sm text-muted">If the week-12 photos show no visible change, book a dermatologist and follow their plan here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.visits.map((v) => (
                <li key={v.id}>
                  <button type="button" className="w-full py-3 text-left" onClick={() => setDermSheet(v)}>
                    <span className="block font-medium">{fmt(v.day)}</span>
                    {v.plan && <span className="block text-sm text-muted">Plan: {v.plan}</span>}
                    {v.nextVisit && <span className="block text-xs text-faint">Next visit {fmt(v.nextVisit)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      {productSheet && <ProductSheet product={productSheet === 'new' ? undefined : productSheet} products={data.products} onClose={() => setProductSheet(null)} />}
      {dermSheet && <DermSheet visit={dermSheet === 'new' ? undefined : dermSheet} onClose={() => setDermSheet(null)} />}
    </div>
  )
}
