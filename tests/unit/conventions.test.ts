import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('code conventions', () => {
  it('writes effects with a block body', () => {
    // `useEffect(() => window.scrollTo(0, 0))` returns a Promise in newer
    // browsers, which React treats as a broken cleanup and crashes on.
    const offenders = sourceFiles('src').flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
        .filter(({ line }) => /use(Layout)?Effect\(\s*(async\s*)?\(\s*\)\s*=>\s*[^{\s]/.test(line))
        .map(({ at }) => at),
    )
    expect(offenders).toEqual([])
  })

  it('reads the time only through the app clock', () => {
    const offenders = sourceFiles('src')
      .filter((file) => !file.replace(/\\/g, '/').endsWith('domain/time/clock.ts'))
      .filter((file) => /Date\.now\(\)|new Date\(\)/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
