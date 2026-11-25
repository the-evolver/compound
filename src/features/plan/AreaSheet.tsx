import { useEffect, useState } from 'react'
import { areaInUse, deleteArea, saveArea, setAreaArchived } from '../../db/actions/plan'
import type { Area } from '../../model/core'
import { Field, inputClass } from '../../ui/fields'
import { Button, cx } from '../../ui/primitives'
import { Sheet } from '../../ui/Sheet'

/*
 * Area colours, in the order to use them. The first four were checked as a
 * set for colour-blind and normal vision (dark and light); the rest are
 * extra hues from the same palette.
 */
export const AREA_COLORS = [
  { hex: '#338ced', name: 'Blue' },
  { hex: '#e76624', name: 'Orange' },
  { hex: '#00a888', name: 'Aqua' },
  { hex: '#9887ef', name: 'Violet' },
  { hex: '#e24d8b', name: 'Magenta' },
] as const

export function AreaSheet({ area, takenColors, onClose }: { area?: Area; takenColors: string[]; onClose: () => void }) {
  const firstFree = AREA_COLORS.find((c) => !takenColors.includes(c.hex))?.hex ?? AREA_COLORS[0].hex
  const [name, setName] = useState(area?.name ?? '')
  const [goal, setGoal] = useState(area?.goal ?? '')
  const [color, setColor] = useState<string>(area?.color ?? firstFree)
  const [inUse, setInUse] = useState<boolean | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (area) void areaInUse(area.id).then(setInUse)
  }, [area])

  return (
    <Sheet title={area ? `Edit ${area.name}` : 'New area'} onClose={onClose}>
      <div className="max-h-[66dvh] space-y-1 overflow-y-auto pb-1">
        <Field label="Name" hint="e.g. Career, Health, Learning">
          {(id) => <input id={id} className={inputClass} autoFocus={!area} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Goal">{(id) => <input id={id} className={inputClass} value={goal} placeholder="What this area is for" onChange={(e) => setGoal(e.target.value)} />}</Field>
        <Field label="Colour" hint="Marks this area on Today and in charts.">
          {() => (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
              {AREA_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={color === c.hex}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => setColor(c.hex)}
                  className={cx('size-11 rounded-full ring-offset-2 ring-offset-surface', color === c.hex && 'ring-2 ring-text')}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          )}
        </Field>
      </div>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" disabled={!name.trim()} onClick={() => void saveArea({ id: area?.id, name: name.trim(), goal: goal.trim(), color }).then(onClose)}>
          {area ? 'Save' : 'Add area'}
        </Button>
        {area &&
          inUse !== null &&
          (inUse ? (
            <Button variant="ghost" onClick={() => void setAreaArchived(area.id, !area.archivedAt).then(onClose)}>
              {area.archivedAt ? 'Bring this area back' : 'Archive (hide it, keep its history)'}
            </Button>
          ) : confirm ? (
            <Button variant="danger" onClick={() => void deleteArea(area.id).then(onClose)}>
              Delete {area.name}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              Delete area…
            </Button>
          ))}
      </div>
    </Sheet>
  )
}
