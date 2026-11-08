// -----------------------------------------------------------------------------
// The answer of stop-monitoring -> the passages of a stop.
//
// `ServiceDelivery.StopMonitoringDelivery[].MonitoredStopVisit[]`, each with:
//   - `MonitoringRef` / `StopCode`          the code asked / the side served;
//   - `MonitoredVehicleJourney`:
//       `LineRef`                           the route id of the GTFS ("A", "02");
//       `PublishedLineName`                 the name read on the vehicle ("A", "2");
//       `DirectionRef`                      0 or 1 (direction_id of the GTFS);
//       `VehicleMode`                       bus, tram, coach;
//       `DestinationName`, `Via`            "Neuhof Stéphanie" via "Stade Walter";
//       `FramedVehicleJourneyRef.DatedVehicleJourneySAERef`  the trip;
//       `MonitoredCall.ExpectedDepartureTime` (or ExpectedArrivalTime at a
//         terminus) the time to show, real time or timetable;
//       `MonitoredCall.Extension.IsRealTime` whether it is followed live.
// The API gives no timetable next to the estimate: no delay, no cancelled
// trip. Its times are ISO 8601 with their offset; without one, Paris time.
// -----------------------------------------------------------------------------

import { fold, typedLine } from './network.js';
import { wallToInstant } from './time.js';

const MODES = { BUS: 'bus', TRAM: 'tram', COACH: 'coach' };

/**
 * @description A value that may be a list or one element.
 * @param {unknown} value - The value.
 * @returns {Array} The list ([] when absent).
 */
function asList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value && typeof value === 'object' ? [value] : [];
}

/**
 * @description The instant of an ISO date and time of the API.
 * @param {unknown} value - "2026-11-08T21:15:00+01:00" (Paris time without offset).
 * @returns {number|null} The instant (ms).
 * @example
 * parseInstant('2026-11-08T21:15:00+01:00'); // -> 2026-11-08T20:15:00Z
 */
function parseInstant(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(
      String(value ?? '').trim(),
    );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second = '0', zone] = match;
  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (!zone) {
    return wallToInstant(wall);
  }
  if (zone === 'Z') {
    return wall;
  }
  const sign = zone.startsWith('-') ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  return wall - sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60000;
}

/**
 * @description The mode of a journey.
 * @param {object} journey - The MonitoredVehicleJourney.
 * @param {Function} [lineById] - `(route id) => line` of the GTFS.
 * @returns {string} MODES.
 */
function modeOf(journey, lineById = () => null) {
  const mode = String(journey?.VehicleMode ?? '').toLowerCase();
  if (mode === MODES.TRAM || mode === MODES.BUS || mode === MODES.COACH) {
    return mode;
  }
  return lineById(String(journey?.LineRef ?? ''))?.mode ?? MODES.BUS;
}

/**
 * @description The destination shown: "Neuhof Stéphanie via Stade Walter".
 * @param {object} journey - The MonitoredVehicleJourney.
 * @returns {string} The destination.
 */
function destinationOf(journey) {
  const name = String(journey?.DestinationName ?? '').trim();
  const via = String(journey?.Via ?? '').trim();
  return via && name ? `${name} via ${via}` : name;
}

/**
 * @description Split a typed direction into the words to look for.
 * @param {string} direction - "Illkirch | Neuhof".
 * @returns {string[]} The folded alternatives.
 */
function directionTerms(direction) {
  return String(direction ?? '')
    .split('|')
    .map(fold)
    .filter(Boolean);
}

/**
 * @description Whether a passage is of a line.
 * @param {object} passage - The passage (`lineId`, `line`, `mode`).
 * @param {object|null} line - The resolved line, null for every line; a mode
 * alone ("tram", "bus") as `{ modeOnly }`.
 * @returns {boolean} True when it is.
 */
