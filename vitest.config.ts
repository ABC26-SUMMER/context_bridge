import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/server/**/*.test.ts', 'src/data/**/*.test.ts'],
    environment: 'node',
  },
});
