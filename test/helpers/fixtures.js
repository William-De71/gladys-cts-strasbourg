// A fake CTS for the tests, served through the `fetch` option of the
// integration: the open GTFS zip of the CTS (stops.txt and routes.txt reduced
// from the real ones of 2026-11-03, Licence Ouverte 2.0) and the SIRI-lite
// API (stop-monitoring, general-message).
//
// The answers of the API are BUILT from its OpenAPI description
// (https://api.cts-strasbourg.eu/v1/swagger.json): no token was at hand to
// record real ones. The 401 without a token (an empty body and
// `www-authenticate: Basic realm=""`) is the real answer of the server
// (2026-11-08). Tests never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

// 2026-11-08 18:30:00 in Strasbourg: the time of the answers.
const NOW = Date.parse('2026-11-08T17:30:00Z');
const TZ = 'Europe/Paris';
const TOKEN = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const API_URL = 'https://api.cts-strasbourg.eu/v1';
const GTFS_URL = 'https://opendata.cts-strasbourg.eu/google_transit.zip';

const text = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'cts-strasbourg-')), 'cts-strasbourg.json');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

/**
 * @description The CRC-32 of some bytes.
 * @param {Buffer} buf - The bytes.
 * @returns {number} The CRC.
 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @description A zip archive.
 * @param {object} files - `{ name: text | Buffer }`.
 * @param {object} [options] - `{ store }`: no compression.
 * @returns {Buffer} The archive.
 */
