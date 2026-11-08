// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import * as sdk from '@gladysassistant/integration-sdk';

import {
  stopKey,
  lineKey,
  followedName,
  parseExternalId,
  buildStopDevice,
  buildStopStates,
  buildLineDevice,
  buildLineStates,
  lineStatusText,
} from '../src/device.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  fakeGladys,
  NOW,
  TZ,
  stopMonitoring,
  generalMessage,
  HOMME_DE_FER,
  MESSAGES,
} from './helpers/fixtures.js';

/**
 * @description A followed stop.
 * @param {object} stop - `{ id, name, codes }`.
 * @param {string} line - The typed line.
 * @param {string} direction - The typed direction.
 * @returns {object} The followed stop.
 */
function followed(stop, line, direction) {
  const entry = { stop, line, direction, key: stopKey(stop, line, direction) };
  return { ...entry, name: followedName(entry) };
}

const HOMME = { id: '275', name: 'Homme de Fer', codes: ['275'] };
const HOMME_A = followed(HOMME, 'Tram A', 'Illkirch');
const HOMME_ALL = followed(HOMME, '', '');
const LINE_A = { id: 'A', name: 'A', mode: 'tram' };
const LINE_2 = { id: '02', name: '2', mode: 'bus' };
const devices = (language) => [
  buildStopDevice(fakeGladys, HOMME_A, language),
  buildStopDevice(fakeGladys, HOMME_ALL, language),
  buildLineDevice(fakeGladys, LINE_A, language),
  buildLineDevice(fakeGladys, LINE_2, language),
];

test('external ids: the codes of the stop, the typed line and direction; the route id of a line', () => {
  assert.equal(HOMME_A.key, '275_a_illkirch');
  assert.equal(stopKey({ id: '31-778' }, '', ''), '31-778');
  assert.equal(stopKey({ id: '275b' }, 'bus 10', 'Gallia | Musée'), '275b_10_gallia-musee');
  assert.equal(lineKey(LINE_2), '02');
  const [stop, , line] = devices('en');
  assert.equal(stop.external_id, 'ext:cts-strasbourg:stop:275_a_illkirch');
  assert.equal(line.external_id, 'ext:cts-strasbourg:line:a');
  assert.deepEqual(parseExternalId(`${stop.external_id}:next`), {
    type: 'stop',
    key: '275_a_illkirch',
  });
  assert.deepEqual(parseExternalId(line.external_id), { type: 'line', key: 'a' });
  assert.equal(parseExternalId('ext:other:thing'), null);
});

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max', 'read_only', 'has_feedback']) {
          assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
        }
        assert.equal(feature.read_only, true);
      }
    }
  }
});

