// -----------------------------------------------------------------------------
// The stops and lines of the CTS, kept in /data.
//
// They come from the open GTFS of the CTS (Licence Ouverte 2.0), published on
// https://opendata.cts-strasbourg.eu/google_transit.zip and listed on
// transport.data.gouv.fr ("Réseau urbain CTS"): only stops.txt and routes.txt
// are inflated, read again every seven days. Searching and resolving a stop
// or a line is thus local: it never spends a request of the token.
//
// Codes of a stop (as the API documents them):
//   - the StopCode, `stop_code` of stops.txt ("275A"): one side of the road,
//     one direction;
//   - the LogicalStopCode, the StopCode without its letter ("275"): the whole
//     stop, every direction.
// A stop is typed by its name ("Homme de Fer"), by words of it when one stop
// only holds them all, by its logical code ("275") or by a StopCode ("275A").
// A name may hold several logical codes (the platforms of a stop renamed): all
// of them are asked.
//
// A line is `{ id, name, mode, color }`: `id` the route_id ("A", "02"), the
// LineRef of the API; `name` the short name read on the vehicles ("A", "2").
// Names are compared folded: no case, no accent, no punctuation.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { zipEntries, readEntry, eachRow } from './zip.js';

const GTFS_URL =
  process.env.CTS_GTFS_URL || 'https://opendata.cts-strasbourg.eu/google_transit.zip';
const NETWORK_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const TIMEOUT_MS = 60000;
// The zip is about 6 MB: anything far beyond is not the timetable.
const MAX_ZIP_BYTES = 60 * 1024 * 1024;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const USER_AGENT = `gladys-cts-strasbourg/${version} (+https://github.com/William-De71/gladys-cts-strasbourg)`;
const MODES = { BUS: 'bus', TRAM: 'tram' };
// Words a typed line may hold around its name: "bus 2", "tram A", "ligne C1".
const LINE_WORDS = /\b(bus|tram|tramway|ligne|line|linie|linea|lignes|lines)\b/g;

class NetworkError extends Error {
  /**
   * @param {string} kind - `unreachable` or `invalid`.
   * @param {string} message - The detail.
   */
  constructor(kind, message) {
    super(message);
    this.name = 'NetworkError';
    this.kind = kind;
  }
}

/**
 * @description Fold a text for comparisons.
 * @param {unknown} value - The text.
 * @returns {string} Lower case, no accent, words separated by one space.
 * @example
 * fold('Gare Centrale (Tram)'); // -> 'gare centrale tram'
 */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @description A slug for an external id.
 * @param {unknown} value - The text.
 * @param {number} [max] - The longest slug.
 * @returns {string} "neuhof-rodolphe-reuss".
 */
function slug(value, max = 40) {
  return fold(value).replace(/ /g, '-').slice(0, max).replace(/-+$/, '');
}

/**
 * @description The logical code of a StopCode: its digits.
 * @param {unknown} code - "275A".
 * @returns {string} "275", '' when not a stop code.
 */
function logicalOf(code) {
  return /^(\d{1,5})[A-Z]{0,2}$/i.exec(String(code ?? '').trim())?.[1] ?? '';
}

/**
 * @description Whether a typed text is a stop code.
 * @param {string} typed - The text.
 * @returns {boolean} True for "275" or "275A".
 */
const isStopCode = (typed) => /^\d{1,5}[A-Z]{0,2}$/i.test(String(typed ?? '').trim());

/**
 * @description The stops of a stops.txt, grouped by name ("Gare Centrale" and
 * "Gare centrale" are one stop, named as most of its sides are).
 * @param {Buffer} csv - Its bytes.
 * @returns {Array<[string, string[], string[]]>} `[name, logical codes,
 * StopCodes]`, sorted by name.
 */
