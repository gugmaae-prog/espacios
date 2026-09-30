import test from 'node:test';
import assert from 'node:assert/strict';
import {clamp, fractionAt, periodAt, pickProjects, viewportPadding} from '../src/mobile-map/core.mjs';

const point = (id, coordinates, extra = {}) => ({type: 'Feature', properties: {id}, geometry: {type: 'Point', coordinates}, ...extra});
const project = ([x, y]) => ({x, y});

test('pointer coordinates reach both exact timeline endpoints with thumb insets', () => {
  const rect = {left: 10, width: 300};
  assert.equal(fractionAt(22, rect), 0);
  assert.equal(fractionAt(298, rect), 1);
  assert.equal(fractionAt(160, rect), .5);
  assert.equal(fractionAt(-400, rect), 0);
  assert.equal(fractionAt(800, rect), 1);
});

test('period selection retains irregular native periods and never synthesizes a date', () => {
  const periods = Object.freeze(['2019Q1', '2020Q3', '2026H1', '2036H1']);
  assert.equal(periodAt(periods, 0), '2019Q1');
  assert.equal(periodAt(periods, 1), '2036H1');
  assert.equal(periodAt(periods, .25), '2020Q3');
  assert.equal(periodAt(periods, .75), '2026H1');
  for (let i = 0; i <= 100; i++) assert.ok(periods.includes(periodAt(periods, i / 100)));
});

test('empty and single-period domains are safe and out-of-range input clamps', () => {
  assert.equal(periodAt([], .5), null);
  assert.equal(periodAt(['2026H1'], 1), '2026H1');
  assert.equal(periodAt(['2026H1'], -5), '2026H1');
  assert.equal(clamp(NaN), 0);
  assert.equal(clamp(Infinity), 1);
  assert.equal(clamp(-Infinity), 0);
});

test('project picker includes touch-radius edge, excludes outside and sorts nearest first', () => {
  const records = [point('far', [23, 0]), point('edge', [22, 0]), point('nearest', [1, 0]), point('middle', [10, 0])];
  assert.deepEqual(pickProjects(records, {x: 0, y: 0}, project).map(x => x.id), ['nearest', 'middle', 'edge']);
  assert.deepEqual(pickProjects(records, {x: 0, y: 0}, project, 5).map(x => x.id), ['nearest']);
});

test('duplicate tiles of the same id collapse to their closest feature without collapsing distinct records', () => {
  const records = [point(7, [8, 0]), point('7', [2, 0]), point('separate-project', [2, 0])];
  const hits = pickProjects(records, {x: 0, y: 0}, project);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].id, '7');
  assert.equal(hits[0].distance, 2);
  assert.equal(hits[0].feature, records[1]);
  assert.equal(hits[1].id, 'separate-project');
});

test('shared approximate coordinates keep every distinct catalogue record selectable', () => {
  const records = [point('c', [5, 5]), point('a', [5, 5]), point('b', [5, 5])];
  assert.deepEqual(pickProjects(records, {x: 5, y: 5}, project).map(x => x.id), ['a', 'b', 'c']);
});

test('feature ids are supported without mutating source geometry or properties', () => {
  const record = Object.freeze({type: 'Feature', id: 'source-id', properties: Object.freeze({name: 'Preserved'}), geometry: Object.freeze({type: 'Point', coordinates: Object.freeze([6, 8])})});
  const hits = pickProjects(Object.freeze([record]), {x: 0, y: 0}, project);
  assert.equal(hits[0].id, 'source-id');
  assert.equal(hits[0].distance, 10);
  assert.equal(hits[0].feature, record);
});

test('malformed geometry cannot enter projection or interrupt valid project selection', () => {
  const records = [point('empty', []), point('short', [1]), point('text', ['1', 2]), point('nan', [NaN, 0]), point('polygon', [1, 2], {geometry: {type: 'Polygon', coordinates: []}}), point('valid', [3, 4])];
  const projected = [];
  const hits = pickProjects(records, {x: 0, y: 0}, coordinates => {projected.push(coordinates);return project(coordinates);});
  assert.deepEqual(hits.map(x => x.id), ['valid']);
  assert.deepEqual(projected, [[3, 4]]);
});

test('an individual projection error cannot abort all remaining selectable records', () => {
  const records = [point('bad-project', [1, 2]), point('valid', [3, 4])];
  const hits = pickProjects(records, {x: 0, y: 0}, coordinates => {if (coordinates[0] === 1) throw new Error('Unprojectable coordinate');return project(coordinates);});
  assert.deepEqual(hits.map(x => x.id), ['valid']);
});

test('padding reserves measured header and timeline while leaving map space', () => {
  const padding = viewportPadding(844, 110, 610);
  assert.deepEqual(padding, {top: 122, bottom: 246, left: 12, right: 12});
  assert.ok(844 - padding.top - padding.bottom >= 96);
});

test('opening an inspector increases bottom padding and closing returns it to timeline bounds', () => {
  const closed = viewportPadding(844, 110, 610);
  const open = viewportPadding(844, 110, 610, 350);
  assert.equal(open.top, closed.top);
  assert.equal(open.bottom, 506);
  assert.ok(open.bottom > closed.bottom);
  assert.deepEqual(viewportPadding(844, 110, 610, NaN), closed);
});

test('landscape padding is bounded even when an expanded sheet nearly fills the viewport', () => {
  const padding = viewportPadding(390, 64, 162, 82);
  assert.equal(padding.top, 76);
  assert.equal(padding.bottom, 218);
  assert.equal(390 - padding.top - padding.bottom, 96);
  assert.ok(Object.values(viewportPadding(60, 200, -20, -100)).every(value => Number.isFinite(value) && value >= 0));
});
