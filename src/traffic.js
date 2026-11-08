// -----------------------------------------------------------------------------
// The traffic of the lines, read every 5 minutes from general-message (SIRI
// GM of the CTS):
//   - `InfoMessage[]`, each with `ItemIdentifier` (the situation, the same
//     across its updates), `InfoMessageIdentifier` (this version),
//     `InfoChannelRef` (Disruption, PlannedDisruption, Works, Information) and
//     `Content`:
//       `ImpactStartDateTime` / `ImpactEndDateTime` (null when unknown);
//       `ImpactedLineRef[]` the route ids, or `ImpactedGroupOfLinesRef` "CTS"
//         for the whole network;
//       `Priority` Normal, Urgent, Extrem;
//       `SendUpdatedNotificationsToCustomers` whether an update deserves a
//         new notification;
//       `Message[]` the texts by zone (`MessageZoneRef`: title, details,
//         period — the period to show instead of the dates), each in FR, EN
//         and DE (`MessageText[]`: `{ Value, Lang }`).
//   - weight of a message: a disruption is `disrupted` (`major` when urgent or
//     extreme), a planned disruption `disrupted`, works by their words
//     ("interrompu" -> major, "dévié", "non desservi" -> disrupted, else info),
//     an information `info`.
// States of a line, from the mildest: `unknown` (nothing read yet), `normal`,
// `info` (a message under way, normal service), `disrupted`, `major`: the
// heaviest message under way. A message of the whole network counts for every
// line.
// -----------------------------------------------------------------------------

import { MINUTE_MS } from './time.js';
import { asList, parseInstant } from './departures.js';
import { fold } from './network.js';

const STATES = ['unknown', 'normal', 'info', 'disrupted', 'major'];
const SERIOUS = ['disrupted', 'major'];
const CHANNELS = {
  Disruption: 'disruption',
  PlannedDisruption: 'planned_disruption',
  Works: 'works',
  Information: 'information',
};
const PRIORITIES = { Normal: 'normal', Urgent: 'urgent', Extrem: 'extreme' };
// The languages of the texts, in the order they are looked for.
const TEXT_LANGUAGES = ['fr', 'en', 'de'];
// A message starting this soon is shown as coming.
const UPCOMING_MS = 3 * 24 * 60 * MINUTE_MS;
const TEXT_MAX = 2000;
const TITLE_MAX = 140;
const MAJOR_WORDS =
  /(^|[^\p{L}])(interrompue?s?|interruption|suspendue?s?|hors service|ne circule(nt)? (pas|plus)|aucun(e)? (tram|bus|circulation|desserte)|pas de (circulation|tram|bus)|unterbrochen|interrupted|no service)(?=$|[^\p{L}])/iu;
const DISRUPTED_WORDS =
  /(^|[^\p{L}])(d[ée]vi[ée]e?s?|d[ée]viation|perturb[ée]e?s?|perturbation|retards?|non desservie?s?|pas desservie?s?|ralentie?s?|report[ée]e?s?|limit[ée]e?s?|accident|incident|manifestation|terminus provisoire|navette|substitution)(?=$|[^\p{L}])/iu;

/**
 * @description A plain text: no tags, blank lines dropped.
 * @param {unknown} value - The text.
 * @param {number} [max] - Its longest length.
 * @returns {string} The text.
 */
function plainText(value, max = TEXT_MAX) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

/**
 * @description A short title.
 * @param {string} title - The title of the message.
 * @param {string} text - Its text.
 * @returns {string} The title, or the first sentence of the text, at most TITLE_MAX characters.
 */
function titleOf(title, text) {
  const [firstLine = ''] = text.split('\n');
  const sentence = title || (/^(.+?[.!?])(\s|$)/.exec(firstLine)?.[1] ?? firstLine);
  return sentence.length > TITLE_MAX ? `${sentence.slice(0, TITLE_MAX - 1)}…` : sentence;
}

