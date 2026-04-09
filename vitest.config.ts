import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
  resolve: {
    alias: {
      '@/convex': resolve(__dirname, './convex'),
      '@': resolve(__dirname, './src'),
    },
  },
});
