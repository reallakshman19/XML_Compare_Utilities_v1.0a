import assert from 'node:assert/strict';
import {
  placeCollisionManagedLabels,
  rectanglesOverlap,
  selectVisibleLabels,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-interaction-quality.js';

{
  assert.equal(rectanglesOverlap(
    { left: 0, right: 20, top: 0, bottom: 20 },
    { left: 22, right: 42, top: 0, bottom: 20 },
    1,
  ), false);
  assert.equal(rectanglesOverlap(
    { left: 0, right: 20, top: 0, bottom: 20 },
    { left: 19, right: 39, top: 0, bottom: 20 },
    1,
  ), true);
}

{
  const labels = Array.from({ length: 500 }, (_, index) => ({
    id: `node-${index}`,
    preferredX: index,
    preferredY: 100,
    priority: index === 0 || index === 499 ? 700 : 100,
    selected: index === 287,
  }));
  const selected = selectVisibleLabels(labels, { maxLabels: 60 });
  assert.equal(selected.length, 60);
  assert.ok(selected.some((label) => label.id === 'node-287'), 'selected labels must never be sampled out');
  assert.ok(selected.some((label) => label.id === 'node-0'), 'first endpoint must be retained');
  assert.ok(selected.some((label) => label.id === 'node-499'), 'last endpoint must be retained');
}

{
  const labels = Array.from({ length: 7 }, (_, index) => ({
    id: `label-${index}`,
    preferredX: 150 + index * 2,
    preferredY: 100,
    width: 62,
    height: 20,
    priority: index === 3 ? 1000 : 100,
    selected: index === 3,
    candidateOffsets: [0, -24, 24, -48, 48, -72, 72],
  }));
  const placements = placeCollisionManagedLabels(labels, {
    left: 10,
    right: 420,
    top: 10,
    bottom: 240,
  }, { padding: 3 });

  assert.ok(placements.some((label) => label.id === 'label-3'), 'selected label must remain visible');
  for (let index = 0; index < placements.length; index += 1) {
    const current = placements[index];
    assert.ok(current.rect.left >= 10);
    assert.ok(current.rect.right <= 420);
    assert.ok(current.rect.top >= 10);
    assert.ok(current.rect.bottom <= 240);
    for (let other = index + 1; other < placements.length; other += 1) {
      assert.equal(
        rectanglesOverlap(current.rect, placements[other].rect, 2),
        false,
        `${current.id} overlaps ${placements[other].id}`,
      );
    }
  }
}

console.log('pipeline-3d-model CAD interaction quality tests passed');
