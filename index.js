// -----------------------------------------------------------------------------
// Entry point of the CTS Strasbourg external integration.
//
// Brings the trams and buses of Strasbourg into Gladys through the official
// real-time API of the CTS (SIRI-lite, a personal token):
//   - devices: one per followed stop, with the next passages, the waits and
//     the count of traffic messages; one per followed line, with its traffic
//     (src/device.js);
//   - scene triggers: departure soon, line disrupted, back to normal, new
//     traffic message;
//   - scene actions: read the next passages of a stop, the traffic of a line;
//   - dashboard widgets: departures, traffic.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the CTS Strasbourg integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
