/**
 * Database versions, oldest first. Never edit a version once it has shipped:
 * add a new one.
 *
 * - `stores`: Dexie index specs for tables added or changed in this version
 *   (null deletes a table). The first entry of a spec is the primary key.
 * - `rows`: per-row migrations for this version. They run on the live
 *   database when the app upgrades, and on older backup files when they are
 *   imported, so an old backup always loads into a new app.
 *
 * Example of a later change:
 *   { version: 2,
 *     stores: { drills: 'id, day, topicId' },
 *     rows: { drills: (row) => ({ ...row, topicId: row.topicId ?? undefined }) } }
 */
export type RowMigration = (row: Record<string, unknown>) => Record<string, unknown>

export interface DbVersion {
  version: number
  stores: Record<string, string | null>
  rows?: Record<string, RowMigration>
}

const V2_AREA_COLORS: Record<string, string> = {
  '#60a5fa': '#338ced', // Career
  '#fb923c': '#e76624', // Body
  '#f472b6': '#00a888', // Skin
  '#a78bfa': '#9887ef', // Voice
}

const V3_CHART_IDS = new Set(['career', 'body', 'skin', 'voice'])

export const DB_VERSIONS: readonly DbVersion[] = [
  {
    version: 1,
    stores: {
      kv: 'key',
      areas: 'id, order',
      phases: 'id, start',
      checkpoints: 'id, areaId, day',
      tasks: 'id, kind, weekStart, sourceId, dueDay',
      habits: 'id, areaId, order',
      habitLogs: 'id, habitId, day',
      dayEntries: 'day',
      subjects: 'id, order, status',
      topics: 'id, subjectId, status',
      topicEvents: 'id, topicId, subjectId, day',
      studySessions: 'id, day, subjectId',
      dsaProblems: 'id, day, srs.dueDay',
      dsaReviews: 'id, problemId, day',
      mocks: 'id, day, type',
      applications: 'id, stage, nextActionDay, updatedAt',
      exercises: 'id, name',
      workoutTemplates: 'id, order',
      workoutSessions: 'id, day, templateId',
      measurements: 'id, day, kind, [kind+day]',
      skinProducts: 'id, startDay',
      dermVisits: 'id, day',
      drills: 'id, day',
      peopleLogs: 'id, weekStart',
      weeklyReviews: 'id, weekStart',
      monthlyReviews: 'id, month',
    },
  },
  {
    // Area colours replaced with a colour-blind-safe set (blue/violet were
    // indistinguishable for deuteranopes). Only untouched defaults change.
    version: 2,
    stores: {},
    rows: {
      areas: (row) => ({ ...row, color: V2_AREA_COLORS[String(row.color).toLowerCase()] ?? row.color }),
    },
  },
  {
    // Exercise names are no longer indexed, so they are encrypted with the
    // rest of the row (indexed fields must stay readable). Areas and habits
    // get explicit `charts` / `role` fields instead of meaning carried by ids.
    version: 3,
    stores: { exercises: 'id' },
    rows: {
      exercises: (row) => row, // rewritten, so no readable copy of the name is left
      areas: (row) => (row.charts || !V3_CHART_IDS.has(String(row.id)) ? row : { ...row, charts: row.id }),
      habits: (row) => (row.role || row.id !== 'habit:sunscreen-am' ? row : { ...row, role: 'sunscreen' }),
    },
  },
]

export const LATEST_DB_VERSION = DB_VERSIONS[DB_VERSIONS.length - 1]!.version

/** The full index spec of every table that exists at a version. */
export function storesAt(version: number, versions: readonly DbVersion[] = DB_VERSIONS): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of versions) {
    if (v.version > version) break
    for (const [table, spec] of Object.entries(v.stores)) {
      if (spec === null) delete out[table]
      else out[table] = spec
    }
  }
  return out
}

/** The primary-key field of a table, e.g. "id", "key" or "day". */
export function primaryKeyOf(table: string, version = LATEST_DB_VERSION): string {
  const spec = storesAt(version)[table]
  if (!spec) throw new Error(`Unknown table: ${table}`)
  return spec.split(',')[0]!.trim().replace(/^[&+]+/, '')
}

/**
 * Upgrades the tables of a backup taken at `fromVersion` to the latest
 * version by running every later version's row migrations in order.
 */
export function migrateTables(
  tables: Record<string, Record<string, unknown>[]>,
  fromVersion: number,
  versions: readonly DbVersion[] = DB_VERSIONS,
): Record<string, Record<string, unknown>[]> {
  let out = { ...tables }
  for (const v of versions) {
    if (v.version <= fromVersion) continue
    for (const [table, spec] of Object.entries(v.stores)) {
      if (spec === null) {
        const { [table]: _removed, ...rest } = out
        out = rest
      } else if (!out[table]) {
        out[table] = []
      }
    }
    for (const [table, migrate] of Object.entries(v.rows ?? {})) {
      out[table] = (out[table] ?? []).map(migrate)
    }
  }
  return out
}
