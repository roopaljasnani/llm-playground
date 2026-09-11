import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { llmProxy } from './server/llm-proxy.ts';

export default defineConfig({
  plugins: [react(), llmProxy()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
