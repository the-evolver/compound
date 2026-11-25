import type { Amount } from '../../model/habits'
import { inputClass, Segmented } from '../../ui/fields'

function NumberBox({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        className={`${inputClass} mt-1`}
        inputMode="decimal"
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(',', '.')))}
      />
    </label>
  )
}

export function isValidAmount(a: Amount): boolean {
  switch (a.kind) {
    case 'fixed':
      return Number.isFinite(a.value) && a.value > 0
    case 'weekdayWeekend':
      return Number.isFinite(a.weekday) && Number.isFinite(a.weekend) && a.weekday > 0 && a.weekend > 0
    case 'perKgBodyweight':
      return Number.isFinite(a.perKg) && a.perKg > 0
  }
}

/** Edits a target amount: one number, weekday/weekend numbers, or per kg of bodyweight. */
export function AmountEditor({ value, onChange, allowPerKg, unit }: { value: Amount; onChange: (a: Amount) => void; allowPerKg: boolean; unit: string }) {
  const base = value.kind === 'fixed' ? value.value : value.kind === 'weekdayWeekend' ? value.weekday : value.perKg
  const options = [
    { value: 'fixed' as const, label: 'Same daily' },
    { value: 'weekdayWeekend' as const, label: 'Weekday/end' },
    ...(allowPerKg ? [{ value: 'perKgBodyweight' as const, label: 'Per kg' }] : []),
  ]
  const switchKind = (kind: Amount['kind']) => {
    if (kind === 'fixed') onChange({ kind, value: base })
    else if (kind === 'weekdayWeekend') onChange({ kind, weekday: base, weekend: base })
    else onChange({ kind, perKg: 1.6 })
  }
  return (
    <div className="space-y-2">
      <Segmented label="Target type" value={value.kind} options={options} onChange={switchKind} />
      {value.kind === 'fixed' && <NumberBox label={unit ? `Amount (${unit})` : 'Amount'} value={value.value} onChange={(n) => onChange({ ...value, value: n })} />}
      {value.kind === 'weekdayWeekend' && (
        <div className="grid grid-cols-2 gap-2">
          <NumberBox label="Weekdays" value={value.weekday} onChange={(n) => onChange({ ...value, weekday: n })} />
          <NumberBox label="Weekends" value={value.weekend} onChange={(n) => onChange({ ...value, weekend: n })} />
        </div>
      )}
      {value.kind === 'perKgBodyweight' && <NumberBox label={`${unit} per kg bodyweight`} value={value.perKg} onChange={(n) => onChange({ ...value, perKg: n })} />}
    </div>
  )
}