test('category / type pairs and units come from the SDK', () => {
  const { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS } = sdk;
  const pairs = devices('en').flatMap((device) =>
    device.features.map((feature) => [
      feature.external_id.split(':').pop(),
      feature.category,
      feature.type,
      feature.unit,
    ]),
  );
  assert.deepEqual(pairs, [
    ['next', DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
    [
      'wait',
      DEVICE_FEATURE_CATEGORIES.DURATION,
      DEVICE_FEATURE_TYPES.DURATION.INTEGER,
      DEVICE_FEATURE_UNITS.MINUTES,
    ],
    [
      'following',
      DEVICE_FEATURE_CATEGORIES.DURATION,
      DEVICE_FEATURE_TYPES.DURATION.INTEGER,
      DEVICE_FEATURE_UNITS.MINUTES,
    ],
    [
      'messages',
      DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      undefined,
    ],
    ['next', DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
    [
      'wait',
      DEVICE_FEATURE_CATEGORIES.DURATION,
      DEVICE_FEATURE_TYPES.DURATION.INTEGER,
      DEVICE_FEATURE_UNITS.MINUTES,
    ],
    [
      'following',
      DEVICE_FEATURE_CATEGORIES.DURATION,
      DEVICE_FEATURE_TYPES.DURATION.INTEGER,
      DEVICE_FEATURE_UNITS.MINUTES,
    ],
    [
      'messages',
      DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      undefined,
    ],
    ['status', DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
    [
      'messages',
      DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      undefined,
    ],
    ['status', DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
    [
      'messages',
      DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      undefined,
    ],
  ]);
  const table = sdk.DEVICE_FEATURE_UNITS_BY_CATEGORY;
  if (table) {
    assert.ok(table[DEVICE_FEATURE_CATEGORIES.DURATION].includes(DEVICE_FEATURE_UNITS.MINUTES));
  }
});

test('names in every language; a line reads "tram A", "ligne 2"', () => {
  assert.equal(devices('fr')[0].name, 'CTS Homme de Fer (Tram A → Illkirch)');
  assert.equal(devices('fr')[2].name, 'CTS tram A');
  assert.equal(devices('fr')[3].name, 'CTS ligne 2');
  assert.equal(devices('de')[3].name, 'CTS Linie 2');
  assert.deepEqual(devices('en')[0].params, [
    { name: 'CTS_STOP', value: '275' },
    { name: 'CTS_LINE', value: 'Tram A' },
    { name: 'CTS_DIRECTION', value: 'Illkirch' },
  ]);
});

test('the fake Gladys accepts the whole discovery batch and every state', async () => {
  const gladys = createFakeGladys({});
  await gladys.connect();
  const batch = [
    buildStopDevice(gladys, HOMME_ALL, 'fr'),
    buildStopDevice(gladys, HOMME_A, 'fr'),
    buildLineDevice(gladys, LINE_A, 'fr'),
    buildLineDevice(gladys, LINE_2, 'fr'),
  ];
  await gladys.publishDiscoveredDevices(batch);
  for (const device of batch) {
    await gladys.fake.deviceCreated(device);
  }
  const passages = parsePassages(stopMonitoring(HOMME_DE_FER), { codes: ['275'] });
  const states = [
    ...buildStopStates(
      gladys,
      HOMME_ALL,
      { passages, messages: [{}, {}] },
      { language: 'fr', now: NOW, timeZone: TZ },
    ),
    ...buildLineStates(
      gladys,
      LINE_A,
      lineTraffic(parseTraffic(generalMessage(MESSAGES)), LINE_A, NOW),
      'fr',
    ),
  ];
  await gladys.publishStates(states);
  const id = (key) => `ext:test-integration:stop:275:${key}`;
  assert.equal(gladys.fake.lastState(id('next')), 'A → Illkirch Graffenstaden · 3 min');
  assert.equal(gladys.fake.lastState(id('wait')), 3);
  assert.equal(gladys.fake.lastState(id('following')), 4);
  assert.equal(gladys.fake.lastState(id('messages')), 2);
  assert.equal(
    gladys.fake.lastState('ext:test-integration:line:a:status'),
    'Très perturbé : Travaux : tram A limité',
  );
  await gladys.fake.shutdown();
});

test('without a passage the waits are left alone; without traffic, the count too', () => {
  const states = buildStopStates(
    fakeGladys,
    HOMME_ALL,
    { passages: [], messages: null },
    {
      language: 'en',
      now: NOW,
      timeZone: TZ,
    },
  );
  assert.deepEqual(states, [
    {
      device_feature_external_id: 'ext:cts-strasbourg:stop:275:next',
      text: 'No passage announced',
    },
  ]);
  const timetable = parsePassages(stopMonitoring(HOMME_DE_FER), { codes: ['275D'] });
  const [next] = buildStopStates(
    fakeGladys,
    HOMME_ALL,
    { passages: timetable, messages: [] },
    {
      language: 'en',
      now: NOW,
      timeZone: TZ,
    },
  );
  assert.equal(next.text, '10 → Gallia · 12 min (timetable)');
  assert.equal(lineStatusText({ state: 'normal', messages: [] }, 'es'), 'Servicio normal');
});
