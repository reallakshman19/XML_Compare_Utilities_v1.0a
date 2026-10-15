import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'cii-writer2-v14-generated-bridge.spec.mjs',
    'cii-writer2-v14-generated-bridge-1042.spec.mjs',
    'cii-writer2-v14-native-bridge.spec.mjs',
  ],
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/cii-writer2-browser',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/cii-writer2-browser', open: 'never' }],
    ['json', { outputFile: 'artifacts/cii-writer2-browser-results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/tests/browser/cii-writer2-bridge-fixture.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
