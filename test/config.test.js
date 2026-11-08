import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  readLanguage,
  readInterval,
  parseAddedStops,
  DEFAULT_INTERVAL,
  MAX_ADDED_STOPS,
  MAX_LINES,
} from '../src/config.js';

test('token, stops, lines, interval and language from the raw config', () => {
  const config = normalizeConfig({
    token: ' a1b2-token ',
    stop_1: ' Homme de Fer ',
    stop_1_line: 'A',
    stop_1_direction: 'Illkirch',
    stop_2: '',
    stop_3: '527',
    lines: 'A, C, 2, A',
    interval: '30',
    language: 'de',
  });
  assert.deepEqual(config, {
    key: 'a1b2-token',
    stops: [
      { slot: 1, stop: 'Homme de Fer', line: 'A', direction: 'Illkirch' },
      { slot: 3, stop: '527', line: '', direction: '' },
    ],
    addedStops: [],
    lines: ['A', 'C', '2'],
    interval: 30,
    language: 'de',
  });
  assert.deepEqual(normalizeConfig(null), {
    key: '',
    stops: [],
    addedStops: [],
    lines: [],
    interval: DEFAULT_INTERVAL,
    language: 'auto',
  });
  const many = Array.from({ length: 15 }, (_, n) => `L${n}`).join(', ');
  assert.equal(normalizeConfig({ lines: many }).lines.length, MAX_LINES);
});

test('bounds: the intervals offered, the stored language', () => {
  assert.equal(readInterval(30), 30);
  assert.equal(readInterval(45), DEFAULT_INTERVAL);
  assert.equal(readInterval(600), DEFAULT_INTERVAL);
  assert.equal(readInterval('300'), 300);
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'español' }, 'fr'), 'fr');
  assert.equal(readLanguage(undefined, 'en'), 'en');
});

test('the stops added with the buttons follow the three of the form', () => {
  const added = [
    { stop: '230', line: 'C', direction: '' },
    { stop: ' République ', line: '', direction: 'Deux Rives' },
    { stop: '', line: '2' },
    'Homme de Fer',
  ];
  const config = normalizeConfig({ stop_2: 'Gare Centrale', added_stops: added });
  assert.deepEqual(config.stops, [
    { slot: 2, stop: 'Gare Centrale', line: '', direction: '' },
    { slot: null, added: 1, stop: '230', line: 'C', direction: '' },
    { slot: null, added: 2, stop: 'République', line: '', direction: 'Deux Rives' },
  ]);
  assert.equal(config.addedStops.length, 2);
  // Stored as JSON text by an older core: read the same.
  assert.deepEqual(parseAddedStops(JSON.stringify(added)), config.addedStops);
  assert.deepEqual(parseAddedStops('not json'), []);
  assert.deepEqual(parseAddedStops(undefined), []);
  const many = Array.from({ length: 20 }, (_, n) => ({ stop: `S${n}` }));
  assert.equal(parseAddedStops(many).length, MAX_ADDED_STOPS);
});
