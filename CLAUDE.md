# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the CTS (Compagnie des
Transports Strasbourgeois), the trams and buses of Strasbourg: a Node.js
service (Node 22+, ESM, no build step) that runs in its own sandboxed Docker
container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the official real-time API of the CTS
(`https://api.cts-strasbourg.eu/v1`, SIRI-lite 2.0, OpenAPI description at
`/v1/swagger.json`, Licence Ouverte 2.0) with the personal token of the user
(Basic auth, the token as username): `stop-monitoring` for each followed stop
— three in the form, up to 7 more added with the "Add a stop" button — and
`general-message` (the traffic messages of the network) every 5 minutes. The
names and codes of the stops and lines come from the open GTFS of the CTS
(`https://opendata.cts-strasbourg.eu/google_transit.zip`, only stops.txt and
routes.txt, read weekly, kept in /data).
Transport: cloud only.
Dataset: https://transport.data.gouv.fr/datasets/donnees-theoriques-gtfs-et-temps-reel-siri-lite-du-reseau-cts
The token is given by the open data portal of the CTS (access asked by e-mail
to open-data@cts-strasbourg.fr).

**Never tested with a real token** (none was at hand when it was written):
the fields read are those of the OpenAPI description. The answers of the
fixtures are built, not recorded: replace them with real answers as soon as a
user sends some (`Diagnostic` button).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timers
src/cts-api.js          HTTP client of the API: token, cache-control, errors (401, 429…), redaction
src/network.js          the stops and lines of the open GTFS, typed names -> codes and route ids
src/zip.js              a zip archive and its CSV, without dependency
src/departures.js       stop-monitoring -> passages (line, mode, destination via, real time or timetable)
src/traffic.js          general-message -> messages (channel, priority, lines, texts FR/EN/DE), state of a line
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           the stop and line devices and their states
src/widgets.js          departures and traffic dashboard widgets
src/store.js            /data/cts-strasbourg.json: network, `seen`
src/time.js             Paris wall-clock times, times of day (TZ)
src/config.js           configuration (token, three stops + `added_stops`, lines, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          stops.txt and routes.txt reduced from the real GTFS (Licence Ouverte 2.0)
test/helpers/           the fake CTS: a zip writer, answers built from the OpenAPI description
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`stop:<codes>_<line slug>_<direction slug>`, e.g.
  `stop:275_a_illkirch`: the logical code(s) of the stop or one StopCode
  ("275b"), never its name; the line is the typed one without "tram", "bus",
  "ligne"…; `line:<route id>`, e.g. `line:a`, `line:02`), feature `category` /
  `type` / `unit` / `min` / `max` / `step`, the keys of `config_schema`,
  `actions`, the widgets and their settings, scene triggers (fields, options,
  variables) and scene actions (fields, outputs), and the internal config keys
  `added_stops` (`[{ stop, line, direction }]`, the stop stored as its code
  when it has one) and `last_language`. `test/structure.test.js` compares
  them to `test/fixtures/discovery.baseline.json`: never update the baseline
  to make a test pass without a documented migration.
- **Category / type pairs.** The next passage and the line status are `text` /
  `text`, the waits `duration` / `integer` in minutes (0-180), the counts of
  messages `counter-sensor` / `integer` (0-20). Without a passage the waits are
  not published (a 0 would announce a tram now); before the traffic is read,
  the count of a stop is not published.
- **The token.** `token` is a `secret`: never log it (nor its base64 form),
  never put it in an error message or the diagnostic (`redact()` in
  cts-api.js; a test checks every log line). A refused token (401) is not
  asked again until the configuration is saved.
- **Politeness.** The CTS asks not to make excessive requests: every answer
  is kept while its cache-control says so (cts-api.js), a 429 pauses every
  request for 5 minutes. `should_poll` stays false: the integration reads on
  its own timer — one stop-monitoring per followed stop every interval (30 s
  to 5 min, 1 min by default; 10 min while no stop announces anything in the
  next 45 minutes), general-message every 5 minutes. A widget or a scene
  action reuses a reading of less than a minute.
- **Stops.** A stop is a name (every logical code of that name: "Vendenheim
  Artisans" is 31 and 778), a logical code ("275", every side) or a StopCode
  ("275A", one side, `stop_code` of the GTFS). Searching never spends the
  token. A code typed is accepted even when the GTFS cannot be read.
- **Times.** The API writes ISO 8601 times with their offset; without one, a
  Paris wall-clock time (`wallToInstant()`). Never `Date.parse()` them.
- **Real time.** `Extension.IsRealTime` tells a live estimate from the
  timetable: say it ("(timetable)", a star in the widget). The API gives no
  delay and no cancelled trip: never invent one.
- **Traffic.** The state of a line is its heaviest message under way: a
  disruption is `disrupted` (`major` when urgent or extreme), a planned
  disruption `disrupted`, works by their words, information `info`. A message
  of the whole network (`ImpactedGroupOfLinesRef` "CTS" or no line) counts
  for every line. Show the `period` text of the CTS rather than the dates
  when it gives one.
- **Events once.** `seen` (in /data) remembers the reminders fired per stop,
  the state and the messages (with their version) of each followed line and
  stop. The first reading is a baseline: nothing fires. An update fires again
  only when `SendUpdatedNotificationsToCustomers` is true. A message of a
  followed line fires on the line, not again on a stop. A scene action or a
  widget never fires an event.
- **Data licence.** Licence Ouverte 2.0: keep "CTS" and the time of the
  reading visible in the widgets, and the credit in the README, the docs and
  NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Names of stops and destinations
  stay as the CTS writes them; the traffic messages come in French, English
  or German (French for Spanish).
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. `gladys_version` is `>=5.3.0` (widgets, scene triggers, catalog
  `keywords` and `countries`). Transport: `["cloud"]`. No permission.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake CTS of
  `test/helpers/fixtures.js`).
