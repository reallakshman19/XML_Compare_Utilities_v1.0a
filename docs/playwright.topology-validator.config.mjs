import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['topology-trace-validator.spec.mjs', 'topology-svg-edit-routing.spec.mjs', 'topology-inputxml-native-enrichment.spec.mjs', 'topology-edit-draft.spec.mjs', 'topology-checker-dashboard.spec.mjs', 'topology-autofix-commit-proof.spec.mjs', 'topology-autofix-1885-qualification.spec.mjs', 'topology-staged-export-1885-qualification.spec.mjs'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/topology-trace-validator',
  preserveOutput: 'always',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {},
    viewport: { width: 1600, height: 1000 },
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python -m http.server 4174 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4174/tests/browser/topology-trace-validator-fixture.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
