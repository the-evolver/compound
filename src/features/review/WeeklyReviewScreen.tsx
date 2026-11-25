import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAppData } from '../../app/AppData'
import { completeWeeklyReview, ensureWeeklyReview, saveWeeklyDraft } from '../../db/actions/review'
import { db } from '../../db/db'
import { loadWeeklyScoreboard } from '../../db/queries/review'
import { describeWeek, MISS_CAUSES, weeklyShareText, type WeeklyScoreboard } from '../../domain/review'
import { isDayKey } from '../../domain/time/day'
import type { Area } from '../../model/core'
import type { MissCause, WeeklyReview } from '../../model/review'
import { ChipSelect } from '../../ui/Chips'
import { inputClass, textareaClass } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Button, Card, cx } from '../../ui/primitives'
import { ScreenHeader } from '../../ui/ScreenHeader'
import { LagView, ScoreboardView } from './ScoreboardView'
import { ShareButtons } from './ShareButtons'
import { ReviewBackupCard } from '../backup/ReviewBackupCard'

const STEPS = ['Scoreboard', 'Lag check', 'Wins', 'Misses', 'One change', 'Commitments'] as const

function Steps({ step }: { step: number }) {
  return (
    <ol className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      {STEPS.map((s, i) => (
        <li key={s} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-surface-2')} />
      ))}
    </ol>
  )
}

