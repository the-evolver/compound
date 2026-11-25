import { useMemo } from 'react'
import { useAppData } from '../../app/AppData'

/** Reads theme colour tokens (CSS custom properties) as hex, for SVG chart attributes. */
export function useThemeColors<K extends string>(names: readonly K[]): Record<K, string> {
  const { settings } = useAppData()
  const key = names.join('|')
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--color-${n}`).trim()])) as Record<K, string>
    // `key` stands in for `names`; the theme is a dependency so colours are re-read when it changes.
  }, [key, settings.theme])
}
