#!/usr/bin/env node
// Bubu agent plug: lets any agent report to your Bubu and read your answers.
// No installs needed (Node 18+). Set these first:
//   BUBU_URL        where your Bubu server runs, e.g. https://maincloud.spacetimedb.com
//   BUBU_DB         your database name, e.g. bubu
//   BUBU_AGENT_KEY  this agent's secret key (from `node bubu-agent.mjs new-key`)
//
//   node bubu-agent.mjs new-key                     make a key; prints the key and its hash
//   node bubu-agent.mjs doing "Writing the flyer"
//   node bubu-agent.mjs done "Checked the dates"
//   node bubu-agent.mjs ask "Is race 3 confirmed?" "Yes" "Not yet"
//   node bubu-agent.mjs say "The flyer is ready"
//   node bubu-agent.mjs report '{"doing":"...","done":["..."],"asks":[{"text":"...","options":["Yes","No"]}]}'
//   node bubu-agent.mjs pull                        your new answers and messages, as JSON
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [cmd, ...args] = process.argv.slice(2);
const die = msg => { console.error(msg); process.exit(1); };

if (cmd === 'new-key') {
  const key = 'bubu_' + randomBytes(32).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  const hash = createHash('sha256').update(key, 'utf8').digest('hex');
  console.log(`Key (secret, give it only to the agent):\n${key}\n\nHash (send this to Bubu):\n${hash}`);
  process.exit(0);
}

const url = (process.env.BUBU_URL || '').replace(/\/+$/, '');
const db = process.env.BUBU_DB || '';
const key = process.env.BUBU_AGENT_KEY || '';
if (!url || !db || !key) die('Set BUBU_URL, BUBU_DB and BUBU_AGENT_KEY first.');

// The server needs a caller identity; this one is anonymous and kept in ~/.bubu so it is reused.
async function token() {
  const dir = join(homedir(), '.bubu'), file = join(dir, 'identity-' + createHash('sha256').update(url).digest('hex').slice(0, 12));
  try { return readFileSync(file, 'utf8').trim(); } catch {}
  const res = await fetch(`${url}/v1/identity`, { method: 'POST' });
  if (!res.ok) die(`Could not reach Bubu at ${url} (HTTP ${res.status}).`);
  const t = (await res.json()).token;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(file, t, { mode: 0o600 });
  return t;
}

async function call(name, params) {
  const res = await fetch(`${url}/v1/database/${encodeURIComponent(db)}/call/${name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  if (!res.ok) die(`Bubu said HTTP ${res.status}: ${text}`);
  const out = JSON.parse(JSON.parse(text));
  if (!out.ok) die(`Bubu refused it: ${out.error}`);
  return out;
}

const push = report => call('agent_push', [key, JSON.stringify(report)]);

let out;
if (cmd === 'doing' && args[0]) out = await push({ doing: args[0] });
else if (cmd === 'done' && args[0]) out = await push({ done: [args[0]] });
else if (cmd === 'say' && args[0]) out = await push({ say: args[0] });
else if (cmd === 'ask' && args.length >= 2) out = await push({ asks: [{ text: args[0], options: args.slice(1) }] });
else if (cmd === 'report' && args[0]) out = await push(JSON.parse(args[0]));
else if (cmd === 'pull') out = await call('agent_pull', [key]);
else die('Use: new-key | doing <text> | done <text> | say <text> | ask <question> <option>... | report <json> | pull');
console.log(JSON.stringify(out, null, 1));
