// The widget contents pass the validator of the SDK (what the core would
// drop or truncate), in every language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildDeparturesWidget,
  buildTrafficWidget,
  messageContent,
  readCount,
  routeValue,
  shortDate,
  dateText,
  BOARD_COUNT,
} from '../src/widgets.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  NOW,
  TZ,
  stopMonitoring,
  generalMessage,
  infoMessage,
  visit,
  HOMME_DE_FER,
  REPUBLIQUE,
  MESSAGES,
} from './helpers/fixtures.js';

const MINUTE = 60 * 1000;
const HOMME = parsePassages(stopMonitoring(HOMME_DE_FER), { codes: ['275'] });
const REPUB = parsePassages(stopMonitoring(REPUBLIQUE), { codes: ['527'] });
const TRAMS = [
  { id: 'A', name: 'A', mode: 'tram' },
  { id: 'C', name: 'C', mode: 'tram' },
  { id: 'D', name: 'D', mode: 'tram' },
];

/**
 * @description Assert that the core would keep the content whole.
 * @param {object} content - The content.
 * @param {string} label - For the message.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
}

const departures = (options) =>
  buildDeparturesWidget({ count: 6, now: NOW, timeZone: TZ, readAt: NOW, ...options });

test('departures widget: one compact row per route, soonest first, in every language', () => {
  for (const language of LANGUAGES) {
    assertValid(departures({ title: 'Homme de Fer', passages: HOMME, language }), language);
  }
  const content = departures({ title: 'Homme de Fer', passages: HOMME, language: 'fr' });
  const [heading, caption, status] = content.components;
  assert.equal(heading.text, 'Homme de Fer');
  assert.equal(caption.text, 'CTS · mis à jour à 18:30 · * horaire théorique');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value, item.color]),
    [
      ['A → Illkirch Graffenstaden', '3 · 9 min', 'success'],
      ['A → Parc des Sports', '4 min', 'success'],
      ['D → Kehl Rathaus', '6 min', 'success'],
      // The timetable only: a star, a neutral row.
      ['10 → Gallia', '12* min', 'neutral'],
    ],
  );
});

test('departures widget: times beyond an hour, approaching, nothing announced', () => {
  const later = parsePassages(
    stopMonitoring([visit({ minutes: 0.5 }), visit({ minutes: 75, trip: 'late' })]),
    { codes: ['275'] },
  );
  const content = departures({ title: 'Homme de Fer', passages: later, language: 'en' });
  assertValid(content, 'far');
  assert.equal(content.components[2].items[0].value, 'Approaching · 19:45');
  const empty = departures({ title: 'Homme de Fer', passages: [], language: 'de' });
  assertValid(empty, 'empty');
  assert.equal(empty.components[1].text, 'Keine Abfahrt angekündigt. CTS · aktualisiert um 18:30.');
  assert.equal(routeValue([], { language: 'en', now: NOW, timeZone: TZ }), '');
});

test('departures widget: several stops in one list, a row per stop then its routes', () => {
  const content = buildDeparturesWidget({
    boards: [
      { title: 'Homme de Fer (A)', label: 'Homme de Fer', passages: HOMME, readAt: NOW },
      { title: 'République', passages: REPUB, readAt: NOW - MINUTE },
    ],
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'several');
  const [heading, caption, status] = content.components;
  assert.equal(heading.text, 'Homme de Fer · République');
  assert.equal(caption.text, 'CTS · * horaire théorique');
  assert.deepEqual(
    status.items.filter((item) => item.icon === 'map-pin').map((item) => item.value),
    ['lu à 18:30', 'lu à 18:29'],
  );
  assert.ok(status.items.some((item) => item.label === '2 → Jardin des Deux Rives via Etoile Bo…'));
});

test('traffic widget: a status row per line, one card per message, in every language', () => {
  const traffic = parseTraffic(
    generalMessage([
      ...MESSAGES,
      infoMessage({ id: 'C-ACC', channel: 'Disruption', lines: ['C'], start: -5, end: null }),
      infoMessage({ id: 'D-SOON', lines: ['D'], start: 60 * 24, end: 60 * 30 }),
    ]),
  );
  const lines = TRAMS.map((line) => ({ line, traffic: lineTraffic(traffic, line, NOW) }));
  for (const language of LANGUAGES) {
    assertValid(
      buildTrafficWidget({ lines, readAt: NOW, language, now: NOW, timeZone: TZ }),
      language,
    );
  }
  const content = buildTrafficWidget({
    lines,
    readAt: NOW,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  const [heading, status, list, caption] = content.components;
  assert.equal(heading.text, 'Trafic CTS');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value, item.color]),
    [
      ['Tram A', 'Très perturbé', 'danger'],
      ['Tram C', 'Perturbé', 'warning'],
      ['Tram D', 'Information', 'info'],
    ],
  );
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle, item.badge?.text]),
    [
      ['Travaux : tram A limité', 'Travaux · Du 7 au 13 novembre', 'A'],
      ['Travaux : tram A limité', 'Perturbation · Du 7 au 13 novembre', 'C'],
      ['Nouveaux horaires', 'Information · 07/11 18:30 → 13/11 18:30', 'Réseau'],
      ['Travaux : tram A limité', 'À venir · Du 7 au 13 novembre', 'D'],
    ],
  );
  assert.equal(caption.text, 'CTS · mis à jour à 18:30');
});

test('traffic widget: nothing under way', () => {
  const quiet = parseTraffic(generalMessage([]));
  const content = buildTrafficWidget({
    lines: TRAMS.map((line) => ({ line, traffic: lineTraffic(quiet, line, NOW) })),
    readAt: NOW,
    language: 'en',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'quiet');
  assert.equal(content.components[2].text, 'No traffic message under way. CTS · updated at 18:30.');
});

test('messages and settings', () => {
  assertValid(messageContent('Hello'), 'message');
  assert.equal(readCount(undefined, BOARD_COUNT), BOARD_COUNT.default);
  assert.equal(readCount('99', BOARD_COUNT), BOARD_COUNT.max);
  assert.equal(readCount(0, BOARD_COUNT), BOARD_COUNT.min);
  assert.equal(shortDate(Date.parse('2026-12-31T22:59:00Z'), TZ), '31/12');
  assert.equal(shortDate(null, TZ), '');
  assert.equal(dateText(Date.parse('2026-11-08T15:48:00Z'), NOW, TZ), '16:48');
  assert.equal(dateText(Date.parse('2026-11-06T20:31:00Z'), NOW, TZ), '06/11 21:31');
  assert.equal(dateText(null, NOW, TZ), '');
});
