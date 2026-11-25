import { useEffect, useState } from 'react'
import { setDayNote } from '../../db/actions/daily'
import type { DayKey } from '../../domain/time/day'

export function DayNote({ day, note }: { day: DayKey; note: string }) {
  const [text, setText] = useState(note)
  useEffect(() => {
    setText(note)
  }, [note, day])

  const save = () => {
    if (text.trim() !== note) void setDayNote(day, text)
  }

  return (
    <label className="block">
      <span className="sr-only">Note for today</span>
      <input
        className="min-h-12 w-full rounded-2xl bg-surface px-4 text-base text-text placeholder:text-faint"
        placeholder="One line about today (optional)"
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}
