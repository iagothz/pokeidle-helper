import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/index.{ts,tsx}', 'src/**/*.d.ts'],
      thresholds: {
        'src/domain/**': { lines: 85, functions: 85, branches: 75, statements: 85 },
        'src/analysis/**': { lines: 85, functions: 85, branches: 75, statements: 85 },
        'src/capture/**': { lines: 85, functions: 85, branches: 75, statements: 85 },
      },
    },
  },
});
