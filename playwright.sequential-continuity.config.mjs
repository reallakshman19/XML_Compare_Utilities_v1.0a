import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'sequential-continuity-geometry.spec.mjs',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4179', headless: true },
  webServer: {
    command: 'python3 -m http.server 4179 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
  },
  reporter: [['list']],
});
