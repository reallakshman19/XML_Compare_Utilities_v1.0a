import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'engineering-svg-readonly-shell.spec.mjs',
    'engineering-svg-readonly-shell-lifecycle.spec.mjs',
  ],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  outputDir: 'test-results/engineering-svg-readonly-shell',
  use: {
    baseURL: 'http://127.0.0.1:4189',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4189 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