function makeZip(files, { store = false } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const packed = store ? data : deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const STOPS_TXT = text('gtfs/stops.txt');
const ROUTES_TXT = text('gtfs/routes.txt');
const GTFS_ZIP = makeZip({
  'agency.txt':
    'agency_id,agency_name,agency_url,agency_timezone\nCTS,CTS,http://www.cts-strasbourg.eu/,Europe/Paris\n',
  'stops.txt': STOPS_TXT,
  'routes.txt': ROUTES_TXT,
});

/**
 * @description "2026-11-08T18:35:00+01:00": a time of the API, minutes after NOW.
 * @param {number} minutes - Minutes after NOW (18:30 in Strasbourg).
 * @returns {string} The time, Paris wall clock with its offset.
 */
function at(minutes) {
  const wall = new Date(NOW + 3600000 + minutes * 60000).toISOString().slice(0, 19);
  return `${wall}+01:00`;
}

/**
 * @description A MonitoredStopVisit, as the swagger describes it.
 * @param {object} [options] - What differs from a tram A towards Illkirch at
 * Homme de Fer (275A) in 5 minutes, followed live.
 * @returns {object} The visit.
 */
function visit({
  code = '275A',
  asked = '275',
  name = 'Homme de Fer',
  lineRef = 'A',
  line = 'A',
  mode = 'tram',
  destination = 'Illkirch Graffenstaden',
  via = null,
  minutes = 5,
  realtime = true,
  direction = 0,
  trip = `SAE-${lineRef}-${minutes}`,
} = {}) {
  return {
    RecordedAtTime: at(0),
    MonitoringRef: asked,
    StopCode: code,
    MonitoredVehicleJourney: {
      LineRef: lineRef,
      DirectionRef: direction,
      FramedVehicleJourneyRef: { DatedVehicleJourneySAERef: trip },
      VehicleMode: mode,
      PublishedLineName: line,
      DestinationName: destination,
      DestinationShortName: destination.slice(0, 12),
      Via: via,
      MonitoredCall: {
        StopPointName: name,
        StopCode: code,
        Order: 12,
        ExpectedDepartureTime: at(minutes),
        ExpectedArrivalTime: at(minutes),
        Extension: {
          IsRealTime: realtime,
          DataSource: realtime ? 'SAE' : 'Theorique',
          Experimentation: null,
        },
      },
      PreviousCall: [],
      OnwardCall: [],
    },
  };
}

/**
 * @description An answer of stop-monitoring.
 * @param {object[]} visits - The visits.
 * @returns {object} The answer.
 */
function stopMonitoring(visits) {
  return {
    ServiceDelivery: {
      ResponseTimestamp: at(0),
      RequestMessageRef: null,
      StopMonitoringDelivery: [
        {
          version: '2.0',
          ResponseTimestamp: at(0),
          ValidUntil: at(1),
          ShortestPossibleCycle: 'PT30S',
          MonitoringRef: [...new Set(visits.map((entry) => entry.MonitoringRef))],
          MonitoredStopVisit: visits,
        },
      ],
      VehicleMonitoringDelivery: null,
      EstimatedTimetableDelivery: null,
      GeneralMessageDelivery: null,
    },
  };
}

const zone = (ref, fr, en = fr, de = fr) => ({
  MessageZoneRef: ref,
  MessageText: [
    { Value: fr, Lang: 'FR' },
    { Value: en, Lang: 'EN' },
    { Value: de, Lang: 'DE' },
  ],
});

/**
 * @description An InfoMessage, as the swagger describes it.
 * @param {object} [options] - What differs from works on tram A, under way.
 * @returns {object} The message.
 */
function infoMessage({
  id = 'WORKS-A',
  version = `${id}-1`,
  channel = 'Works',
  lines = ['A'],
  network = false,
  priority = 'Normal',
  start = -60 * 24,
  end = 60 * 24 * 5,
  notify = false,
  title = ['Travaux : tram A limité', 'Works: tram A shortened', 'Bauarbeiten: Tram A verkürzt'],
  details = [
    'Le tram A ne circule pas entre Lixenbuhl et Illkirch Graffenstaden. Navette bus.',
    'Tram A does not run between Lixenbuhl and Illkirch Graffenstaden. Shuttle bus.',
    'Die Tram A fährt nicht zwischen Lixenbuhl und Illkirch Graffenstaden. Busshuttle.',
  ],
  period = ['Du 7 au 13 novembre', 'From 7 to 13 November', 'Vom 7. bis 13. November'],
} = {}) {
  return {
    formatRef: 'CTS',
    RecordedAtTime: at(-60),
    ItemIdentifier: id,
    InfoMessageIdentifier: version,
    InfoChannelRef: channel,
    ValidUntilTime: at(60 * 6),
    Content: {
      ImpactStartDateTime: at(start),
      ImpactEndDateTime: end === null ? null : at(end),
      ImpactedGroupOfLinesRef: network ? 'CTS' : null,
      ImpactedLineRef: network ? null : lines,
      TypeOfPassengerEquipmentRef: 'WEB',
      Priority: priority,
      SendUpdatedNotificationsToCustomers: notify,
      Message: [zone('title', ...title), zone('details', ...details), zone('period', ...period)],
    },
  };
}

/**
 * @description An answer of general-message.
 * @param {object[]} messages - The InfoMessages.
 * @returns {object} The answer.
 */
function generalMessage(messages) {
  return {
    ServiceDelivery: {
      ResponseTimestamp: at(0),
      RequestMessageRef: null,
      StopMonitoringDelivery: null,
      VehicleMonitoringDelivery: null,
      EstimatedTimetableDelivery: null,
      GeneralMessageDelivery: [
        {
          version: '2.0',
          ResponseTimestamp: at(0),
          ShortestPossibleCycle: 'PT1M',
          InfoMessage: messages,
        },
      ],
    },
  };
}

// Homme de Fer (275): trams A and D both ways, bus 10; République (527): bus 2.
const HOMME_DE_FER = [
  visit({ minutes: 3 }),
  visit({ minutes: 9, trip: 'SAE-A-9' }),
  visit({ code: '275B', destination: 'Parc des Sports', direction: 1, minutes: 4 }),
  visit({ lineRef: 'D', line: 'D', destination: 'Kehl Rathaus', minutes: 6, code: '275C' }),
  visit({
    lineRef: '10',
    line: '10',
    mode: 'bus',
    code: '275D',
    destination: 'Gallia',
    minutes: 12,
    realtime: false,
  }),
];
const REPUBLIQUE = [
  visit({
    asked: '527',
    code: '527A',
    name: 'République',
    lineRef: '02',
    line: '2',
    mode: 'bus',
    destination: 'Jardin des Deux Rives',
    via: 'Etoile Bourse',
    minutes: 7,
  }),
];
const MESSAGES = [
  infoMessage(),
  infoMessage({
    id: 'INFO-NET',
    channel: 'Information',
    network: true,
    title: ['Nouveaux horaires', 'New timetables', 'Neue Fahrpläne'],
    details: [
      'Nouveaux horaires dès le 1er décembre.',
      'New timetables from 1 December.',
      'Neue Fahrpläne ab 1. Dezember.',
    ],
    period: ['', '', ''],
  }),
];

/**
 * @description The fake CTS.
 * @returns {Function} A fetch function, with `.calls` and `.state`.
 */
function fakeCts() {
  const state = {
    // LogicalStopCode or StopCode -> visits.
    stops: { 275: clone(HOMME_DE_FER), 527: clone(REPUBLIQUE) },
    messages: clone(MESSAGES),
    // 'network', or an HTTP status, for every API request.
    fail: null,
    failGtfs: null,
    maxAge: 30,
  };
  const calls = [];

  /**
   * @description The fetch function.
   * @param {string} url - The URL.
   * @param {object} [init] - The request (headers).
   * @returns {Promise<Response>} The answer.
   */
  async function fetchFn(url, init = {}) {
    const parsed = new URL(url);
    const headers = init.headers ?? {};
    calls.push({
      url,
      path: parsed.pathname,
      refs: parsed.searchParams.getAll('MonitoringRef'),
      authorization: headers.authorization ?? null,
    });
    if (url === GTFS_URL) {
      if (state.failGtfs) {
        return new Response('Bad Gateway', { status: state.failGtfs });
      }
      return new Response(GTFS_ZIP, {
        status: 200,
        headers: { 'content-type': 'application/zip' },
      });
    }
    if (!url.startsWith(API_URL)) {
      return new Response('Not Found', { status: 404 });
    }
    if (state.fail === 'network') {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    }
    if (typeof state.fail === 'number') {
      return new Response('', { status: state.fail });
    }
    const expected = `Basic ${Buffer.from(`${TOKEN}:`).toString('base64')}`;
    if (headers.authorization !== expected) {
      return new Response('', { status: 401, headers: { 'www-authenticate': 'Basic realm=""' } });
    }
    const cache = { 'cache-control': `public, max-age=${state.maxAge}` };
    if (parsed.pathname.endsWith('/siri/2.0/stop-monitoring')) {
      const refs = parsed.searchParams.getAll('MonitoringRef');
      if (refs.length === 0) {
        return Response.json({ error: 'MonitoringRef is required' }, { status: 400 });
      }
      const visits = refs.flatMap((ref) =>
        (state.stops[ref.replace(/[A-Z]+$/, '')] ?? []).filter(
          (entry) => ref === entry.MonitoringRef || entry.StopCode === ref,
        ),
      );
      return Response.json(stopMonitoring(visits), { headers: cache });
    }
    if (parsed.pathname.endsWith('/siri/2.0/general-message')) {
      return Response.json(generalMessage(state.messages), { headers: cache });
    }
    return new Response('Not Found', { status: 404 });
  }
  fetchFn.calls = calls;
  fetchFn.state = state;
  fetchFn.apiCalls = (service) =>
    calls.filter((call) => call.path.endsWith(`/siri/2.0/${service}`));
  return fetchFn;
}

/**
 * @description A minimal Gladys client for the pure builders.
 */
const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:cts-strasbourg:${type}:${id}`,
    feature: (key) => `ext:cts-strasbourg:${type}:${id}:${key}`,
  }),
};

export {
  NOW,
  TZ,
  TOKEN,
  API_URL,
  GTFS_URL,
  STOPS_TXT,
  ROUTES_TXT,
  GTFS_ZIP,
  HOMME_DE_FER,
  REPUBLIQUE,
  MESSAGES,
  silent,
  storePath,
  clone,
  makeZip,
  at,
  visit,
  stopMonitoring,
  infoMessage,
  generalMessage,
  fakeCts,
  fakeGladys,
};
