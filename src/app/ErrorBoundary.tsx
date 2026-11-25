import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '../ui/primitives'

/** A screen's code couldn't be downloaded (usually: offline before it was cached). */
function isLoadError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(error.message)
}

function ErrorPanel({ error, onHome }: { error: Error; onHome: () => void }) {
  const [copied, setCopied] = useState(false)
  const details = `${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(1, 12).join('\n')}\n\nPage: ${window.location.hash || '#/'}\nApp: ${navigator.userAgent}`
  const loadError = isLoadError(error)
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 rounded-2xl bg-surface p-5">
      <h1 className="text-lg font-semibold">{loadError ? "This screen couldn't load" : 'Something went wrong on this screen'}</h1>
      <p className="text-sm text-muted">
        {loadError
          ? "Its code isn't on this device yet, probably because you're offline. Reconnect and reload."
          : "Your data is safe: everything is saved as you go. Reload to try again; if it keeps happening, copy the details below and share them."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button onClick={onHome}>Go to Today</Button>
      </div>
      <details className="text-sm">
        <summary className="min-h-10 cursor-pointer py-2 text-muted">Details</summary>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs text-muted">{details}</pre>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() => {
            void navigator.clipboard
              .writeText(details)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }}
        >
          {copied ? 'Copied' : 'Copy details'}
        </Button>
      </details>
    </div>
  )
}

interface Props {
  children: ReactNode
  /** When this changes (e.g. the screen), the boundary tries again. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/** Catches a crash in part of the app and shows what to do, instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen crashed', error, info.componentStack)
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  private goHome = () => {
    window.location.hash = '#/'
    this.setState({ error: null })
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <ErrorPanel error={this.state.error} onHome={this.goHome} />
      </div>
    )
  }
}
