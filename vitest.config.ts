import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/server/**/*.test.ts'],
    environment: 'node',
  },
});
