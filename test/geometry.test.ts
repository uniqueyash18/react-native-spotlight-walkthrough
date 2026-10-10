import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeArrowOffset,
  computeBlockers,
  computeHole,
  computeTooltipPosition,
  overlayPath,
} from '../src/overlay/geometry.ts';

const screen = { width: 400, height: 800 };
const origin = { x: 0, y: 0 };
const insets = { top: 40, bottom: 30, left: 0, right: 0 };
const target = { x: 100, y: 100, width: 200, height: 100 };

test('rect hole pads the target and caps the radius', () => {
  const hole = computeHole(target, origin, screen, 'rect', 10, 999);
  assert.deepEqual(hole, { x: 90, y: 90, width: 220, height: 120, radius: 60 });
});

test('hole is offset by the overlay origin', () => {
  const hole = computeHole(target, { x: 0, y: 24 }, screen, 'rect', 0, 8);
  assert.equal(hole.y, 76);
});

test('pill hole uses half the short side', () => {
  const hole = computeHole(target, origin, screen, 'pill', 0, 0);
  assert.equal(hole.radius, 50);
});

test('circle hole covers every corner of the target', () => {
  const hole = computeHole(target, origin, screen, 'circle', 0, 0);
  const r = Math.hypot(200, 100) / 2;
  assert.ok(Math.abs(hole.radius - r) < 1e-9);
  assert.ok(Math.abs(hole.x + hole.width / 2 - 200) < 1e-9);
  assert.ok(Math.abs(hole.y + hole.height / 2 - 150) < 1e-9);
});

test('no target or shape "none" gives an empty centred hole', () => {
  assert.equal(computeHole(null, origin, screen, 'rect', 8, 8).width, 0);
  assert.equal(computeHole(target, origin, screen, 'none', 8, 8).width, 0);
});

test('tooltip goes below a target near the top', () => {
  const hole = computeHole(target, origin, screen, 'rect', 0, 0);
  assert.deepEqual(computeTooltipPosition(hole, screen, insets, 'auto', 14), {
    mode: 'below',
    top: 214,
  });
});

test('tooltip goes above a target near the bottom', () => {
  const low = computeHole({ ...target, y: 650 }, origin, screen, 'rect', 0, 0);
  assert.deepEqual(computeTooltipPosition(low, screen, insets, 'auto', 14), {
    mode: 'above',
    bottom: 164,
  });
});

test('explicit placement and empty holes', () => {
  const hole = computeHole(target, origin, screen, 'rect', 0, 0);
  assert.equal(computeTooltipPosition(hole, screen, insets, 'top', 14).mode, 'above');
  assert.equal(computeTooltipPosition(hole, screen, insets, 'center', 14).mode, 'center');
  const empty = computeHole(null, origin, screen, 'rect', 0, 0);
  assert.equal(computeTooltipPosition(empty, screen, insets, 'bottom', 14).mode, 'center');
});

test('a target that fills the screen gets a centred tooltip', () => {
  const huge = computeHole({ x: 0, y: 0, width: 400, height: 790 }, origin, screen, 'rect', 0, 0);
  assert.equal(computeTooltipPosition(huge, screen, insets, 'auto', 14).mode, 'center');
});

test('a forced side is clamped so the tooltip stays on screen', () => {
  const low = computeHole({ ...target, y: 700 }, origin, screen, 'rect', 0, 0);
  const pos = computeTooltipPosition(low, screen, insets, 'bottom', 14, 140);
  assert.deepEqual(pos, { mode: 'below', top: 800 - 38 - 140 });
});

test('blockers tile everything except the hole', () => {
  const hole = computeHole(target, origin, screen, 'rect', 0, 0);
  const blockers = computeBlockers(hole, screen);
  const area = blockers.reduce((sum, b) => sum + b.width * b.height, 0);
  assert.equal(area, 400 * 800 - 200 * 100);
});

test('blockers drop empty strips for an edge-to-edge hole', () => {
  const hole = computeHole({ x: 0, y: 0, width: 400, height: 200 }, origin, screen, 'rect', 0, 0);
  assert.equal(computeBlockers(hole, screen).length, 1);
});

test('arrow points at the hole centre but stays off the corners', () => {
  const hole = computeHole(target, origin, screen, 'rect', 0, 0);
  assert.equal(computeArrowOffset(hole, 20, 360, 10, 18), 170);
  const edge = computeHole({ ...target, x: 0, width: 10 }, origin, screen, 'rect', 0, 0);
  assert.equal(computeArrowOffset(edge, 20, 360, 10, 18), 18);
});

test('overlay path has an outer rect and a hole subpath', () => {
  const d = overlayPath(400, 800, 10, 10, 100, 50, 8);
  assert.equal((d.match(/M/g) ?? []).length, 2);
  assert.equal(overlayPath(400, 800, 0, 0, 0, 0, 0), 'M0,0H400V800H0Z');
});

test('isTap tells taps from drags', async () => {
  const { isTap } = await import('../src/overlay/geometry.ts');
  assert.equal(isTap({ x: 0, y: 0 }, { x: 3, y: 4 }), true);
  assert.equal(isTap({ x: 0, y: 0 }, { x: 40, y: 0 }), false);
});
