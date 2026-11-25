import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'sm'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold active:opacity-80',
  secondary: 'bg-surface-2 text-text active:bg-line',
  outline: 'border border-line text-muted active:bg-surface-2',
  ghost: 'bg-transparent text-muted active:bg-surface-2',
  danger: 'bg-bad/15 text-bad active:bg-bad/25',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-12 px-4 text-base rounded-xl',
  sm: 'min-h-10 px-3 text-sm rounded-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 select-none disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-surface p-4', className)}>{children}</div>
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  accent: 'bg-accent/15 text-accent',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone])}>{children}</span>
}

/** A label/value line inside a card. */
export function Row({ label, value, hint }: { label: ReactNode; value?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div>{label}</div>
        {hint && <div className="text-sm text-muted">{hint}</div>}
      </div>
      {value !== undefined && <div className="shrink-0 text-right text-muted">{value}</div>}
    </div>
  )
}
