import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { existsSync } from 'node:fs';

// Load local env files the same way Next does, so unit tests that touch
// src/lib/env.ts see the same values as the app.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* validated by scripts/check-env.mjs */
    }
  }
}

afterEach(() => {
  cleanup();
});
