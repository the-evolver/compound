import { lazy, type ComponentType } from 'react'
import type { IconName } from '../ui/icons'
import { TodayScreen } from '../features/today/TodayScreen'

/*
 * Every screen except Today loads on demand, so opening the app parses
 * as little as possible. All chunks are precached by the service worker,
 * so they still work offline.
 */
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const PlanScreen = named(() => import('../features/plan/PlanScreen'), 'PlanScreen')
const HabitEditorScreen = named(() => import('../features/habits/HabitEditorScreen'), 'HabitEditorScreen')
const LogsScreen = named(() => import('../features/logs/LogsScreen'), 'LogsScreen')
const WorkoutScreen = named(() => import('../features/workouts/WorkoutScreen'), 'WorkoutScreen')
const ReviewScreen = named(() => import('../features/review/ReviewScreen'), 'ReviewScreen')
const WeeklyReviewScreen = named(() => import('../features/review/WeeklyReviewScreen'), 'WeeklyReviewScreen')
const MonthlyReviewScreen = named(() => import('../features/review/MonthlyReviewScreen'), 'MonthlyReviewScreen')
const InsightsScreen = named(() => import('../features/insights/InsightsScreen'), 'InsightsScreen')
const SettingsScreen = named(() => import('../features/settings/SettingsScreen'), 'SettingsScreen')

export interface ScreenDef {
  path: string
  Component: ComponentType
  /** A bottom-navigation tab. Screens without one are reached from elsewhere. */
  nav?: { label: string; icon: IconName; order: number }
}

/**
 * Every screen in the app. Adding a screen means adding one entry here; the
 * router and the bottom navigation are built from this list, so a tab only
 * appears once its screen exists.
 */
export const SCREENS: readonly ScreenDef[] = [
  { path: '/', Component: TodayScreen, nav: { label: 'Today', icon: 'today', order: 0 } },
  { path: '/plan', Component: PlanScreen, nav: { label: 'Plan', icon: 'plan', order: 1 } },
  { path: '/logs', Component: LogsScreen, nav: { label: 'Logs', icon: 'logs', order: 2 } },
  { path: '/review', Component: ReviewScreen, nav: { label: 'Review', icon: 'review', order: 3 } },
  { path: '/insights', Component: InsightsScreen, nav: { label: 'Insights', icon: 'insights', order: 4 } },
  { path: '/review/week/:weekStart', Component: WeeklyReviewScreen },
  { path: '/review/month/:month', Component: MonthlyReviewScreen },
  { path: '/habits/:id', Component: HabitEditorScreen },
  { path: '/workout/:id', Component: WorkoutScreen },
  { path: '/settings', Component: SettingsScreen },
]

export const NAV_TABS = SCREENS.filter((s): s is ScreenDef & { nav: NonNullable<ScreenDef['nav']> } => !!s.nav).sort(
  (a, b) => a.nav.order - b.nav.order,
)
