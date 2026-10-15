import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'sequential-scoped-edit-3d.spec.mjs',
    'sequential-scoped-edit-3d-workbench.spec.mjs',
    'sequential-draft-edit-command-lifecycle.spec.mjs',
  ],
  timeout: 45_000, expect: { timeout: 8_000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: 'test-results/sequential-scoped-edit-3d', reporter: [['list'], ['json', { outputFile: 'sequential-scoped-edit-3d-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', viewport: { width: 1600, height: 1100 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1', url: 'http://127.0.0.1:4173/tests/browser/sequential-engineering-svg-preview-fixture.html', reuseExistingServer: false, timeout: 120_000 },
});
