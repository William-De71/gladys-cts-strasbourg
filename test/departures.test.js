// An answer of stop-monitoring -> the passages of a stop.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseInstant,
  parsePassages,
  minutesLeft,
  upcomingPassages,
  routeOf,
  modeOf,
} from '../src/departures.js';
import { parseLines } from '../src/network.js';
import {
  stopMonitoring,
  visit,
  HOMME_DE_FER,
  REPUBLIQUE,
  NOW,
  ROUTES_TXT,
} from './helpers/fixtures.js';

const MINUTE = 60 * 1000;
const LINES = parseLines(Buffer.from(ROUTES_TXT));
const lineById = (id) => LINES.find((line) => line.id === id) ?? null;
const ANSWER = stopMonitoring([...HOMME_DE_FER, ...REPUBLIQUE]);

test('times of the API: with their offset, or Paris time without one', () => {
  assert.equal(parseInstant('2026-11-08T18:35:00+01:00'), Date.parse('2026-11-08T17:35:00Z'));
  assert.equal(parseInstant('2026-11-08T18:35:00.000Z'), Date.parse('2026-11-08T18:35:00Z'));
  assert.equal(parseInstant('2026-07-08T18:35:00+0200'), Date.parse('2026-07-08T16:35:00Z'));
  // Without an offset: Paris, winter and summer.
  assert.equal(parseInstant('2026-11-08T18:35:00'), Date.parse('2026-11-08T17:35:00Z'));
  assert.equal(parseInstant('2026-07-08T18:35'), Date.parse('2026-07-08T16:35:00Z'));
  assert.equal(parseInstant('18:35'), null);
  assert.equal(parseInstant(null), null);
});

test('the passages of a stop: its codes only, soonest first, real time or timetable', () => {
  const passages = parsePassages(ANSWER, { codes: ['275'], lineById });
  assert.deepEqual(
    passages.map((p) => [p.line, p.destination, minutesLeft(p, NOW), p.realtime, p.stopCode]),
    [
      ['A', 'Illkirch Graffenstaden', 3, true, '275A'],
      ['A', 'Parc des Sports', 4, true, '275B'],
      ['D', 'Kehl Rathaus', 6, true, '275C'],
      ['A', 'Illkirch Graffenstaden', 9, true, '275A'],
      ['10', 'Gallia', 12, false, '275D'],
    ],
  );
  assert.equal(passages[0].mode, 'tram');
  assert.equal(passages[0].trip, 'SAE-A-3');
  // One side only.
  assert.deepEqual(
    parsePassages(ANSWER, { codes: ['275B'] }).map((p) => p.destination),
    ['Parc des Sports'],
  );
});

test('the destination carries its via; the line is the published name', () => {
  const [passage] = parsePassages(ANSWER, { codes: ['527'], lineById });
  assert.equal(passage.destination, 'Jardin des Deux Rives via Etoile Bourse');
  assert.equal(passage.line, '2');
  assert.equal(passage.lineId, '02');
  assert.equal(passage.mode, 'bus');
});

test('filters: a line, a mode, words of the direction', () => {
  const tramA = { id: 'A', name: 'A' };
  assert.deepEqual(
    parsePassages(ANSWER, { codes: ['275'], line: tramA }).map((p) => minutesLeft(p, NOW)),
    [3, 4, 9],
  );
  assert.deepEqual(
    parsePassages(ANSWER, { codes: ['275'], line: { modeOnly: 'bus' } }).map((p) => p.line),
    ['10'],
  );
  assert.deepEqual(
    parsePassages(ANSWER, { codes: ['275'], line: tramA, direction: 'illkirch' }).length,
    2,
  );
  assert.deepEqual(
    parsePassages(ANSWER, { codes: ['275'], direction: 'Kehl | Gallia' }).map((p) => p.line),
    ['D', '10'],
  );
  // "2" typed for the route "02".
  assert.equal(parsePassages(ANSWER, { codes: ['527'], line: { id: '02', name: '2' } }).length, 1);
});

test('a visit listed twice (two codes asked) is kept once; one without time is dropped', () => {
  const twice = stopMonitoring([
    visit({ minutes: 3 }),
    visit({ minutes: 3, asked: '275A' }),
    { MonitoredVehicleJourney: { LineRef: 'A', MonitoredCall: {} }, MonitoringRef: '275' },
  ]);
  assert.equal(parsePassages(twice, { codes: ['275', '275A'] }).length, 1);
  assert.deepEqual(parsePassages({}, {}), []);
  assert.deepEqual(parsePassages({ ServiceDelivery: { StopMonitoringDelivery: null } }), []);
});

test('helpers: the mode, the passages to come, the route of a passage', () => {
  assert.equal(modeOf({ VehicleMode: 'undefined', LineRef: 'C' }, lineById), 'tram');
  assert.equal(modeOf({ VehicleMode: 'coach' }), 'coach');
  assert.equal(modeOf({}), 'bus');
  const passages = parsePassages(ANSWER, { codes: ['275'] });
  assert.equal(upcomingPassages(passages, NOW + 5 * MINUTE).length, 3);
  assert.equal(routeOf(passages[0]), 'a|illkirch graffenstaden');
});
