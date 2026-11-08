// The stops and lines of the open GTFS of the CTS: reading, resolving a typed
// stop or line, searching, keeping them in /data.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseStops,
  parseLines,
  findStop,
  searchStops,
  findLine,
  splitLines,
  typedLine,
  logicalOf,
  createNetwork,
  NETWORK_MAX_AGE_MS,
} from '../src/network.js';
import { createStore } from '../src/store.js';
import {
  STOPS_TXT,
  ROUTES_TXT,
  NOW,
  GTFS_URL,
  fakeCts,
  storePath,
  silent,
} from './helpers/fixtures.js';

const STOPS = parseStops(Buffer.from(STOPS_TXT));
const LINES = parseLines(Buffer.from(ROUTES_TXT));

test('stops are grouped by name, with their logical codes and their sides', () => {
  const homme = STOPS.find(([name]) => name === 'Homme de Fer');
  assert.deepEqual(homme, ['Homme de Fer', ['275'], ['275A', '275B', '275C', '275D']]);
  // A stop renamed keeps two logical codes.
  const artisans = STOPS.find(([name]) => name === 'Vendenheim Artisans');
  assert.deepEqual(artisans[1], ['31', '778']);
  assert.equal(logicalOf('275A'), '275');
  assert.equal(logicalOf('230'), '230');
  assert.equal(logicalOf('Gare'), '');
});

test('a stop is found by its name, its words, its logical code or one side', () => {
  assert.deepEqual(findStop(STOPS, 'homme de fer'), {
    id: '275',
    name: 'Homme de Fer',
    codes: ['275'],
  });
  // "Gare Centrale" and "Gare centrale": one stop.
  assert.deepEqual(findStop(STOPS, 'Gare Centrale').codes, ['230']);
  assert.deepEqual(findStop(STOPS, 'Vendenheim Artisans'), {
    id: '31-778',
    name: 'Vendenheim Artisans',
    codes: ['31', '778'],
  });
  assert.equal(findStop(STOPS, 'lixenbuhl').name, 'Illkirch Lixenbuhl');
  assert.deepEqual(findStop(STOPS, '275'), { id: '275', name: 'Homme de Fer', codes: ['275'] });
  assert.deepEqual(findStop(STOPS, '275b'), { id: '275b', name: 'Homme de Fer', codes: ['275B'] });
  // A code the GTFS does not know is still asked to the API.
  assert.deepEqual(findStop(STOPS, '9999'), { id: '9999', name: '9999', codes: ['9999'] });
  assert.equal(findStop(STOPS, 'Nulle part'), null);
  // Words of several stops: ambiguous.
  assert.equal(findStop(STOPS, 'r'), null);
  assert.equal(findStop(STOPS, 'bourse rathaus'), null);
  assert.equal(findStop(STOPS, ''), null);
});

test('search lists the best matches first, with their codes', () => {
  const { found, total } = searchStops(STOPS, 'gare');
  assert.equal(total, 1);
  assert.equal(found[0].name, 'Gare Centrale');
  assert.deepEqual(found[0].codes, ['230']);
  assert.ok(found[0].sides.includes('230U'), 'the side named "Gare centrale"');
  assert.deepEqual(
    searchStops(STOPS, 'r').found.map((stop) => stop.name),
    ['Kehl Rathaus', 'République'],
  );
  assert.deepEqual(searchStops(STOPS, 'république').found[0].codes, ['527']);
  assert.deepEqual(searchStops(STOPS, ' '), { found: [], total: 0 });
});

test('lines: trams first, a typed line by its name, its words or its route id', () => {
  assert.deepEqual(
    LINES.slice(0, 6).map((line) => line.name),
    ['A', 'B', 'C', 'D', 'E', 'F'],
  );
  assert.deepEqual(findLine(LINES, 'Tram A'), {
    id: 'A',
    name: 'A',
    mode: 'tram',
    color: 'E10D19',
  });
  assert.equal(findLine(LINES, '2').id, '02');
  assert.equal(findLine(LINES, 'ligne 02').id, '02');
  assert.equal(findLine(LINES, 'c1').mode, 'bus');
  assert.equal(findLine(LINES, 'Z'), null);
  assert.equal(typedLine('Bus 10'), '10');
});

test('a typed list of lines: commas, or words', () => {
  assert.deepEqual(splitLines('A, C; 2 | C1'), ['A', 'C', '2', 'C1']);
  assert.deepEqual(splitLines('A C 2'), ['A', 'C', '2']);
  assert.deepEqual(splitLines('tram A, bus 2'), ['tram A', 'bus 2']);
  assert.deepEqual(splitLines(''), []);
});

test('the network is read once, kept in /data, read again after a week', async () => {
  const api = fakeCts();
  const clock = { now: NOW };
  const store = createStore({ path: storePath(), logger: silent });
  const network = createNetwork({ store, fetch: api, now: () => clock.now, logger: silent });
  assert.equal((await network.resolveStop('Homme de Fer')).id, '275');
  assert.equal((await network.resolveLine('2')).id, '02');
  await network.searchStops('gare');
  assert.equal(api.calls.filter((call) => call.url === GTFS_URL).length, 1);
  clock.now += NETWORK_MAX_AGE_MS + 1000;
  api.state.failGtfs = 502;
  // Out of reach after a week: the network known is kept.
  assert.equal((await network.resolveStop('République')).id, '527');
  assert.equal(network.lineById('A').mode, 'tram');
});

test('without the GTFS, a code still works, a name does not, a line is taken as typed', async () => {
  const api = fakeCts();
  api.state.failGtfs = 503;
  const store = createStore({ path: storePath(), logger: silent });
  const network = createNetwork({ store, fetch: api, now: () => NOW, logger: silent });
  assert.deepEqual(await network.resolveStop('275A'), {
    id: '275a',
    name: '275A',
    codes: ['275A'],
  });
  await assert.rejects(network.resolveStop('Homme de Fer'), { name: 'NetworkError' });
  assert.deepEqual(await network.resolveLine('c1'), {
    id: 'C1',
    name: 'C1',
    mode: 'bus',
    color: '',
    unknown: true,
  });
});
