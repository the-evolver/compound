import type { ComponentType } from 'react'
import { ApplicationsTab } from './ApplicationsTab'
import { DsaTab } from './DsaTab'
import { MocksTab } from './MocksTab'
import { BodyTab } from './BodyTab'
import { SkinTab } from './SkinTab'
import { SpeakingTab } from './SpeakingTab'
import { WorkoutsTab } from './WorkoutsTab'

/**
 * The Logs screen's tabs. A new log is one entry here; the screen and its
 * tab bar are built from this list.
 */
export interface LogTabDef {
  id: string
  label: string
  order: number
  Component: ComponentType
}

export const LOG_TABS: readonly LogTabDef[] = [
  { id: 'dsa', label: 'DSA', order: 0, Component: DsaTab },
  { id: 'workouts', label: 'Workouts', order: 1, Component: WorkoutsTab },
  { id: 'speaking', label: 'Speaking', order: 2, Component: SpeakingTab },
  { id: 'body', label: 'Body', order: 3, Component: BodyTab },
  { id: 'skin', label: 'Skin', order: 4, Component: SkinTab },
  { id: 'mocks', label: 'Mocks', order: 5, Component: MocksTab },
  { id: 'applications', label: 'Applications', order: 6, Component: ApplicationsTab },
]

/** Where each habit log source is logged, for "Log it" links on Today. */
export const LOG_SOURCE_ROUTES: Record<string, string> = {
  dsa: '/logs?tab=dsa',
  workout: '/logs?tab=workouts',
  drill: '/logs?tab=speaking',
  mock: '/logs?tab=mocks',
  applicationMoves: '/logs?tab=applications',
}
