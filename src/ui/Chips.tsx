import { useState } from 'react'
import { inputClass } from './fields'
import { cx } from './primitives'

const chip = (on: boolean) =>
  cx('min-h-10 rounded-full px-3.5 text-sm', on ? 'bg-accent font-medium text-accent-ink' : 'bg-surface-2 text-muted active:bg-line')

/** One optional choice from a few. Tapping the selected chip clears it. */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T | undefined
  onChange: (value: T | undefined) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={chip(o.value === value)} onClick={() => onChange(o.value === value ? undefined : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tags: tap known ones, or type new ones (comma or Enter adds). */
export function TagInput({ value, suggestions, onChange, label }: { value: string[]; suggestions: string[]; onChange: (tags: string[]) => void; label: string }) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const tags = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    if (tags.length) onChange([...new Set([...value, ...tags])])
    setText('')
  }
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])
  const shown = [...new Set([...value, ...suggestions])].slice(0, 16)
  return (
    <div className="space-y-2">
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
          {shown.map((t) => (
            <button key={t} type="button" aria-pressed={value.includes(t)} className={chip(value.includes(t))} onClick={() => toggle(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      <input
        className={inputClass}
        value={text}
        placeholder="Add a pattern, e.g. sliding window"
        aria-label={`New ${label.toLowerCase()}`}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value)
          else setText(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
    </div>
  )
}