/**
 * @description The text of a zone in a language: the one asked, else French,
 * English, German.
 * @param {object[]} zones - `Content.Message[]`.
 * @param {string} zone - "title", "details", "period".
 * @param {string} language - The language wanted.
 * @returns {string} The text, '' when none.
 */
function zoneText(zones, zone, language) {
  const texts = zones
    .filter((entry) => fold(entry?.MessageZoneRef) === zone)
    .flatMap((entry) => asList(entry?.MessageText))
    .filter((text) => typeof text?.Value === 'string' && text.Value.trim());
  const order = [language, ...TEXT_LANGUAGES];
  for (const wanted of order) {
    const found = texts.find((text) => String(text.Lang ?? '').toLowerCase() === wanted);
    if (found) {
      return found.Value;
    }
  }
  return texts[0]?.Value ?? '';
}

/**
 * @description The weight of a message.
 * @param {string} channel - CHANNELS value.
 * @param {string} priority - PRIORITIES value.
 * @param {string} text - Its title and text.
 * @returns {string} `info`, `disrupted` or `major`.
 */
function messageState(channel, priority, text) {
  if (channel === 'disruption') {
    return priority === 'normal' ? 'disrupted' : 'major';
  }
  if (channel === 'planned_disruption') {
    return MAJOR_WORDS.test(text) ? 'major' : 'disrupted';
  }
  if (channel === 'works') {
    if (MAJOR_WORDS.test(text)) {
      return 'major';
    }
    return DISRUPTED_WORDS.test(text) ? 'disrupted' : 'info';
  }
  return 'info';
}

/**
 * @description What is kept of an InfoMessage.
 * @param {object} raw - The InfoMessage.
 * @param {string} [language] - The language of the texts.
 * @returns {object|null} `{ id, version, channel, priority, state, lineIds,
 * network, title, text, period, start, end, notifyUpdates }`, null when empty.
 */
function messageOf(raw, language = 'fr') {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const content = raw.Content && typeof raw.Content === 'object' ? raw.Content : {};
  const zones = asList(content.Message);
  const details = plainText(zoneText(zones, 'details', language));
  const heading = plainText(zoneText(zones, 'title', language), TITLE_MAX * 2).replace(/\n/g, ' ');
  const title = titleOf(heading, details);
  if (!title && !details) {
    return null;
  }
  const frenchText = ['title', 'details']
    .map((zone) => plainText(zoneText(zones, zone, 'fr')))
    .join(' ');
  const channel = CHANNELS[raw.InfoChannelRef] ?? 'information';
  const priority = PRIORITIES[content.Priority] ?? 'normal';
  const lineIds = asList(content.ImpactedLineRef)
    .map((id) => String(id ?? '').trim())
    .filter(Boolean);
  const id = String(raw.ItemIdentifier || raw.InfoMessageIdentifier || title).slice(0, 120);
  return {
    id,
    version: String(raw.InfoMessageIdentifier ?? id),
    channel,
    priority,
    // Weighed on the French texts whatever the language shown: a state (and
    // the events it fires) never depends on the language of the user.
    state: messageState(channel, priority, frenchText),
    lineIds: [...new Set(lineIds)],
    network: lineIds.length === 0 || Boolean(content.ImpactedGroupOfLinesRef),
    title,
    text: details,
    period: plainText(zoneText(zones, 'period', language), 200).replace(/\n/g, ' '),
    start: parseInstant(content.ImpactStartDateTime),
    end: parseInstant(content.ImpactEndDateTime),
    notifyUpdates: content.SendUpdatedNotificationsToCustomers === true,
  };
}

/**
 * @description Read the traffic.
 * @param {object} answer - The answer of general-message.
 * @param {string} [language] - The language of the texts.
 * @returns {{ messages: object[] }} The messages, one per situation.
 */
