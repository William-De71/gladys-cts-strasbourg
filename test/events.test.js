// Scene triggers (transitions, once, baselines) and their payloads, and the
// outputs of the scene actions: flat scalars within the limits of the core.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectReminders,
  detectLineChanges,
  detectStopMessages,
  reminderData,
  messageData,
  lineEvent,
  nextDeparturesOutputs,
  lineTrafficOutputs,
  pick,
  tolerance,
  TRIGGERS,
  NEXT_DEPARTURES_OUTPUTS,
  LINE_TRAFFIC_OUTPUTS,
  MESSAGE_KEEP_MS,
} from '../src/events.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic, messagesFor } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  stopMonitoring,
  generalMessage,
  infoMessage,
  HOMME_DE_FER,
  MESSAGES,
  NOW,
  TZ,
} from './helpers/fixtures.js';

const MINUTE = 60 * 1000;
const PASSAGES = parsePassages(stopMonitoring(HOMME_DE_FER), { codes: ['275'] });
const FOLLOWED = {
  name: 'Homme de Fer (A)',
  deviceId: 'ext:cts-strasbourg:stop:275_a',
  stop: { id: '275', name: 'Homme de Fer', codes: ['275'] },
};
const LINE_A = { id: 'A', name: 'A', mode: 'tram', deviceId: 'ext:cts-strasbourg:line:a' };
const LINE_C = { id: 'C', name: 'C', mode: 'tram', deviceId: 'ext:cts-strasbourg:line:c' };
const traffic = (messages) => parseTraffic(generalMessage(messages));

/**
 * @description Assert a payload fits the scene events of the core.
 * @param {object} data - The payload.
 */
function assertFlat(data) {
  const entries = Object.entries(data);
  assert.ok(entries.length <= 30, `${entries.length} keys`);
  for (const [key, value] of entries) {
    const type = typeof value;
    assert.ok(
      value === null ||
        type === 'boolean' ||
        (type === 'number' && Number.isFinite(value)) ||
        (type === 'string' && value.length <= 1000),
      `${key}: ${JSON.stringify(value)}`,
    );
  }
}

test('reminders: the first reading is a baseline, then once per passage and mark', () => {
  const first = detectReminders({ passages: PASSAGES, fired: undefined, now: NOW });
  assert.deepEqual(first.due, []);
  // 18:30: the A in 3 min was due at the 3 mark; remembered, not fired.
  assert.ok(first.fired.some((entry) => entry.mark === 3));
  const later = detectReminders({ passages: PASSAGES, fired: first.fired, now: NOW + MINUTE });
  assert.deepEqual(
    later.due.map(({ passage, mark }) => [passage.line, passage.destination, mark]),
    [
      ['A', 'Illkirch Graffenstaden', 2],
      ['A', 'Parc des Sports', 3],
      ['D', 'Kehl Rathaus', 5],
    ],
  );
  const again = detectReminders({
    passages: PASSAGES,
    fired: later.fired,
    now: NOW + MINUTE + 20000,
  });
  assert.deepEqual(again.due, []);
  assert.deepEqual([2, 3, 5, 10].map(tolerance), [1, 1, 1.5, 3]);
});

test('lines: disrupted, back to normal, new messages; the first reading is a baseline', () => {
  const quiet = traffic([]);
  const first = detectLineChanges({ lines: [LINE_A, LINE_C], traffic: quiet, seen: {}, now: NOW });
  assert.deepEqual(first.changes, []);
  const busy = traffic([
    ...MESSAGES,
    infoMessage({ id: 'C-ACC', channel: 'Disruption', lines: ['C'], start: -5, end: null }),
  ]);
  const second = detectLineChanges({
    lines: [LINE_A, LINE_C],
    traffic: busy,
    seen: first.seen,
    now: NOW + MINUTE,
  });
  assert.deepEqual(
    second.changes.map((change) => [change.key, change.line.id, change.message?.id ?? null]),
    [
      [TRIGGERS.LINE_DISRUPTED, 'A', 'WORKS-A'],
      [TRIGGERS.TRAFFIC_MESSAGE, 'A', 'WORKS-A'],
      [TRIGGERS.TRAFFIC_MESSAGE, 'A', 'INFO-NET'],
      [TRIGGERS.LINE_DISRUPTED, 'C', 'C-ACC'],
      [TRIGGERS.TRAFFIC_MESSAGE, 'C', 'INFO-NET'],
      [TRIGGERS.TRAFFIC_MESSAGE, 'C', 'C-ACC'],
    ],
  );
  // Read again: nothing new.
  const third = detectLineChanges({
    lines: [LINE_A, LINE_C],
    traffic: busy,
    seen: second.seen,
    now: NOW + 2 * MINUTE,
  });
  assert.deepEqual(third.changes, []);
  // The accident on C is over.
  const fourth = detectLineChanges({
    lines: [LINE_C],
    traffic: traffic([MESSAGES[1]]),
    seen: third.seen,
    now: NOW + 3 * MINUTE,
  });
  assert.deepEqual(
    fourth.changes.map((change) => [change.key, change.traffic.state]),
    [[TRIGGERS.LINE_RESTORED, 'info']],
  );
});

