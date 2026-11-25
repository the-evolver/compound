import { DAY_MS } from './time/day'

export type BackupState =
  | { kind: 'never' }
  | { kind: 'fresh'; days: number }
  | { kind: 'stale'; days: number }

/** How old the last backup is; stale once it is older than the nudge threshold. */
export function backupState(lastExportAt: number | undefined, now: number, nudgeDays: number): BackupState {
  if (lastExportAt === undefined) return { kind: 'never' }
  const days = Math.max(0, Math.floor((now - lastExportAt) / DAY_MS))
  return days >= nudgeDays ? { kind: 'stale', days } : { kind: 'fresh', days }
}

export function describeBackup(state: BackupState): string {
  switch (state.kind) {
    case 'never':
      return 'No backup yet'
    case 'fresh':
    case 'stale':
      return state.days === 0 ? 'Last backup: today' : state.days === 1 ? 'Last backup: yesterday' : `Last backup: ${state.days} days ago`
  }
}

/** Small, stable fingerprint of a string (FNV-1a, 32-bit), for "has this changed?" checks. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
