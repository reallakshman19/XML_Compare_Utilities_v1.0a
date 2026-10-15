import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'cii-writer2-multisource-retained-benchmark.spec.mjs',
    'cii-writer2-multisource-retained-tile-ui.spec.mjs',
    'cii-writer2-multisource-generic-review-only.spec.mjs',
  ],
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/cii-writer2-retained-browser',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/browser/cii-writer2-static-server.mjs 4174',
    url: 'http://127.0.0.1:4174/tests/browser/cii-writer2-bridge-fixture.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
