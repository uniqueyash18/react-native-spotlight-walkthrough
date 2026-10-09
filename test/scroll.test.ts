import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeScrollOffset, type ScrollAxisInput } from '../src/overlay/geometry.ts';

// A 700pt-tall scroll view starting at y=100 in an 800pt window, 2000pt of content.
const base: ScrollAxisInput = {
  targetStart: 0,
  targetSize: 100,
  viewportStart: 100,
  viewportSize: 700,
  visibleStart: 100,
  visibleEnd: 770, // bottom safe area eats 30pt
  offset: 0,
  contentSize: 2000,
  margin: 16,
  reserve: 180,
};

test('a target already comfortably in view is left alone', () => {
  assert.equal(computeScrollOffset({ ...base, targetStart: 100 }), null);
});

test('a target below the fold is scrolled up and centred', () => {
  const offset = computeScrollOffset({ ...base, targetStart: 1200 });
  // visible height 670 → centred target leaves (670-100)/2 above it
  assert.equal(offset, 1200 - 285);
});

test('a target scrolled above the top is brought back down', () => {
  const offset = computeScrollOffset({ ...base, offset: 900, targetStart: 850 });
  assert.equal(offset, 850 - 285);
});

test('scrolling never goes past the end of the content', () => {
  const offset = computeScrollOffset({ ...base, targetStart: 1950, targetSize: 40 });
  assert.equal(offset, 2000 - 700);
});

test('scrolling never goes above the start of the content', () => {
  const offset = computeScrollOffset({ ...base, offset: 300, targetStart: 10 });
  assert.equal(offset, 0);
});

test('a target too tall to centre with tooltip room is top-aligned', () => {
  const offset = computeScrollOffset({ ...base, targetStart: 900, targetSize: 400 });
  assert.equal(offset, 900 - 16);
});

test('a visible target with no room for the tooltip on either side is moved', () => {
  // 340pt target at 170: 170pt above and 160pt below in the 670pt visible area.
  // Too tall to centre with room both sides → top-aligned, leaving 314pt below.
  assert.equal(computeScrollOffset({ ...base, targetStart: 170, targetSize: 340 }), 170 - 16);
});

test('horizontal axis ignores tooltip reserve', () => {
  const offset = computeScrollOffset({
    ...base,
    reserve: 0,
    viewportStart: 0,
    viewportSize: 400,
    visibleStart: 0,
    visibleEnd: 400,
    contentSize: 1600,
    targetStart: 900,
    targetSize: 120,
  });
  assert.equal(offset, 900 - 140);
});

test('content that does not scroll yields no offset change', () => {
  assert.equal(computeScrollOffset({ ...base, contentSize: 700, targetStart: 760 }), null);
});