function parseStops(csv) {
  const byName = new Map();
  eachRow(csv, (row, column) => {
    const code = String(row[column('stop_code')] ?? '')
      .trim()
      .toUpperCase();
    const name = String(row[column('stop_name')] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const logical = logicalOf(code);
    if (!logical || !name) {
      return;
    }
    const key = fold(name);
    const entry = byName.get(key) ?? { names: new Map(), logical: new Set(), codes: new Set() };
    entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
    entry.logical.add(logical);
    entry.codes.add(code);
    byName.set(key, entry);
  });
  const numeric = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  return [...byName.values()]
    .map(({ names, logical, codes }) => [
      [...names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      [...logical].sort(numeric),
      [...codes].sort(numeric),
    ])
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'));
}

/**
 * @description The lines of a routes.txt.
 * @param {Buffer} csv - Its bytes.
 * @returns {Array<{ id: string, name: string, mode: string, color: string }>}
 * The lines, trams first, then by name.
 */
function parseLines(csv) {
  const lines = [];
  eachRow(csv, (row, column) => {
    const id = String(row[column('route_id')] ?? '').trim();
    const name = String(row[column('route_short_name')] ?? '').trim() || id;
    if (!id) {
      return;
    }
    const type = String(row[column('route_type')] ?? '').trim();
    const color = String(row[column('route_color')] ?? '').trim();
    lines.push({
      id,
      name,
      mode: type === '0' ? MODES.TRAM : MODES.BUS,
      color: /^[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : '',
    });
  });
  return lines.sort(
    (a, b) =>
      Number(a.mode !== MODES.TRAM) - Number(b.mode !== MODES.TRAM) ||
      a.name.localeCompare(b.name, 'fr', { numeric: true }),
  );
}

/**
 * @description The stop of a group of codes.
 * @param {string} name - Its name.
 * @param {string[]} codes - The codes asked (logical or StopCodes).
 * @returns {{ id: string, name: string, codes: string[] }} The stop: `id` the
 * codes, lower case, joined by "-" ("275", "31-778", "275a").
 */
function stopOf(name, codes) {
  return { id: codes.join('-').toLowerCase(), name, codes };
}

/**
 * @description Find a stop among the known ones.
 * @param {Array} stops - parseStops().
 * @param {string} typed - Its code, its name, or words of its name.
 * @returns {{ id: string, name: string, codes: string[] }|null} The stop,
 * null when unknown or when the words fit several stops.
 */
function findStop(stops, typed) {
  const text = String(typed ?? '').trim();
  if (!text) {
    return null;
  }
  if (isStopCode(text)) {
    const code = text.toUpperCase();
    // A StopCode names one side; a logical code the whole stop.
    const known = stops.find(([, logical, codes]) =>
      code === logicalOf(code) ? logical.includes(code) : codes.includes(code),
    );
    // A code the list does not know (a new stop) is still asked to the API.
    return stopOf(known?.[0] ?? code, [code]);
  }
  const wanted = fold(text);
  const exact = stops.find(([name]) => fold(name) === wanted);
  if (exact) {
    return stopOf(exact[0], exact[1]);
  }
  const words = wanted.split(' ').filter(Boolean);
  const holding = stops.filter(([name]) => {
    const folded = ` ${fold(name)} `;
    return words.every((word) => folded.includes(` ${word}`));
  });
  return holding.length === 1 ? stopOf(holding[0][0], holding[0][1]) : null;
}

/**
 * @description Search stops by name, for the "Find a stop" button.
 * @param {Array} stops - parseStops().
 * @param {string} query - Words of the name.
 * @param {number} [max] - The longest list.
 * @returns {{ found: Array<{ name: string, codes: string[], sides: string[] }>, total: number }}
 * The best matches first (the name starting with the words), and their count.
 */
function searchStops(stops, query, max = 12) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) {
    return { found: [], total: 0 };
  }
  const wanted = words.join(' ');
  const matches = stops
    .filter(([name]) => {
      const folded = ` ${fold(name)} `;
      return words.every((word) => folded.includes(` ${word}`));
    })
    .map(([name, codes, sides]) => {
      const folded = fold(name);
      let score = 2;
      if (folded === wanted) {
        score = 0;
      } else if (folded.startsWith(wanted) || folded.includes(` ${wanted}`)) {
        score = 1;
      }
      return { name, codes, sides, score };
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'fr'));
  return {
    found: matches.slice(0, max).map(({ name, codes, sides }) => ({ name, codes, sides })),
    total: matches.length,
  };
}

/**
 * @description A typed line, folded, without the words around its name.
 * @param {string} typed - "Tram A", "bus 2", "ligne C1".
 * @returns {string} "a", "2", "c1".
 */
function typedLine(typed) {
  const folded = fold(typed);
  const bare = folded.replace(LINE_WORDS, ' ').replace(/\s+/g, ' ').trim();
  return bare || folded;
}

/**
 * @description Find a line.
 * @param {Array} lines - parseLines().
 * @param {string} typed - Its name ("A", "Tram A", "2", "C1") or route id ("02").
 * @returns {object|null} The line.
 */
function findLine(lines, typed) {
  const wanted = typedLine(typed);
  if (!wanted) {
    return null;
  }
  return (
    lines.find((line) => fold(line.name) === wanted) ??
    lines.find((line) => fold(line.id) === wanted) ??
    // "02" for "2": the route ids pad the bus numbers.
    (/^\d+$/.test(wanted)
      ? lines.find((line) => /^\d+$/.test(line.name) && Number(line.name) === Number(wanted))
      : undefined) ??
    null
  );
}

/**
 * @description Split a typed list of lines: "A, C, 2" or "A C 2".
 * @param {string} raw - The list.
 * @returns {string[]} The lines typed.
 */
function splitLines(raw) {
  return String(raw ?? '')
    .split(/[,;|]+/)
    .flatMap((part) => {
      const trimmed = part.trim();
      // "A C 2" without commas: each word is a line, unless it reads "tram A".
      const named = typedLine(trimmed) !== fold(trimmed);
      return /\s/.test(trimmed) && !named ? trimmed.split(/\s+/) : [trimmed];
    })
    .filter(Boolean);
}

/**
 * @description The stops and lines, read from the open GTFS and kept in the store.
 * @param {object} options - Options.
 * @param {object} options.store - The store (`data.network`, `save()`).
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} options.now - `() => number` in ms.
 * @param {object} [options.logger] - Logger.
 * @param {string} [options.gtfsUrl] - The GTFS zip URL (tests).
 * @returns {object} `{ load, resolveStop, searchStops, resolveLine, lines, peek }`.
 */
function createNetwork({
  store,
  fetch: fetchFn = globalThis.fetch,
  now,
  logger,
  gtfsUrl = GTFS_URL,
}) {
  let pending = null;

  /**
   * @description Read the stops and lines of the GTFS.
   * @returns {Promise<{ stops: Array, lines: Array }>} The network.
   */
  async function download() {
    let response;
    try {
      response = await fetchFn(gtfsUrl, {
        headers: { accept: 'application/zip', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new NetworkError('unreachable', err.cause?.code ?? err.message);
    }
    if (!response.ok) {
      throw new NetworkError(
        response.status >= 500 ? 'unreachable' : 'invalid',
        `HTTP ${response.status}`,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_ZIP_BYTES) {
      throw new NetworkError('invalid', `GTFS zip of ${bytes.length} bytes`);
    }
    let stops;
    let lines;
    try {
      const entries = zipEntries(bytes);
      stops = parseStops(await readEntry(bytes, entries, 'stops.txt'));
      lines = parseLines(await readEntry(bytes, entries, 'routes.txt'));
    } catch (err) {
      throw new NetworkError('invalid', `GTFS: ${err.message}`);
    }
    if (stops.length === 0) {
      throw new NetworkError('invalid', 'GTFS without stops');
    }
    logger?.info(`${stops.length} stops and ${lines.length} lines read from ${gtfsUrl}`);
    return { stops, lines };
  }

  /**
   * @description The network, read again when older than seven days (or when
   * forced). A failed reading keeps the network already known.
   * @param {boolean} [force] - Read again now.
   * @returns {Promise<{ stops: Array, lines: Array }>} The network.
   */
  async function load(force = false) {
    const kept = store.data.network;
    const known = Array.isArray(kept.stops) && kept.stops.length > 0;
    if (known && !force && now() - (kept.readAt ?? 0) < NETWORK_MAX_AGE_MS) {
      return kept;
    }
    if (!pending) {
      pending = download()
        .then(async (read) => {
          store.data.network = { ...read, readAt: now() };
          await store.save();
          return store.data.network;
        })
        .finally(() => {
          pending = null;
        });
    }
    try {
      return await pending;
    } catch (err) {
      if (known && !force) {
        logger?.warn(`Network not read again (${err.kind ?? 'error'}): ${err.message}`);
        return kept;
      }
      throw err;
    }
  }

  const keptLines = () => (Array.isArray(store.data.network.lines) ? store.data.network.lines : []);

  return {
    load,
    /**
     * @description Resolve a typed stop. A code is accepted even when the
     * list cannot be read.
     * @param {string} typed - Its code or name.
     * @returns {Promise<object|null>} The stop.
     */
    resolveStop: async (typed) => {
      if (isStopCode(typed)) {
        const known = store.data.network.stops ?? [];
        if (known.length === 0) {
          try {
            return findStop((await load()).stops, typed);
          } catch {
            return findStop([], typed);
          }
        }
        return findStop(known, typed);
      }
      return findStop((await load()).stops, typed);
    },
    searchStops: async (query, max) => searchStops((await load()).stops, query, max),
    /**
     * @description Resolve a typed line. Unknown to the GTFS (or the GTFS out
     * of reach): the line as typed, a bus.
     * @param {string} typed - "A", "Tram A", "2".
     * @returns {Promise<object|null>} The line, null when nothing was typed.
     */
    resolveLine: async (typed) => {
      const wanted = typedLine(typed);
      if (!wanted) {
        return null;
      }
      let lines = keptLines();
      if (lines.length === 0) {
        lines = await load()
          .then((network) => network.lines ?? [])
          .catch(() => []);
      }
      return (
        findLine(lines, typed) ?? {
          id: String(typed).trim().toUpperCase(),
          name: String(typed).trim().toUpperCase(),
          mode: MODES.BUS,
          color: '',
          unknown: true,
        }
      );
    },
    /**
     * @description A line by its route id, without reading anything.
     * @param {string} id - "A", "02".
     * @returns {object|null} The line.
     */
    lineById: (id) => keptLines().find((line) => line.id === String(id)) ?? null,
    lines: keptLines,
  };
}

export {
  GTFS_URL,
  NETWORK_MAX_AGE_MS,
  MODES,
  NetworkError,
  fold,
  slug,
  logicalOf,
  isStopCode,
  parseStops,
  parseLines,
  stopOf,
  findStop,
  searchStops,
  typedLine,
  findLine,
  splitLines,
  createNetwork,
};
