// -----------------------------------------------------------------------------
// HTTP client of the official real-time API of the CTS (Compagnie des
// Transports Strasbourgeois): https://api.cts-strasbourg.eu/v1, described by
// https://api.cts-strasbourg.eu/v1/swagger.json (SIRI-lite 2.0, JSON).
//
// Every request carries the personal token of the user in the username of a
// Basic HTTP Authorization header (an empty password). The token comes from
// the open data account of the user on cts-strasbourg.eu. Without it, or with
// a wrong one, the API answers 401 with an empty body.
//
// Services used:
//   siri/2.0/stop-monitoring   the next passages of one or more stop codes
//                              (`MonitoringRef`, repeated): a StopCode of
//                              the GTFS ("275A", one side of the road) or a
//                              LogicalStopCode ("275", every side);
//   siri/2.0/general-message   the traffic messages of the network (works,
//                              disruptions, information), in FR / EN / DE.
//
// The CTS asks its users not to make excessive requests: each answer carries
// a cache-control header (and ValidUntil / ShortestPossibleCycle). A request
// asked again before its max-age gets the answer kept in memory, never a new
// request. Errors: 400 (a wrong parameter, `{ error }`), 401 (token), 429 or
// another code for an abusive client, 500 (technical, try later).
// The token is never written in a log or an error message.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const BASE_URL = process.env.CTS_API_URL || 'https://api.cts-strasbourg.eu/v1';
const TIMEOUT_MS = 20000;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const USER_AGENT = `gladys-cts-strasbourg/${version} (+https://github.com/William-De71/gladys-cts-strasbourg)`;
// The passages of a stop: enough for every line of a busy stop (Homme de Fer:
// four trams and buses each way), at least 3 per line.
const MAXIMUM_STOP_VISITS = 30;
const MINIMUM_STOP_VISITS_PER_LINE = 3;
// When the answer says nothing of its freshness.
const DEFAULT_MAX_AGE_MS = 20000;
// Never keep an answer longer than this, whatever it says.
const LONGEST_MAX_AGE_MS = 5 * 60 * 1000;

class CtsError extends Error {
  /**
   * @param {string} kind - `auth`, `no_key`, `throttled`, `busy`,
   * `unreachable` or `invalid`.
   * @param {string} message - The detail (never the token).
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'CtsError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The kind of an error answer.
 * @param {number} status - The HTTP status.
 * @returns {string} CtsError kind.
 */
function kindOf(status) {
  if (status === 401 || status === 403) {
    return 'auth';
  }
  if (status === 429) {
    return 'throttled';
  }
  if (status === 503 || status === 504) {
    return 'busy';
  }
  return status >= 500 ? 'unreachable' : 'invalid';
}

/**
 * @description Hide a token in a text.
 * @param {string} text - The text.
 * @param {string} key - The token.
 * @returns {string} The text, the token replaced by "***".
 */
function redact(text, key) {
  if (!key) {
    return String(text);
  }
  const encoded = Buffer.from(`${key}:`).toString('base64');
  return String(text).split(key).join('***').split(encoded).join('***');
}

/**
 * @description How long an answer stays valid, from its cache-control header.
 * @param {string|null} header - "public, max-age=30".
 * @returns {number} Milliseconds.
 * @example
 * maxAgeOf('max-age=30'); // -> 30000
 */
function maxAgeOf(header) {
  const match = /max-age=(\d+)/i.exec(String(header ?? ''));
  if (!match) {
    return DEFAULT_MAX_AGE_MS;
  }
  return Math.min(LONGEST_MAX_AGE_MS, Number(match[1]) * 1000);
}

/**
 * @description A client of the API.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {string} [options.baseUrl] - The API root (tests).
 * @returns {object} `{ stopMonitoring, generalMessage, requests, clear }`.
 */
function createCtsClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  baseUrl = BASE_URL,
} = {}) {
  // Requests made, for the diagnostic.
  const requests = { total: 0, cached: 0, failed: 0, last: null, lastError: null };
  // URL -> { json, until }: the answers still valid.
  const cache = new Map();

  /**
   * @description GET a service, or its answer kept while still valid.
   * @param {string} key - The token.
   * @param {string} path - "siri/2.0/stop-monitoring".
   * @param {URLSearchParams} query - The parameters.
   * @returns {Promise<object>} The JSON answer.
   */
  async function get(key, path, query) {
    if (!key) {
      throw new CtsError('no_key', 'no token');
    }
    const url = `${baseUrl}/${path}?${query}`;
    const kept = cache.get(url);
    if (kept && kept.key === key && kept.until > now()) {
      requests.cached += 1;
      return kept.json;
    }
    requests.total += 1;
    requests.last = now();
    const failure = (kind, message, extra) => {
      requests.failed += 1;
      const error = new CtsError(kind, redact(message, key), extra);
      requests.lastError = `${kind}: ${error.message}`;
      return error;
    };
    let response;
    try {
      response = await fetchFn(url, {
        headers: {
          accept: 'application/json',
          authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
          'user-agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw failure('unreachable', err.cause?.code ?? err.message);
    }
    const body = await response.text().catch(() => '');
    let json;
    try {
      json = body ? JSON.parse(body) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const detail = [`HTTP ${response.status}`, String(json?.error ?? '').slice(0, 160)]
        .filter(Boolean)
        .join(' ');
      throw failure(kindOf(response.status), detail, { status: response.status });
    }
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw failure('invalid', `${path}: not a JSON object`);
    }
    cache.set(url, {
      key,
      json,
      until: now() + maxAgeOf(response.headers?.get?.('cache-control')),
    });
    // Old answers go: the stops change with the configuration.
    for (const [address, entry] of cache) {
      if (entry.until <= now()) {
        cache.delete(address);
      }
    }
    return json;
  }

  /**
   * @description The next passages of some stop codes.
   * @param {object} options - Options.
   * @param {string} options.key - The token.
   * @param {string[]} options.codes - StopCodes ("275A") or LogicalStopCodes ("275").
   * @returns {Promise<object>} The answer (`ServiceDelivery.StopMonitoringDelivery`).
   */
  function stopMonitoring({ key, codes }) {
    const query = new URLSearchParams();
    [...new Set(codes)].sort().forEach((code) => query.append('MonitoringRef', code));
    query.set('MaximumStopVisits', String(MAXIMUM_STOP_VISITS));
    query.set('MinimumStopVisitsPerLine', String(MINIMUM_STOP_VISITS_PER_LINE));
    return get(key, 'siri/2.0/stop-monitoring', query);
  }

  /**
   * @description The traffic messages of the network.
   * @param {object} options - Options.
   * @param {string} options.key - The token.
   * @returns {Promise<object>} The answer (`ServiceDelivery.GeneralMessageDelivery`).
   */
  function generalMessage({ key }) {
    return get(key, 'siri/2.0/general-message', new URLSearchParams());
  }

  return { requests, stopMonitoring, generalMessage, clear: () => cache.clear() };
}

export {
  BASE_URL,
  USER_AGENT,
  MAXIMUM_STOP_VISITS,
  MINIMUM_STOP_VISITS_PER_LINE,
  CtsError,
  kindOf,
  redact,
  maxAgeOf,
  createCtsClient,
};
