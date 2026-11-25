import { useEffect, useId, useState, type ReactNode } from 'react'
import { cx } from './primitives'

export const inputClass = 'min-h-12 w-full rounded-xl bg-surface-2 px-3 text-base text-text placeholder:text-faint'

/** A labelled setting. The control goes below the label on narrow screens. */
export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1.5 py-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-sm text-bad">{error}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  )
}

/**
 * A text-like input that saves when you leave it (or press Enter). `commit`
 * returns an error message to reject the value, or nothing to accept it.
 */
export function CommitInput({
  id,
  value,
  commit,
  type = 'text',
  placeholder,
  inputMode,
}: {
  id?: string
  value: string
  commit: (next: string) => Promise<string | void> | string | void
  type?: 'text' | 'date' | 'time'
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
}) {
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(value)
  }, [value])

  const save = async () => {
    if (text === value) return setError(null)
    const problem = await commit(text)
    if (problem) {
      setError(problem)
      setText(value)
    } else setError(null)
  }

  return (
    <>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        className={inputClass}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {error && <p className="text-sm text-bad">{error}</p>}
    </>
  )
}

export const textareaClass = 'min-h-24 w-full rounded-xl bg-surface-2 px-3 py-2.5 text-base text-text placeholder:text-faint'

export function Select<T extends string | number>({
  id,
  value,
  options,
  onChange,
}: {
  id?: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <select
      id={id}
      className={inputClass}
      value={String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value)
        if (picked) onChange(picked.value)
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-10 rounded-lg text-sm', o.value === value ? 'bg-surface font-semibold text-text' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
