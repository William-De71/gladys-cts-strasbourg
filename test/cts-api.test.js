// The HTTP client of the API of the CTS: the token in Basic auth, the cache
// of the answers, the errors, and the token never written anywhere.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCtsClient, redact, maxAgeOf, kindOf } from '../src/cts-api.js';
import { fakeCts, TOKEN, API_URL, NOW } from './helpers/fixtures.js';

const client = (api, clock = { now: NOW }) =>
  createCtsClient({ fetch: api, baseUrl: API_URL, now: () => clock.now });

test('stop-monitoring: the token in Basic auth, the codes repeated, the visits asked', async () => {
  const api = fakeCts();
  const answer = await client(api).stopMonitoring({ key: TOKEN, codes: ['527', '275', '275'] });
  const [call] = api.apiCalls('stop-monitoring');
  assert.equal(call.authorization, `Basic ${Buffer.from(`${TOKEN}:`).toString('base64')}`);
  assert.deepEqual(call.refs, ['275', '527']);
  assert.match(call.url, /MaximumStopVisits=30&MinimumStopVisitsPerLine=3$/);
  assert.equal(answer.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit.length, 6);
});

test('an answer is kept while its cache-control says so', async () => {
  const api = fakeCts();
  const clock = { now: NOW };
  const cts = client(api, clock);
  await cts.generalMessage({ key: TOKEN });
  clock.now += 20 * 1000;
  await cts.generalMessage({ key: TOKEN });
  assert.equal(api.apiCalls('general-message').length, 1);
  assert.equal(cts.requests.cached, 1);
  clock.now += 11 * 1000;
  await cts.generalMessage({ key: TOKEN });
  assert.equal(api.apiCalls('general-message').length, 2);
  cts.clear();
  await cts.generalMessage({ key: TOKEN });
  assert.equal(api.apiCalls('general-message').length, 3);
});

test('errors: no token, a refused token, too many requests, a server down', async () => {
  const api = fakeCts();
  const cts = client(api);
  await assert.rejects(cts.generalMessage({ key: '' }), { kind: 'no_key' });
  assert.equal(api.calls.length, 0, 'nothing asked without a token');
  await assert.rejects(cts.generalMessage({ key: 'wrong' }), { kind: 'auth', status: 401 });
  api.state.fail = 429;
  await assert.rejects(cts.stopMonitoring({ key: TOKEN, codes: ['275'] }), { kind: 'throttled' });
  api.state.fail = 503;
  await assert.rejects(cts.stopMonitoring({ key: TOKEN, codes: ['275'] }), { kind: 'busy' });
  api.state.fail = 'network';
  await assert.rejects(cts.stopMonitoring({ key: TOKEN, codes: ['275'] }), {
    kind: 'unreachable',
    message: 'ECONNREFUSED',
  });
  api.state.fail = null;
  assert.equal(cts.requests.failed, 4);
  assert.match(cts.requests.lastError, /^unreachable/);
});

test('a 400 gives its error text; the token is never in an error message', async () => {
  const echo = async () =>
    Response.json(
      { error: `bad token ${TOKEN} / ${Buffer.from(`${TOKEN}:`).toString('base64')}` },
      { status: 400 },
    );
  const cts = createCtsClient({ fetch: echo, baseUrl: API_URL, now: () => NOW });
  const err = await cts.generalMessage({ key: TOKEN }).catch((error) => error);
  assert.equal(err.kind, 'invalid');
  assert.equal(err.message, 'HTTP 400 bad token *** / ***');
  assert.doesNotMatch(cts.requests.lastError, new RegExp(TOKEN));
});

test('helpers: kinds, max-age, redaction', () => {
  assert.deepEqual([401, 403, 429, 503, 504, 500, 400].map(kindOf), [
    'auth',
    'auth',
    'throttled',
    'busy',
    'busy',
    'unreachable',
    'invalid',
  ]);
  assert.equal(maxAgeOf('public, max-age=45'), 45000);
  assert.equal(maxAgeOf(null), 20000);
  assert.equal(maxAgeOf('max-age=86400'), 300000);
  assert.equal(redact('token abc', ''), 'token abc');
});
