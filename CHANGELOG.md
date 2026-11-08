# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- One device per followed stop of the CTS in Strasbourg (three in the form and up to 7 more with the "Add a stop" button, typed by name or by code, filtered by line and direction): the next passage as text, the wait of the next two passages and the number of traffic messages about its lines, in real time, from the official API of the CTS.
- One device per followed line (trams and buses): its traffic state (normal, information, disrupted, heavily disrupted) and its number of traffic messages, from the traffic messages of the CTS (disruptions, planned disruptions, works, information) in French, English or German.
- Scene triggers: departure soon (2 to 20 minutes before), line disrupted, back to normal, and a new traffic message about a followed line, the lines of a followed stop or the whole network (filters by kind and priority; an update fires again when the CTS asks to notify it).
- Scene actions: read the next departures of a stop, and the traffic of a line, each with a ready-made sentence.
- Dashboard widgets: the next passages of one or several stops, like the screens of the stops (any stop can be typed in the widget); the traffic of the followed lines (or of the tram lines) with their messages under way and coming.
- Configuration actions: test the connection, find a stop by name (from the open GTFS of the CTS, without spending a request), add, list and remove stops, and a diagnostic written to the Logs tab (without the token).
- Polite with the API: one request per stop, answers kept as long as their cache-control says, a pause of 5 minutes after a 429, fewer readings at night.
- Cloud transport: the SIRI-lite API of the CTS (personal token, Licence Ouverte 2.0) and the stops and lines of its open GTFS, read weekly and kept in /data.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-cts-strasbourg/releases/tag/v0.1.0
