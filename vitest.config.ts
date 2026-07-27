import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Vitest needs the same `@/…` path alias tsconfig gives the app, otherwise any
// module under test that imports a sibling by alias fails to resolve. Tests ran
// without this only because none of them had crossed an aliased import yet.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
