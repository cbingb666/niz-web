import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Profile, unhex, isRecord } from '../src/protocol.ts';
import { supportedModels } from '../src/devices/index.ts';

const path = process.argv[2];
if (!path) throw new Error('Usage: npm run replay -- /path/to/local/read-capture.json');
// Input stays outside the Site checkout. Never copy private captures into dist.
const data: unknown = JSON.parse(await readFile(path, 'utf8'));
assert(isRecord(data) && ['atom66-read-capture', 'niz-read-capture'].includes(String(data.format)) && Array.isArray(data.reports));
const modelId = data.format === 'atom66-read-capture' ? 'atom66' : data.model;
assert(data.model === undefined || data.model === modelId);
const model = supportedModels.find((model) => model.id === modelId);
assert(model, 'Unsupported capture model');
assert(typeof data.version === 'string' && isRecord(data.identity));
const reports = data.reports.map(unhex);
const profile = Profile.fromReports(reports, model);
profile.version = data.version;
profile.identity = data.identity;
const raw = profile.reports;
assert.deepEqual(raw, reports);
assert.deepEqual(Profile.fromJSON(JSON.stringify(profile.toJSON())).reports, raw);
const copy = profile.clone();
copy.setDefinition(0, { type: 0, keys: [43] });
assert.deepEqual(copy.records.slice(model.editableRecords), profile.records.slice(model.editableRecords));
process.stdout.write(
  `Replay passed: ${profile.groupCount} groups, ${profile.records.length} records, ${raw.length} packets; raw-byte round trip and extension preservation verified.\n`,
);
