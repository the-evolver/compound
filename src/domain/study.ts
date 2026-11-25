import { TOPIC_STATUSES, type Topic, type TopicStatus } from '../model/career'

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  can_explain: 'Can explain it simply',
  under_pressure: 'Can do it under time pressure',
}

export const TOPIC_STATUS_SHORT: Record<TopicStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  can_explain: 'Can explain',
  under_pressure: 'Under pressure',
}

export function sortTopics<T extends Pick<Topic, 'order'>>(topics: readonly T[]): T[] {
  return [...topics].sort((a, b) => a.order - b.order)
}

/**
 * The topic to study next: the first one (in order) still being learned,
 * otherwise the first not started. Topics you can already explain are done
 * for the study block; time pressure is practised in mocks.
 */
export function nextTopic<T extends Pick<Topic, 'order' | 'status'>>(topics: readonly T[]): T | undefined {
  const sorted = sortTopics(topics)
  return sorted.find((t) => t.status === 'learning') ?? sorted.find((t) => t.status === 'not_started')
}

export function statusCounts(topics: readonly Pick<Topic, 'status'>[]): Record<TopicStatus, number> {
  const counts = Object.fromEntries(TOPIC_STATUSES.map((s) => [s, 0])) as Record<TopicStatus, number>
  for (const t of topics) counts[t.status]++
  return counts
}

export interface ParsedTopic {
  title: string
  group: string
}

/**
 * Turns pasted text into topics, one per line. Bullets, numbering and
 * checkboxes are stripped. A line ending in ":" or starting with "#" starts
 * a group ("Patterns:", "## Machine coding").
 */
export function parseTopicLines(text: string, initialGroup = ''): ParsedTopic[] {
  const out: ParsedTopic[] = []
  let group = initialGroup
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line) continue
    if (/^#+\s*/.test(line)) {
      group = line.replace(/^#+\s*/, '').replace(/:$/, '').trim()
      continue
    }
    line = line
      .replace(/^[-*•·–—>]+\s*/, '')
      .replace(/^\[[ xX]?\]\s*/, '')
      .replace(/^\(?\d+[.)\]]\s*/, '')
      .replace(/^[a-zA-Z][.)]\s+/, '')
      .trim()
    if (!line) continue
    if (line.endsWith(':')) {
      group = line.slice(0, -1).trim()
      continue
    }
    out.push({ title: line, group })
  }
  return out
}