function parseTraffic(answer, language = 'fr') {
  const byId = new Map();
  const raws = asList(answer?.ServiceDelivery?.GeneralMessageDelivery).flatMap((delivery) =>
    asList(delivery?.InfoMessage),
  );
  for (const raw of raws) {
    const message = messageOf(raw, language);
    if (message && !byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return { messages: [...byId.values()] };
}

/**
 * @description The rank of a state, for comparisons.
 * @param {string} state - A state.
 * @returns {number} Its position in STATES.
 */
const rank = (state) => STATES.indexOf(state);

/**
 * @description A message as it stands at an instant: under way, coming or over.
 * @param {object} message - The message.
 * @param {number} now - Now (ms).
 * @returns {object|null} The message with `coming`, null when over.
 */
function messageAt(message, now) {
  if (Number.isFinite(message.end) && message.end <= now) {
    return null;
  }
  if (Number.isFinite(message.start) && message.start > now) {
    return { ...message, coming: true };
  }
  return { ...message, coming: false };
}

/**
 * @description Whether a message concerns a line.
 * @param {object} message - The message.
 * @param {{ id: string, name: string }} line - The line.
 * @returns {boolean} True when it does.
 */
function concerns(message, line) {
  if (message.network) {
    return true;
  }
  return message.lineIds.some((id) => id === line.id || fold(id) === fold(line.name));
}

/**
 * @description The traffic of one line.
 * @param {object|null} traffic - parseTraffic().
 * @param {{ id: string, name: string }} line - The line.
 * @param {number} now - Now (ms).
 * @returns {{ state: string, since: number|null, messages: object[], upcoming: object[] }}
 * Its state, the messages under way (heaviest, then latest start first) and
 * the ones coming in the next three days (soonest first).
 */
function lineTraffic(traffic, line, now) {
  if (!traffic) {
    return { state: 'unknown', since: null, messages: [], upcoming: [] };
  }
  const own = traffic.messages
    .filter((message) => concerns(message, line))
    .map((message) => messageAt(message, now))
    .filter(Boolean);
  const messages = own
    .filter((message) => !message.coming)
    .sort((a, b) => rank(b.state) - rank(a.state) || (b.start ?? 0) - (a.start ?? 0));
  const upcoming = own
    .filter((message) => message.coming && message.start - now <= UPCOMING_MS)
    .sort((a, b) => a.start - b.start);
  const state = messages[0]?.state ?? 'normal';
  return {
    state,
    since: SERIOUS.includes(state) ? (messages[0].start ?? null) : null,
    messages,
    upcoming,
  };
}

/**
 * @description The messages under way about some lines (a stop: the lines
 * calling there), heaviest first. A message of the whole network counts.
 * @param {object|null} traffic - parseTraffic().
 * @param {Array<{ id: string, name: string }>} lines - The lines.
 * @param {number} now - Now (ms).
 * @returns {object[]} The messages, with `lines`: the names of those concerned.
 */
function messagesFor(traffic, lines, now) {
  if (!traffic) {
    return [];
  }
  return traffic.messages
    .map((message) => messageAt(message, now))
    .filter((message) => message && !message.coming)
    .map((message) => ({
      ...message,
      lines: message.network
        ? []
        : lines.filter((line) => concerns(message, line)).map((line) => line.name),
    }))
    .filter((message) => message.network || message.lines.length > 0)
    .sort((a, b) => rank(b.state) - rank(a.state) || (b.start ?? 0) - (a.start ?? 0));
}

/**
 * @description The messages of a line about a disruption under way.
 * @param {{ messages: object[] }} line - lineTraffic().
 * @returns {object[]} The messages.
 */
const seriousMessages = (line) => line.messages.filter((m) => SERIOUS.includes(m.state));

export {
  STATES,
  SERIOUS,
  CHANNELS,
  PRIORITIES,
  UPCOMING_MS,
  plainText,
  titleOf,
  zoneText,
  messageState,
  messageOf,
  parseTraffic,
  rank,
  messageAt,
  concerns,
  lineTraffic,
  messagesFor,
  seriousMessages,
};