function ReviewFlow({ review, board, areas }: { review: WeeklyReview; board: WeeklyScoreboard; areas: Area[] }) {
  const [step, setStep] = useState(Math.min(review.step, STEPS.length - 1))
  const [wins, setWins] = useState<string[]>(() => [...review.wins, '', '', ''].slice(0, 3))
  const [misses, setMisses] = useState(review.misses.length ? review.misses : [{ text: '', cause: 'time' as MissCause }])
  const [change, setChange] = useState(review.change)
  const [commitments, setCommitments] = useState(() =>
    areas.flatMap((a) => {
      const mine = review.commitments.filter((c) => c.areaId === a.id)
      return [0, 1].map((i) => ({ areaId: a.id, text: mine[i]?.text ?? '' }))
    }),
  )
  const [finished, setFinished] = useState(!!review.completedAt)

  const draft = { wins: wins.map((w) => w.trim()).filter(Boolean), misses: misses.filter((m) => m.text.trim()).map((m) => ({ ...m, text: m.text.trim() })), change: change.trim(), commitments }
  const go = async (next: number) => {
    await saveWeeklyDraft(review.id, { ...draft, step: next })
    setStep(next)
    window.scrollTo(0, 0)
  }
  const finish = async () => {
    await saveWeeklyDraft(review.id, { ...draft, step: STEPS.length - 1 })
    await completeWeeklyReview(review.id, board as unknown as Record<string, unknown>)
    setFinished(true)
    window.scrollTo(0, 0)
  }
  // Areas below 80% are offered as quick "misses".
  const weakHabits = board.areas.flatMap((a) => a.habits.filter((h) => h.compliance !== null && h.compliance < 0.8).map((h) => h.name))

  if (finished) {
    return (
      <div className="space-y-5">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-ok">
            <Icon name="check" /> <span className="font-semibold">Review done</span>
          </div>
          <p className="text-sm text-muted">Your commitments are on Today for next week. Send the summary to your accountability partner:</p>
        </Card>
        <ShareButtons text={weeklyShareText(draft, board, areas)} />
        <ReviewBackupCard />
        <Button variant="ghost" className="w-full" onClick={() => setFinished(false)}>
          Edit this review
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Steps step={step} />
      <h2 className="text-lg font-semibold">
        {step + 1}. {STEPS[step]}
      </h2>

      {step === 0 && <ScoreboardView board={board} />}
      {step === 1 && <LagView board={board} />}

      {step === 2 && (
        <Card className="space-y-2">
          <p className="text-sm text-muted">Up to three things that went well. Small counts.</p>
          {wins.map((w, i) => (
            <input key={i} className={inputClass} value={w} placeholder={`Win ${i + 1}`} aria-label={`Win ${i + 1}`} onChange={(e) => setWins(wins.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {weakHabits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {weakHabits
                .filter((name) => !misses.some((m) => m.text === name))
                .map((name) => (
                  <Button
                    key={name}
                    size="sm"
                    variant="outline"
                    onClick={() => setMisses([...misses.filter((m) => m.text.trim()), { text: name, cause: 'time' }])}
                  >
                    <Icon name="plus" size={14} /> {name}
                  </Button>
                ))}
            </div>
          )}
          {misses.map((m, i) => (
            <Card key={i} className="space-y-2">
              <input
                className={inputClass}
                value={m.text}
                placeholder="What slipped?"
                aria-label={`Miss ${i + 1}`}
                onChange={(e) => setMisses(misses.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
              <ChipSelect
                label={`Cause of miss ${i + 1}`}
                value={m.cause}
                options={MISS_CAUSES}
                onChange={(cause) => setMisses(misses.map((x, j) => (j === i ? { ...x, cause: cause ?? 'time' } : x)))}
              />
            </Card>
          ))}
          {misses.length < 6 && (
            <Button size="sm" variant="ghost" onClick={() => setMisses([...misses, { text: '', cause: 'time' }])}>
              <Icon name="plus" size={16} /> Another miss
            </Button>
          )}
        </div>
      )}

      {step === 4 && (
        <Card className="space-y-2">
          <p className="text-sm text-muted">One change for next week, written as an if-then: “When/After [cue] at [place], I will [action].”</p>
          <textarea className={textareaClass} value={change} aria-label="One change for next week" placeholder="After dinner, at my desk, I open the review queue before my phone." onChange={(e) => setChange(e.target.value)} />
        </Card>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <p className="px-1 text-sm text-muted">1–2 concrete commitments per area. They appear on Today next week.</p>
          {areas.map((a) => (
            <Card key={a.id} className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <span className="size-2.5 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                {a.name}
              </div>
              {commitments
                .map((c, i) => ({ c, i }))
                .filter(({ c }) => c.areaId === a.id)
                .map(({ c, i }, k) => (
                  <input
                    key={i}
                    className={inputClass}
                    value={c.text}
                    aria-label={`${a.name} commitment ${k + 1}`}
                    placeholder={k === 0 ? 'e.g. 10 DSA items, reviews first' : 'Optional second one'}
                    onChange={(e) => setCommitments(commitments.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  />
                ))}
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={step === 0} onClick={() => void go(step - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => void go(step + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void finish()}>
            Finish review
          </Button>
        )}
      </div>
    </div>
  )
}

export function WeeklyReviewScreen() {
  const { weekStart = '' } = useParams()
  const { settings, today } = useAppData()
  const valid = isDayKey(weekStart)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (valid) void ensureWeeklyReview(weekStart).then(() => setReady(true))
  }, [valid, weekStart])

  const data = useLiveQuery(async () => {
    if (!ready) return undefined
    const [review, areas] = await Promise.all([db.weeklyReviews.get(weekStart), db.areas.orderBy('order').toArray()])
    if (!review) return undefined
    const board = review.completedAt && review.snapshot.weekStart ? (review.snapshot as unknown as WeeklyScoreboard) : await loadWeeklyScoreboard(weekStart, today, settings.weekStartsOn)
    return { review, areas: areas.filter((a) => !a.archivedAt), board }
  }, [ready, weekStart, today, settings.weekStartsOn])

  return (
    <div className="space-y-5">
      <ScreenHeader title="Weekly review" subtitle={valid ? describeWeek(weekStart) : undefined} back="/review" />
      {!valid && <p className="text-muted">That week isn't valid.</p>}
      {/* Keyed on the review so the form starts from the saved draft exactly once. */}
      {data && <ReviewFlow key={data.review.id} review={data.review} board={data.board} areas={data.areas} />}
    </div>
  )
}
