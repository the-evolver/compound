import { useState } from 'react'
import { Button } from '../../ui/primitives'

/** Copy the summary (for WhatsApp) and, where supported, open the share sheet. */
export function ShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const canShare = typeof navigator.share === 'function'
  return (
    <div className="space-y-2">
      <div className={canShare ? 'grid grid-cols-2 gap-2' : 'grid'}>
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied('yes')
            } catch {
              setCopied('failed')
            }
          }}
        >
          {copied === 'yes' ? 'Copied' : 'Copy summary'}
        </Button>
        {canShare && (
          <Button
            onClick={() => {
              void navigator.share({ text }).catch(() => undefined)
            }}
          >
            Share…
          </Button>
        )}
      </div>
      {copied === 'failed' && <p className="text-sm text-warn">Couldn't copy automatically. Select the text below and copy it.</p>}
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs text-muted">{text}</pre>
    </div>
  )
}
