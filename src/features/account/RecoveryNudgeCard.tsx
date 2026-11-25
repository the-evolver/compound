import { Link } from 'react-router'
import { useAuth } from '../../app/Auth'
import { Card } from '../../ui/primitives'

/** Today card for accounts made before recovery codes: until there is one, a forgotten password loses everything. */
export function RecoveryNudgeCard() {
  const { account } = useAuth()
  if (account.recovery) return null
  return (
    <Card className="space-y-3 border border-warn/30">
      <div>
        <div className="font-medium">Make a recovery code</div>
        <p className="text-sm text-muted">Without one, a forgotten password means your data is lost for good. It takes a minute.</p>
      </div>
      <Link
        to="/settings?section=account"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-surface-2 px-4 font-medium"
      >
        Set it up
      </Link>
    </Card>
  )
}
