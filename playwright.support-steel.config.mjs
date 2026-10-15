import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'support-steel-preview-staleness.spec.mjs',
    'support-report-typicality.spec.mjs',
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['json', { outputFile: 'artifacts/support-steel-browser-results.json' }],
    ['html', { outputFolder: 'playwright-report/support-steel', open: 'never' }],
  ],
  outputDir: 'test-results/support-steel',
  use: {
    baseURL: 'http://127.0.0.1:4182',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python -m http.server 4182 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4182/index.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