function matchesLine(passage, line) {
  if (!line) {
    return true;
  }
  if (line.modeOnly) {
    return passage.mode === line.modeOnly;
  }
  return (
    passage.lineId === line.id ||
    fold(passage.line) === fold(line.name) ||
    fold(passage.line) === typedLine(line.name)
  );
}

/**
 * @description The passages of an answer of stop-monitoring, soonest first.
 * @param {object} answer - The answer.
 * @param {object} [filter] - `{ codes, line, direction, lineById }`: the codes
 * of the stop (every visit when absent), the resolved line, the typed
 * direction, the lines of the GTFS.
 * @returns {object[]} The passages.
 */
function parsePassages(answer, { codes, line = null, direction = '', lineById } = {}) {
  const terms = directionTerms(direction);
  const wanted = codes ? new Set(codes.map((code) => String(code).toUpperCase())) : null;
  const visits = asList(answer?.ServiceDelivery?.StopMonitoringDelivery).flatMap((delivery) =>
    asList(delivery?.MonitoredStopVisit),
  );
  const passages = [];
  const seen = new Set();
  for (const visit of visits) {
    const journey = visit?.MonitoredVehicleJourney ?? {};
    const call = journey.MonitoredCall ?? {};
    const stopCode = String(call.StopCode ?? visit.StopCode ?? '').toUpperCase();
    const asked = String(visit.MonitoringRef ?? '').toUpperCase();
    // A visit answers a code asked: the side itself, or its whole stop.
    if (
      wanted &&
      !wanted.has(asked) &&
      !wanted.has(stopCode) &&
      !wanted.has(stopCode.replace(/[A-Z]+$/, ''))
    ) {
      continue;
    }
    const at = parseInstant(call.ExpectedDepartureTime) ?? parseInstant(call.ExpectedArrivalTime);
    if (!Number.isFinite(at)) {
      continue;
    }
    const lineId = String(journey.LineRef ?? '').trim();
    const passage = {
      lineId,
      line: String(journey.PublishedLineName ?? '').trim() || lineId,
      mode: modeOf(journey, lineById),
      destination: destinationOf(journey),
      direction: Number.isInteger(journey.DirectionRef) ? journey.DirectionRef : null,
      stopCode,
      at,
      realtime: call.Extension?.IsRealTime === true,
      trip: String(journey.FramedVehicleJourneyRef?.DatedVehicleJourneySAERef ?? ''),
    };
    // A stop asked by two codes (or twice) lists a visit once.
    const id = `${passage.trip || `${passage.lineId}|${passage.destination}`}|${stopCode}|${at}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    passages.push(passage);
  }
  return passages
    .filter((passage) => matchesLine(passage, line))
    .filter((passage) => {
      if (terms.length === 0) {
        return true;
      }
      const target = fold(passage.destination);
      return terms.some((term) => target.includes(term));
    })
    .sort((a, b) => a.at - b.at);
}

/**
 * @description The minutes left before a passage.
 * @param {object} passage - The passage.
 * @param {number} now - Now (ms).
 * @returns {number} Whole minutes (rounded down, like the screens).
 */
function minutesLeft(passage, now) {
  return Math.max(0, Math.floor((passage.at - now) / 60000));
}

/**
 * @description The passages not gone yet.
 * @param {object[]} passages - The passages.
 * @param {number} now - Now (ms).
 * @returns {object[]} The passages to come.
 */
const upcomingPassages = (passages, now) => passages.filter((passage) => passage.at > now - 30000);

/**
 * @description Who a passage is, across readings: line and destination.
 * @param {object} passage - The passage.
 * @returns {string} "a|illkirch graffenstaden".
 */
const routeOf = (passage) => `${fold(passage.line)}|${fold(passage.destination)}`;

export {
  MODES,
  asList,
  parseInstant,
  modeOf,
  destinationOf,
  directionTerms,
  matchesLine,
  parsePassages,
  minutesLeft,
  upcomingPassages,
  routeOf,
};
