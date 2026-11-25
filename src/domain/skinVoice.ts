import type { Drill, SkinProduct } from '../model/skinVoice'
import { addDays, daysBetween, makeDay, type DayKey } from './time/day'

// ── Skin ────────────────────────────────────────────────────

export const NEW_PRODUCT_GAP_DAYS = 28

/**
 * One new product at a time, at least 4 weeks apart. The starting routine
 * (baseline products) doesn't count.
 */
export function newProductCheck(
  products: readonly SkinProduct[],
  candidate: { id?: string; startDay: DayKey; baseline: boolean },
): { ok: true } | { ok: false; blockedBy: SkinProduct; earliest: DayKey } {
  if (candidate.baseline) return { ok: true }
  const others = products.filter((p) => p.id !== candidate.id && !p.baseline && p.startDay)
  for (const p of others) {
    if (Math.abs(daysBetween(p.startDay!, candidate.startDay)) < NEW_PRODUCT_GAP_DAYS) {
      const latest = others.reduce((m, o) => (o.startDay! > m ? o.startDay! : m), p.startDay!)
      return { ok: false, blockedBy: p, earliest: addDays(latest, NEW_PRODUCT_GAP_DAYS) }
    }
  }
  return { ok: true }
}

function addMonths(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const total = (m - 1) + n
  const year = y + Math.floor(total / 12)
  const month = (total % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return makeDay(year, month, Math.min(d, last))
}

/** Skin photo checkpoints: weeks 0, 4, 8, 12, then monthly until the plan ends. */
export function skinPhotoSchedule(start: DayKey, end: DayKey): Array<{ day: DayKey; label: string }> {
  const out = [0, 4, 8, 12].map((w) => ({ day: addDays(start, w * 7), label: `Week ${w}` }))
  const week12 = addDays(start, 84)
  for (let i = 1; ; i++) {
    const day = addMonths(week12, i)
    if (day > end) break
    out.push({ day, label: `Month ${3 + i}` })
  }
  return out.filter((x) => x.day <= end)
}

// ── Voice ───────────────────────────────────────────────────

export function fillersPer2Min(d: Pick<Drill, 'fillers' | 'seconds'>): number {
  return d.seconds > 0 ? Math.round((d.fillers / d.seconds) * 120 * 10) / 10 : 0
}

export function rubricAverage(d: Pick<Drill, 'ratings'>): number {
  const r = d.ratings
  return (r.clarity + r.structure + r.pace + r.confidence) / 4
}

export const BEHAVIOURAL_PROMPTS = [
  'Tell me about a migration or big change you led end to end.',
  'Tell me about a production issue you debugged. How did you find the root cause?',
  'Tell me about a time you mentored someone.',
  'Tell me about a time you disagreed with a PM or QA, and how you resolved it.',
  'Tell me about a design you presented. What pushback did you get?',
  'Tell me about a time you missed a deadline or made a mistake.',
  'Tell me about a time you influenced a decision without authority.',
  'Tell me about the hardest technical problem you have solved.',
] as const

export const INTRO_PROMPT = 'Tell me about yourself (2 minutes).'

export interface PromptSuggestion {
  text: string
  source: 'topic' | 'intro' | 'behavioural'
}

/** Prompts for today's drill: explain today's study topic, the intro, and a rotating behavioural question. */
export function suggestPrompts(day: DayKey, topicTitle: string | undefined): PromptSuggestion[] {
  const out: PromptSuggestion[] = []
  if (topicTitle) out.push({ text: `Explain ${topicTitle} simply, as if to a 12-year-old.`, source: 'topic' })
  out.push({ text: INTRO_PROMPT, source: 'intro' })
  const index = Math.abs(daysBetween('2026-01-01', day)) % BEHAVIOURAL_PROMPTS.length
  out.push({ text: BEHAVIOURAL_PROMPTS[index]!, source: 'behavioural' })
  return out
}

export const PEOPLE_QUESTS = [
  { id: 'new-conversation', label: 'Start a conversation with someone new' },
  { id: 'three-follow-ups', label: 'Ask 3 follow-up questions before talking about myself' },
  { id: 'use-names', label: "Use people's names" },
  { id: 'compliment', label: 'Give one specific, genuine compliment' },
  { id: 'share-update', label: 'Share a short update or demo in a team meeting' },
] as const
