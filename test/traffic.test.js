// The traffic messages of the CTS (SIRI GM) -> the state of each line.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTraffic,
  messageOf,
  messageState,
  lineTraffic,
  messagesFor,
  plainText,
  zoneText,
} from '../src/traffic.js';
import { generalMessage, infoMessage, MESSAGES, NOW } from './helpers/fixtures.js';

const MINUTE = 60 * 1000;
const A = { id: 'A', name: 'A' };
const C = { id: 'C', name: 'C' };
const TWO = { id: '02', name: '2' };

test('a message: its texts in the language asked (French by default), its lines, its dates', () => {
  const [works, info] = parseTraffic(generalMessage(MESSAGES)).messages;
  assert.equal(works.id, 'WORKS-A');
  assert.equal(works.channel, 'works');
  assert.equal(works.title, 'Travaux : tram A limité');
  assert.match(works.text, /^Le tram A ne circule pas/);
  assert.equal(works.period, 'Du 7 au 13 novembre');
  assert.deepEqual(works.lineIds, ['A']);
  assert.equal(works.network, false);
  assert.equal(works.start, NOW - 24 * 60 * MINUTE);
  // "ne circule pas": an interruption.
  assert.equal(works.state, 'major');
  assert.equal(info.network, true);
  assert.equal(info.state, 'info');
  assert.equal(info.period, '');
  const [english] = parseTraffic(generalMessage(MESSAGES), 'en').messages;
  assert.equal(english.title, 'Works: tram A shortened');
  const [german] = parseTraffic(generalMessage(MESSAGES), 'de').messages;
  assert.equal(german.period, 'Vom 7. bis 13. November');
  // The weight never depends on the language shown.
  assert.equal(german.state, 'major');
  assert.equal(english.state, 'major');
});

test('the weight of a message: its channel, its priority, its words', () => {
  assert.equal(messageState('disruption', 'normal', ''), 'disrupted');
  assert.equal(messageState('disruption', 'urgent', ''), 'major');
  assert.equal(messageState('planned_disruption', 'normal', 'Arrêt non desservi'), 'disrupted');
  assert.equal(messageState('planned_disruption', 'normal', 'Ligne interrompue'), 'major');
  assert.equal(messageState('works', 'normal', 'Ligne C déviée'), 'disrupted');
  assert.equal(messageState('works', 'normal', 'Travaux de nuit sur la voie'), 'info');
  assert.equal(messageState('information', 'extreme', 'Interruption'), 'info');
});

test('texts: tags dropped, a missing language falls back to French, an empty message is dropped', () => {
  assert.equal(plainText('<p>Ligne <b>A</b>&nbsp;:</p><p>déviée</p>'), 'Ligne A :\ndéviée');
  const zones = [{ MessageZoneRef: 'title', MessageText: [{ Value: 'Titre', Lang: 'FR' }] }];
  assert.equal(zoneText(zones, 'title', 'de'), 'Titre');
  assert.equal(zoneText(zones, 'details', 'fr'), '');
  assert.equal(messageOf({ ItemIdentifier: 'x', Content: { Message: [] } }), null);
  assert.equal(messageOf(null), null);
  // Without a title, the first sentence of the text.
  const untitled = messageOf(
    infoMessage({ title: ['', '', ''], details: ['Ligne C déviée. Arrêts reportés.', '', ''] }),
  );
  assert.equal(untitled.title, 'Ligne C déviée.');
});

test('the state of a line: its heaviest message under way, the coming ones apart', () => {
  const traffic = parseTraffic(
    generalMessage([
      ...MESSAGES,
      infoMessage({
        id: 'C-DISRUPTED',
        channel: 'Disruption',
        lines: ['C'],
        start: -10,
        end: null,
        title: ['Ligne C : accident', 'Line C: accident', 'Linie C: Unfall'],
      }),
      infoMessage({ id: 'C-WORKS', lines: ['C'], start: 60 * 24, end: 60 * 48 }),
      infoMessage({ id: 'C-FAR', lines: ['C'], start: 60 * 24 * 10, end: 60 * 24 * 12 }),
      infoMessage({ id: 'C-OVER', lines: ['C'], start: -120, end: -60 }),
    ]),
  );
  const a = lineTraffic(traffic, A, NOW);
  assert.equal(a.state, 'major');
  assert.deepEqual(
    a.messages.map((m) => m.id),
    ['WORKS-A', 'INFO-NET'],
  );
  const c = lineTraffic(traffic, C, NOW);
  assert.equal(c.state, 'disrupted');
  assert.equal(c.since, NOW - 10 * MINUTE);
  assert.deepEqual(
    c.upcoming.map((m) => m.id),
    ['C-WORKS'],
  );
  // The network message only: information.
  assert.equal(lineTraffic(traffic, TWO, NOW).state, 'info');
  assert.equal(lineTraffic(parseTraffic(generalMessage([])), TWO, NOW).state, 'normal');
  assert.equal(lineTraffic(null, A, NOW).state, 'unknown');
});

test('the messages of a stop: about its lines, or the whole network', () => {
  const traffic = parseTraffic(generalMessage(MESSAGES));
  const messages = messagesFor(traffic, [A, TWO], NOW);
  assert.deepEqual(
    messages.map((m) => [m.id, m.lines]),
    [
      ['WORKS-A', ['A']],
      ['INFO-NET', []],
    ],
  );
  assert.deepEqual(
    messagesFor(traffic, [TWO], NOW).map((m) => m.id),
    ['INFO-NET'],
  );
  assert.deepEqual(messagesFor(null, [A], NOW), []);
});
