// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake CTS (test/helpers/fixtures.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  createApp,
  SCENE_ACTIONS,
  ACTIONS,
  IDLE_INTERVAL_MS,
  TRAFFIC_INTERVAL_MS,
} from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeCts,
  storePath,
  silent,
  infoMessage,
  visit,
  NOW,
  TZ,
  TOKEN,
  API_URL,
  GTFS_URL,
} from './helpers/fixtures.js';

const CONFIG = {
  token: TOKEN,
  stop_1: 'Homme de Fer',
  stop_1_line: 'Tram A',
  stop_1_direction: 'Illkirch',
  stop_2: 'République',
  stop_3: 'Nulle part',
  lines: 'A, C, Z9',
  interval: '60',
  language: 'fr',
};
const PREFIX = 'ext:test-integration';
const HOMME_A = `${PREFIX}:stop:275_a_illkirch`;
const REPUB = `${PREFIX}:stop:527`;
const LINE_A = `${PREFIX}:line:a`;
const LINE_C = `${PREFIX}:line:c`;
const MINUTE = 60 * 1000;

/**
 * @description The integration, connected to a fake Gladys and a fake CTS.
 * @param {object} [options] - `{ config, path, logger, api }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({ config = CONFIG, path = storePath(), logger = silent, api } = {}) {
  const clock = { now: NOW };
  const cts = api ?? fakeCts();
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: cts,
    baseUrl: API_URL,
    gtfsUrl: GTFS_URL,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api: cts, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const message = async (gladys, key, fields) => (await gladys.fake.action(key, fields)).data.message;
const widget = async (gladys, key, options) => {
  const answer = await gladys.fake.widgetGet(key, options);
  assert.equal(answer.success, true);
  assert.deepEqual(validateWidgetContent(answer.data.content), [], key);
  return answer.data.content;
};

test('stops and lines become devices; unknown names are reported; one request per stop', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [HOMME_A, 'CTS Homme de Fer (Tram A → Illkirch)'],
      [REPUB, 'CTS République'],
      [LINE_A, 'CTS tram A'],
      [LINE_C, 'CTS tram C'],
    ],
  );
  // The GTFS, one stop-monitoring per stop, the traffic once.
  assert.deepEqual(
    api.calls.map((call) => [call.path, call.refs]),
    [
      ['/google_transit.zip', []],
      ['/v1/siri/2.0/stop-monitoring', ['275']],
      ['/v1/siri/2.0/stop-monitoring', ['527']],
      ['/v1/siri/2.0/general-message', []],
    ],
  );
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    'Connecté à la CTS : 2 arrêt(s) lus toutes les 60 s, 2 ligne(s) suivie(s). Inconnu ou ambigu : Nulle part. Lignes inconnues de la CTS : Z9.',
  );
  // The first readings are a baseline: nothing fires.
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('created devices get their states, sent again after the creation', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, HOMME_A);
  await created(gladys, LINE_A);
  assert.equal(gladys.fake.lastState(`${HOMME_A}:next`), 'A → Illkirch Graffenstaden · 3 min');
  assert.equal(gladys.fake.lastState(`${HOMME_A}:wait`), 3);
  assert.equal(gladys.fake.lastState(`${HOMME_A}:following`), 9);
  // Works on A, and the message of the whole network.
  assert.equal(gladys.fake.lastState(`${HOMME_A}:messages`), 2);
  assert.equal(
    gladys.fake.lastState(`${LINE_A}:status`),
    'Très perturbé : Travaux : tram A limité',
  );
  assert.equal(gladys.fake.lastState(`${LINE_A}:messages`), 2);
  // Later: the A followed by the timetable only.
  clock.now += 2 * MINUTE;
  api.state.stops[275] = [visit({ minutes: 13, realtime: false })];
  await app.readStops();
  assert.equal(gladys.fake.lastState(`${HOMME_A}:wait`), 11);
  assert.equal(
    gladys.fake.lastState(`${HOMME_A}:next`),
    'A → Illkirch Graffenstaden · 11 min (théorique)',
  );
  // Nothing more announced: the waits keep their last value.
  clock.now += 2 * MINUTE;
  api.state.stops[275] = [];
  await app.readStops();
  assert.equal(gladys.fake.lastState(`${HOMME_A}:next`), 'Aucun passage annoncé');
  assert.equal(gladys.fake.lastState(`${HOMME_A}:wait`), 11);
});

test('departure soon fires once per passage and mark', async (t) => {
  const { gladys, app, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  clock.now += MINUTE;
  await app.readStops();
  await app.checkReminders();
  const soon = eventsOf(gladys, TRIGGERS.DEPARTURE_SOON);
  assert.deepEqual(
    soon.map((event) => [event.data.stop, event.data.minutes, event.data.line, event.data.time]),
    [[HOMME_A, '2', 'A', '18:33']],
  );
  assert.equal(
    soon[0].data.summary,
    'A vers Illkirch Graffenstaden passe à Homme de Fer dans 2 min (18:33).',
  );
  clock.now += 20 * 1000;
  await app.checkReminders();
  assert.equal(eventsOf(gladys, TRIGGERS.DEPARTURE_SOON).length, 1);
  // République: the 2 at 18:37, 5 minutes before.
  clock.now += 40 * 1000;
  await app.checkReminders();
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.DEPARTURE_SOON).map((event) => [event.data.stop, event.data.minutes]),
    [
      [HOMME_A, '2'],
      [REPUB, '5'],
    ],
  );
});

test('traffic: a line disrupted, a new message, back to normal; a stop gets the others', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, LINE_C);
  // An accident on C, a disruption of the 2 (République), read 5 min later.
  api.state.messages.push(
    infoMessage({
      id: 'C-ACC',
      channel: 'Disruption',
      priority: 'Urgent',
      lines: ['C'],
      start: 2,
      end: null,
      title: ['Ligne C interrompue', 'Line C interrupted', 'Linie C unterbrochen'],
    }),
    infoMessage({ id: 'BUS-2', channel: 'Disruption', lines: ['02'], start: 2, end: 60 }),
  );
  clock.now += TRAFFIC_INTERVAL_MS;
  await app.readTraffic();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => [
      event.key,
      event.data.line ?? event.data.device,
      event.data.title,
    ]),
    [
      [TRIGGERS.LINE_DISRUPTED, LINE_C, 'Ligne C interrompue'],
      [TRIGGERS.TRAFFIC_MESSAGE, LINE_C, 'Ligne C interrompue'],
      [TRIGGERS.TRAFFIC_MESSAGE, REPUB, 'Travaux : tram A limité'],
    ],
  );
  const [, cMessage, busMessage] = gladys.fake.sceneEvents;
  assert.equal(cMessage.data.priority, 'urgent');
  assert.equal(cMessage.data.summary, 'CTS Perturbation (C) : Ligne C interrompue');
  assert.equal(busMessage.data.lines, '2');
  assert.equal(gladys.fake.lastState(`${LINE_C}:status`), 'Très perturbé : Ligne C interrompue');
  // Read again: nothing new. Then the accident is over.
  clock.now += TRAFFIC_INTERVAL_MS;
  await app.readTraffic();
  assert.equal(gladys.fake.sceneEvents.length, 3);
  api.state.messages = api.state.messages.filter((m) => m.ItemIdentifier !== 'C-ACC');
  clock.now += TRAFFIC_INTERVAL_MS;
  await app.readTraffic();
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.LINE_RESTORED).map((event) => [event.data.line, event.data.state]),
    [[LINE_C, 'info']],
  );
  // Within 5 minutes, not read again.
  const asked = api.apiCalls('general-message').length;
  clock.now += MINUTE;
  await app.readTraffic();
  assert.equal(api.apiCalls('general-message').length, asked);
});

test('a restart remembers what fired', async (t) => {
  const path = storePath();
  const first = await startApp({ path });
  first.clock.now += MINUTE;
  await first.app.readStops();
  await first.gladys.fake.shutdown();
  const second = await startApp({ path });
  t.after(() => second.gladys.fake.shutdown());
  second.clock.now += MINUTE;
  await second.app.readStops();
  await second.app.readTraffic({ force: true });
  assert.deepEqual(second.gladys.fake.sceneEvents, []);
});

test('without a token: the status says how to get one, nothing is asked', async (t) => {
  const { gladys, api } = await startApp({ config: { stop_1: 'Homme de Fer' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /open-data@cts-strasbourg\.fr/);
  assert.deepEqual(api.apiCalls('stop-monitoring'), []);
  const content = await widget(gladys, WIDGETS.DEPARTURES, { language: 'en' });
  assert.match(content.components[0].text, /^Enter the token/);
});

test('a refused token: disconnected, not asked again until the configuration changes', async (t) => {
  const { gladys, app, clock, api } = await startApp({ config: { ...CONFIG, token: 'wrong' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.equal(
    gladys.fake.connectionStatus.message.en,
    'The CTS API refuses the token: check it on the Configuration screen.',
  );
  // A refused token stops the round: the second stop is not asked.
  assert.equal(api.apiCalls('stop-monitoring').length, 1);
  clock.now += 10 * MINUTE;
  await app.readStops();
  await app.readTraffic();
  assert.equal(api.apiCalls('stop-monitoring').length, 1);
  assert.equal(api.apiCalls('general-message').length, 1);
  await gladys.fake.configUpdated({ ...CONFIG });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(api.apiCalls('stop-monitoring').length, 3);
});

test('a 429: every request pauses for 5 minutes', async (t) => {
  const { gladys, app, clock, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.state.fail = 429;
  clock.now += MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(
    gladys.fake.connectionStatus.message.fr,
    /demande de ralentir : reprise des lectures à 18:36/,
  );
  const asked = api.calls.length;
  api.state.fail = null;
  clock.now += 2 * MINUTE;
  await app.readStops();
  await app.readTraffic({ force: true });
  assert.equal(api.calls.length, asked);
  clock.now += 4 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('at night (nothing announced within 45 minutes), the stops are read every 10 minutes', async (t) => {
  const api = fakeCts();
  api.state.stops = { 275: [visit({ minutes: 70 })], 527: [] };
  const { gladys, app, clock } = await startApp({ api });
  t.after(() => gladys.fake.shutdown());
  const before = api.apiCalls('stop-monitoring').length;
  clock.now += 5 * MINUTE;
  await app.readStops();
  assert.equal(api.apiCalls('stop-monitoring').length, before);
  clock.now += IDLE_INTERVAL_MS - 5 * MINUTE;
  await app.readStops();
  assert.equal(api.apiCalls('stop-monitoring').length, before + 2);
});

test('widgets: departures of a followed, a typed and several stops; traffic of the tram lines', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const followed = await widget(gladys, WIDGETS.DEPARTURES, { language: 'fr', settings: {} });
  assert.equal(followed.components[0].text, 'Homme de Fer (Tram A → Illkirch)');
  assert.deepEqual(
    followed.components[2].items.map((item) => item.value),
    ['3 · 9 min'],
  );
  // A widget within a minute reuses the reading.
  assert.equal(api.apiCalls('stop-monitoring').length, 2);
  const typed = await widget(gladys, WIDGETS.DEPARTURES, {
    language: 'en',
    settings: { stop_name: '275B' },
  });
  assert.equal(typed.components[0].text, 'Homme de Fer');
  assert.deepEqual(api.apiCalls('stop-monitoring').at(-1).refs, ['275B']);
  const several = await widget(gladys, WIDGETS.DEPARTURES, {
    language: 'fr',
    settings: { stops: [HOMME_A, REPUB] },
  });
  assert.equal(several.components[0].text, 'Homme de Fer · République');
  const unknown = await widget(gladys, WIDGETS.DEPARTURES, {
    language: 'fr',
    settings: { stop_name: 'Nulle part' },
  });
  assert.equal(unknown.components[0].text, 'Inconnu ou ambigu : Nulle part.');
  const traffic = await widget(gladys, WIDGETS.TRAFFIC, { language: 'fr', settings: {} });
  assert.deepEqual(
    traffic.components[1].items.map((item) => [item.label, item.value]),
    [
      ['Tram A', 'Très perturbé'],
      ['Tram C', 'Information'],
    ],
  );
  const typedLines = await widget(gladys, WIDGETS.TRAFFIC, {
    language: 'de',
    settings: { lines: '2, D' },
  });
  assert.deepEqual(
    typedLines.components[1].items.map((item) => item.label),
    ['Linie 2', 'Tram D'],
  );
});

test('the traffic widget without anything followed shows the tram lines', async (t) => {
  const { gladys } = await startApp({ config: { token: TOKEN } });
  t.after(() => gladys.fake.shutdown());
  const content = await widget(gladys, WIDGETS.TRAFFIC, { language: 'en', settings: {} });
  assert.deepEqual(
    content.components[1].items.map((item) => item.label),
    ['Tram A', 'Tram B', 'Tram C', 'Tram D', 'Tram E', 'Tram F'],
  );
});

test('scene actions: the next passages of a stop, the traffic of a line', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const next = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_DEPARTURES, { stop: REPUB });
  assert.equal(next.success, true);
  assert.deepEqual(next.data.outputs ?? next.data, {
    stop_name: 'République',
    found: true,
    line: '2',
    destination: 'Jardin des Deux Rives via Etoile Bourse',
    minutes: 7,
    time: '18:37',
    realtime: true,
    following_minutes: -1,
    summary:
      'Prochain passage à République : 2 vers Jardin des Deux Rives via Etoile Bourse dans 7 min.',
  });
  const line = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_LINE_TRAFFIC, { line: LINE_C });
  const outputs = line.data.outputs ?? line.data;
  assert.equal(outputs.line_name, 'Tram C');
  assert.equal(outputs.state, 'info');
  const other = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_LINE_TRAFFIC, { line_name: 'D' });
  assert.equal((other.data.outputs ?? other.data).line_name, 'Tram D');
});

test('find, add, list and remove stops; the search spends no request', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const asked = api.calls.length;
  const found = await message(gladys, ACTIONS.SEARCH_STOP, { query: 'gare' });
  assert.equal(
    found.fr,
    'Saisissez le nom, ou un code entre crochets (le nombre : tous les quais ; avec sa lettre : un seul quai) :\n• Gare Centrale [230] (230C, 230D, 230E, 230G, 230L, 230M, 230R, 230U, 230X, 230Y)',
  );
  assert.equal(api.calls.length, asked);
  const added = await message(gladys, ACTIONS.ADD_STOP, { stop: 'Gare Centrale', line: 'C' });
  assert.match(added.en, /^Stop added: Gare Centrale \(C\)\. 3 stop\(s\) followed/);
  assert.deepEqual(gladys.fake.config.added_stops, [{ stop: '230', line: 'C', direction: '' }]);
  assert.ok(gladys.fake.discoveredDevices.some((d) => d.external_id === `${PREFIX}:stop:230_c`));
  assert.deepEqual(api.apiCalls('stop-monitoring').at(-1).refs, ['230']);
  const again = await message(gladys, ACTIONS.ADD_STOP, { stop: '230', line: 'C' });
  assert.match(again.en, /already followed/);
  const list = await message(gladys, ACTIONS.LIST_STOPS);
  assert.equal(
    list.en,
    '4 stop(s) followed:\n1. Homme de Fer (Tram A → Illkirch) (form, stop 1)\n2. République (form, stop 2)\n3. Nulle part (form, stop 3, unknown or ambiguous)\n4. Gare Centrale (C)',
  );
  const inForm = await message(gladys, ACTIONS.REMOVE_STOP, { stop: '1' });
  assert.match(inForm.en, /stop 1 of the form/);
  const removed = await message(gladys, ACTIONS.REMOVE_STOP, { stop: '4' });
  assert.match(removed.en, /^Stop removed: Gare Centrale \(C\)/);
  assert.deepEqual(gladys.fake.config.added_stops, []);
});

test('test the connection: network, stops, traffic', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const answer = await message(gladys, ACTIONS.TEST_CONNECTION);
  assert.match(answer.fr, /^Arrêts et lignes de la CTS lus : 7 arrêts, 12 lignes · /);
  assert.match(
    answer.fr,
    /Homme de Fer \(Tram A → Illkirch\) : 2 passage\(s\), prochain A dans 3 min/,
  );
  assert.match(answer.fr, /trafic : 2 message\(s\) sur le réseau/);
  assert.match(answer.fr, /inconnu ou ambigu : Nulle part · Lignes inconnues de la CTS : Z9\.$/);
});

test('the token never appears in the logs, the diagnostic or an error', async (t) => {
  const lines = [];
  const logger = {
    info: (...args) => lines.push(args.join(' ')),
    warn: (...args) => lines.push(args.join(' ')),
    error: (...args) => lines.push(args.map(String).join(' ')),
    debug() {},
  };
  const api = fakeCts();
  api.state.fail = 'network';
  const { gladys } = await startApp({ logger, api });
  t.after(() => gladys.fake.shutdown());
  api.state.fail = 401;
  await message(gladys, ACTIONS.TEST_CONNECTION);
  const answer = await message(gladys, ACTIONS.DIAGNOSTIC);
  assert.match(answer.en, /CTS diagnostic/);
  assert.ok(lines.some((line) => line.includes('CTS diagnostic 1/')));
  assert.ok(lines.some((line) => line.includes(`set (${TOKEN.length} characters)`)));
  const encoded = Buffer.from(`${TOKEN}:`).toString('base64');
  for (const line of lines) {
    assert.ok(!line.includes(TOKEN) && !line.includes(encoded), line);
  }
});

test('the GTFS cannot be read: a stop typed by its code still works', async (t) => {
  const api = fakeCts();
  api.state.failGtfs = 502;
  const { gladys } = await startApp({
    api,
    config: { token: TOKEN, stop_1: '275', stop_2: 'Homme de Fer' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['CTS 275'],
  );
  assert.deepEqual(
    api.apiCalls('stop-monitoring').map((call) => call.refs),
    [['275']],
  );
  assert.equal(gladys.fake.connectionStatus.connected, false);
});
