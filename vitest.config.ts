import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so tests never load the PWA plugin.
// Domain and database tests run in Node; fake-indexeddb stands in for the
// browser's IndexedDB.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
