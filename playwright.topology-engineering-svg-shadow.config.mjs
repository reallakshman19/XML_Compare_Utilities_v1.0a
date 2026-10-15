import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['topology-engineering-svg-shadow.spec.mjs'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/topology-engineering-svg-shadow',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4190',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1800, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4190 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4190/tests/browser/topology-engineering-svg-shadow-fixture.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
