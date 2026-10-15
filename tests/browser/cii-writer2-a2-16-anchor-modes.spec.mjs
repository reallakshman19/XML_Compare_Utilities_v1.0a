import {expect,test} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const S1=fileURLToPath(new URL('../../Benchmark/S1.CII',import.meta.url));
const S2=fileURLToPath(new URL('../../Benchmark/S2.CII',import.meta.url));
const S3=fileURLToPath(new URL('../../Benchmark/S3.CII',import.meta.url));
const TARGET=fileURLToPath(new URL('../../Benchmark/T.CII',import.meta.url));

test('A2-16 retains inactive automatic and manual evidence across UI switches, invalidates stale preview and restores both ledgers',async({page})=>{
 await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
 await page.evaluate(async()=>{
  localStorage.clear();
  const {installCiiWorkspaceTile}=await import('/tabs/cii-workspace/cii-workspace-tab.js');
  const host=document.createElement('section');host.setAttribute('data-ciiw-a216-host','1');
  document.body.append(host);installCiiWorkspaceTile(host);
 });
 async function openAndInspect(){
  await page.locator('[data-ciiw-open-writer2]').click();
  await page.locator('[data-ciiw-source]').setInputFiles([S1,S2,S3]);
  await page.locator('[data-ciiw-target]').setInputFiles(TARGET);
  await page.locator('[data-ciiw-inspect]').click();
  await expect(page.locator('[data-ciiw-ms-anchor-ledger="1"]')).toBeVisible({timeout:120000});
 }
 await openAndInspect();
 let member=page.locator('[data-ciiw-ms-member="S1"]');
 await expect(member.locator('[data-ciiw-evidence-card][data-selected="true"]')).toHaveCount(1);
 const activeAuto=member.locator('[data-ciiw-evidence-card][data-selected="true"] [data-ciiw-base-action]').first();
 const originalNode=await activeAuto.getAttribute('data-source-node');
 const originalTarget=await activeAuto.getAttribute('data-target-node');
 expect(Number.isSafeInteger(Number(originalNode))).toBe(true);
 expect(Number.isSafeInteger(Number(originalTarget))).toBe(true);
 const competingTarget=String(Number(originalTarget)+1);
 await member.locator('[data-ciiw-ms-manual-source]').fill(originalNode);
 await member.locator('[data-ciiw-ms-manual-target]').fill(competingTarget);
 await member.locator('[data-ciiw-ms-manual-add]').click();

 member=page.locator('[data-ciiw-ms-member="S1"]');
 await expect(member.locator('[data-ciiw-evidence-card][data-selected="true"]')).toHaveCount(1);
 await expect(member).toContainText('ACTIVE: MANUAL');
 await expect(member.locator('[data-ciiw-ms-authority-switch="AUTO"]')).toBeVisible();
 const before=await page.evaluate(()=>Object.values(localStorage)
  .map(x=>{try{return JSON.parse(x)}catch{return null}})
  .find(x=>x?.schema==='CIIWorkspaceWriter2Session.v1'));
 expect(before.authorityModeBySource.S1).toBe('MANUAL');
 expect(before.selectedBySource.S1.length).toBe(1);
 expect(before.manualBySource.S1).toEqual([{sourceNodeId:originalNode,targetNodeId:competingTarget}]);

 await member.locator('[data-ciiw-ms-authority-switch="AUTO"]').click();
 member=page.locator('[data-ciiw-ms-member="S1"]');
 await expect(member).toContainText('ACTIVE: AUTO');
 await expect(member.locator('[data-ciiw-evidence-card][data-selected="true"]')).toHaveCount(1);
 await expect(member.locator('[data-ciiw-ms-authority-switch="MANUAL"]')).toBeVisible();
 await page.locator('[data-ciiw-ms-compare-now]').click();
 await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toBeVisible({timeout:120000});
 const decision=page.locator('[data-ciiw-ms-decision]').first();
 await expect(decision).toBeVisible();

 // Compare intentionally navigates to the review panel; only the visible
 // Inputs panel may receive pointer events for an authority-mode switch.
 await page.locator('[data-ciiw-tab="inputs"]').click();
 await expect(page.locator('[data-ciiw-tab="inputs"]')).toHaveAttribute('aria-current','page');
 await expect(member.locator('[data-ciiw-ms-authority-switch="MANUAL"]')).toBeVisible();
 await member.locator('[data-ciiw-ms-authority-switch="MANUAL"]').click();
 await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toHaveCount(0);
 await expect(page.locator('[data-ciiw-refresh-review]')).toBeDisabled();
 await expect(page.locator('[data-ciiw-ms-apply]')).toHaveCount(0);
 await expect(page.locator('[data-ciiw-status]')).toContainText('MANUAL is ACTIVE');
 const frozen=await page.evaluate(()=>Object.values(localStorage)
  .map(x=>{try{return JSON.parse(x)}catch{return null}})
  .find(x=>x?.schema==='CIIWorkspaceWriter2Session.v1'));
 expect(frozen.review.correspondenceIdentity).toBe('');
 expect(Object.keys(frozen.review.decisions)).toHaveLength(0);
 expect(frozen.selectedBySource.S1.length).toBe(1);
 expect(frozen.manualBySource.S1).toHaveLength(1);

 await page.locator('[data-ciiw-close]').click();
 await openAndInspect();
 member=page.locator('[data-ciiw-ms-member="S1"]');
 await expect(member.locator('[data-ciiw-evidence-card][data-selected="true"]')).toHaveCount(1);
 await expect(member).toContainText('ACTIVE: MANUAL');
 await expect(member.locator('[data-ciiw-ms-authority-switch="AUTO"]')).toBeVisible();
 await expect(member).toContainText(competingTarget);
 await member.locator('[data-ciiw-ms-authority-switch="AUTO"]').click();
 await page.locator('[data-ciiw-ms-compare-now]').click();
 await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toBeVisible({timeout:120000});
});
