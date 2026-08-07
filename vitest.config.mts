import { defineConfig } from 'vitest/config'
import path from 'node:path'

const rootDir = import.meta.dirname

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, '.'),
    },
  },
})
