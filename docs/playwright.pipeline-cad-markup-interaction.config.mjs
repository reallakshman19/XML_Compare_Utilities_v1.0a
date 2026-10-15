import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:'pipeline-cad-markup-interaction.spec.mjs',timeout:60_000,
  expect:{timeout:10_000},fullyParallel:false,workers:1,retries:0,
  outputDir:'test-results/pipeline-cad-markup-interaction',
  reporter:[['list'],['json',{outputFile:'artifacts/pipeline-cad-markup-interaction/browser-results.json'}]],
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',viewport:{width:1440,height:1100},screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:'python3 -m http.server 4173 --bind 127.0.0.1',url:'http://127.0.0.1:4173/tests/browser/pipeline-cad-markup-interaction-fixture.html',reuseExistingServer:!process.env.CI,timeout:120_000},
});