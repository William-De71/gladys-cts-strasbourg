// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets on a Sunday evening at Homme de Fer: the answers of
// test/helpers/fixtures.js (built from the OpenAPI description of the API,
// the stop and line names of the real GTFS of the CTS) go through the real
// parsers (src/departures.js, src/traffic.js) and the real widget builders
// (src/widgets.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildDeparturesWidget, buildTrafficWidget } = await load('src/widgets.js');
const { parsePassages } = await load('src/departures.js');
const { parseTraffic, lineTraffic } = await load('src/traffic.js');
const { parseLines } = await load('src/network.js');
const { LANGUAGES } = await load('src/i18n.js');
const fixtures = await load('test/helpers/fixtures.js');
const { NOW, TZ, stopMonitoring, generalMessage, infoMessage, visit, HOMME_DE_FER, MESSAGES } =
  fixtures;
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const lines = parseLines(Buffer.from(fixtures.ROUTES_TXT));
const lineById = (id) => lines.find((line) => line.id === id) ?? null;
const passages = parsePassages(
  stopMonitoring([
    ...HOMME_DE_FER,
    visit({ lineRef: 'F', line: 'F', code: '275C', destination: "Place d'Islande", minutes: 8 }),
    visit({ lineRef: 'D', line: 'D', code: '275C', destination: 'Kehl Rathaus', minutes: 16 }),
    visit({ lineRef: 'F', line: 'F', code: '275A', destination: 'Elsau', minutes: 11 }),
  ]),
  { codes: ['275'], lineById },
);
const traffic = (language) =>
  parseTraffic(
    generalMessage([
      ...MESSAGES,
      infoMessage({
        id: 'C-ACC',
        channel: 'Disruption',
        lines: ['C'],
        start: -20,
        end: null,
        title: [
          'Tram C : accident à Esplanade',
          'Tram C: accident at Esplanade',
          'Tram C: Unfall an der Esplanade',
        ],
        details: [
          'Le tram C ne dessert pas Esplanade. Bus relais entre Gallia et Landsberg.',
          'Tram C does not serve Esplanade. Replacement buses between Gallia and Landsberg.',
          'Die Tram C hält nicht an der Esplanade. Ersatzbusse zwischen Gallia und Landsberg.',
        ],
        period: ['Depuis 18h10', 'Since 6:10 pm', 'Seit 18:10 Uhr'],
      }),
    ]),
    ['fr', 'en', 'de'].includes(language) ? language : 'fr',
  );
const followed = ['A', 'C', 'D', 'F'].map(lineById);

const contents = {};
for (const language of LANGUAGES) {
  const read = traffic(language);
  contents[language] = {
    departures: buildDeparturesWidget({
      title: 'Homme de Fer',
      passages,
      readAt: NOW,
      count: 6,
      language,
      now: NOW,
      timeZone: TZ,
    }),
    traffic: buildTrafficWidget({
      lines: followed.map((line) => ({ line, traffic: lineTraffic(read, line, NOW) })),
      readAt: NOW,
      language,
      now: NOW,
      timeZone: TZ,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