test('an update fires again only when the CTS asks to notify it', () => {
  const seen = detectStopMessages({ messages: [], seen: undefined, now: NOW }).seen;
  const v1 = messagesFor(traffic([infoMessage({ notify: true })]), [LINE_A], NOW);
  const first = detectStopMessages({ messages: v1, seen, now: NOW });
  assert.equal(first.due.length, 1);
  const v2 = messagesFor(
    traffic([infoMessage({ version: 'WORKS-A-2', notify: true })]),
    [LINE_A],
    NOW,
  );
  const updated = detectStopMessages({ messages: v2, seen: first.seen, now: NOW + MINUTE });
  assert.deepEqual(
    updated.due.map(({ message, updated: flag }) => [message.version, flag]),
    [['WORKS-A-2', true]],
  );
  const silentUpdate = messagesFor(traffic([infoMessage({ version: 'WORKS-A-3' })]), [LINE_A], NOW);
  assert.deepEqual(
    detectStopMessages({ messages: silentUpdate, seen: updated.seen, now: NOW + 2 * MINUTE }).due,
    [],
  );
  // Forgotten a week after it disappeared.
  const later = detectStopMessages({
    messages: [],
    seen: updated.seen,
    now: NOW + MESSAGE_KEEP_MS + MINUTE,
  });
  assert.deepEqual(later.seen, {});
});

test('payloads: flat scalars, a summary in every language', () => {
  const [first] = PASSAGES;
  const busy = traffic(MESSAGES);
  const lineA = lineTraffic(busy, LINE_A, NOW);
  for (const language of LANGUAGES) {
    const soon = reminderData(FOLLOWED, first, 3, { language, timeZone: TZ });
    assertFlat(soon);
    assert.equal(soon.time, '18:33');
    assert.equal(soon.minutes, '3');
    const message = messageData({ deviceId: LINE_A.deviceId, name: 'Tram A' }, lineA.messages[0], {
      language,
      timeZone: TZ,
      lines: 'A',
    });
    assertFlat(message);
    assert.deepEqual(
      [message.kind, message.priority, message.state, message.updated],
      ['works', 'normal', 'major', false],
    );
    const disrupted = lineEvent(
      { key: TRIGGERS.LINE_DISRUPTED, line: LINE_A, traffic: lineA, message: lineA.messages[0] },
      { language, timeZone: TZ },
    );
    assertFlat(disrupted.data);
    const restored = lineEvent(
      { key: TRIGGERS.LINE_RESTORED, line: LINE_A, traffic: lineTraffic(traffic([]), LINE_A, NOW) },
      { language, timeZone: TZ },
    );
    assert.deepEqual(Object.keys(restored.data), ['line', 'line_name', 'state', 'summary']);
  }
  const fr = messageData({ deviceId: 'x', name: 'Homme de Fer' }, busy.messages[1], {
    language: 'fr',
    timeZone: TZ,
  });
  assert.equal(fr.lines, 'tout le réseau');
  assert.equal(fr.summary, 'CTS Information (tout le réseau) : Nouveaux horaires');
  assert.equal(
    reminderData(FOLLOWED, PASSAGES[4], 10, { language: 'fr', timeZone: TZ }).summary,
    '10 vers Gallia passe à Homme de Fer dans 10 min (18:42, horaire théorique).',
  );
});

test('scene action outputs: only the declared keys', () => {
  const outputs = pick(
    nextDeparturesOutputs({
      followed: FOLLOWED,
      passages: PASSAGES,
      now: NOW,
      language: 'fr',
      timeZone: TZ,
    }),
    NEXT_DEPARTURES_OUTPUTS,
  );
  assert.deepEqual(outputs, {
    stop_name: 'Homme de Fer (A)',
    found: true,
    line: 'A',
    destination: 'Illkirch Graffenstaden',
    minutes: 3,
    time: '18:33',
    realtime: true,
    following_minutes: 4,
    summary:
      'Prochain passage à Homme de Fer : A vers Illkirch Graffenstaden dans 3 min. Le suivant dans 4 min.',
  });
  const none = nextDeparturesOutputs({
    followed: FOLLOWED,
    passages: [],
    now: NOW,
    language: 'en',
    timeZone: TZ,
  });
  assert.deepEqual([none.found, none.minutes, none.following_minutes], [false, -1, -1]);
  const line = pick(
    lineTrafficOutputs({
      line: LINE_A,
      traffic: lineTraffic(traffic(MESSAGES), LINE_A, NOW),
      language: 'fr',
    }),
    LINE_TRAFFIC_OUTPUTS,
  );
  assert.deepEqual(Object.keys(line), LINE_TRAFFIC_OUTPUTS);
  assert.equal(line.state, 'major');
  assert.equal(line.disrupted, true);
  assert.equal(line.message_count, 2);
  assert.equal(line.summary, 'Tram A : Très perturbé. Travaux : tram A limité');
});
