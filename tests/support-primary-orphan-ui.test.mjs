import assert from 'node:assert/strict';
import test from 'node:test';

import { _test as orphanUiTest } from '../tabs/support-steel-relationship-builder/support-primary-orphan-ui-addon.js';
import {
  supportPrimaryOrphanRecoveryRuntimeConfig,
  SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS,
} from '../tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js';

test('Support Report orphan recovery UI exposes governed defaults and fixed unique-target policy', () => {
  const html = orphanUiTest.renderOrphanRecoveryConfigCard();
  assert.match(html, /Conservative orphan recovery/);
  assert.match(html, /data-ssr-orphan-setting="enabled" checked/);
  assert.match(html, /data-ssr-orphan-setting="axialMultiplier"/);
  assert.match(html, /value="1"/);
  assert.match(html, /data-ssr-orphan-setting="lateralMultiplier"/);
  assert.match(html, /value="2"/);
  assert.match(html, /data-ssr-orphan-setting="requireSameFamily" checked/);
  assert.match(html, /data-ssr-orphan-setting="requireSamePipe" checked/);
  assert.match(html, /data-ssr-orphan-setting="requireSameBore" checked/);
  assert.match(html, /Require unique target:<\/b> Always on/);
  assert.match(html, /Different branch\/traversal nodes may be overridden only when Same Family, Same PIPE and Same Bore are all enabled and pass/);
  assert.equal(SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.requireUniqueTarget, true);
});

test('build lease pins orphan runtime configuration to one popup and locks sibling popup controls', () => {
  const fakePopup = (lateralMultiplier) => {
    const settings = [
      setting('enabled', 'checkbox', true),
      setting('axialMultiplier', 'number', 1),
      setting('lateralMultiplier', 'number', lateralMultiplier),
      setting('requireSameFamily', 'checkbox', true),
      setting('requireSamePipe', 'checkbox', true),
      setting('requireSameBore', 'checkbox', true),
    ];
    const build = { disabled: false, getAttribute: () => 'false' };
    return {
      settings,
      build,
      querySelector(selector) { return selector === '[data-ssr-build]' ? build : null; },
      querySelectorAll(selector) { return selector === '[data-ssr-orphan-setting]' ? settings : []; },
      ownerDocument: null,
    };
  };
  const a = fakePopup(2);
  const b = fakePopup(3);
  const doc = { querySelectorAll: () => [a, b] };
  a.ownerDocument = doc;
  b.ownerDocument = doc;

  const firstEvent = eventProbe();
  assert.equal(orphanUiTest.acquireBuildLease(a, firstEvent), true);
  assert.equal(supportPrimaryOrphanRecoveryRuntimeConfig().lateralMultiplier, 2);
  assert.equal(b.build.disabled, true);
  assert.ok(b.settings.every((node) => node.disabled));

  const blockedEvent = eventProbe();
  assert.equal(orphanUiTest.acquireBuildLease(b, blockedEvent), false);
  assert.equal(blockedEvent.prevented, true);
  assert.equal(blockedEvent.stopped, true);
  assert.equal(supportPrimaryOrphanRecoveryRuntimeConfig().lateralMultiplier, 2);

  orphanUiTest.releaseBuildLease(a);
  assert.equal(b.build.disabled, false);
  assert.ok(b.settings.every((node) => !node.disabled));
});

function setting(key, type, value) {
  return {
    dataset: { ssrOrphanSetting: key },
    type,
    checked: type === 'checkbox' ? Boolean(value) : false,
    value: type === 'checkbox' ? '' : String(value),
    disabled: false,
  };
}

function eventProbe() {
  return {
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
}
