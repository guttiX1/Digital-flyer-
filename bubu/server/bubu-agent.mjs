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
import { fromEnv, makeClient } from './plug-client.mjs';

const [cmd, ...args] = process.argv.slice(2);
const die = msg => { console.error(msg); process.exit(1); };

if (cmd === 'new-key') {
  const key = 'bubu_' + randomBytes(32).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  const hash = createHash('sha256').update(key, 'utf8').digest('hex');
  console.log(`Key (secret, give it only to the agent):\n${key}\n\nHash (send this to Bubu):\n${hash}`);
  process.exit(0);
}

const bubu = makeClient(fromEnv());
const push = report => bubu.push(report);

let out;
try {
  if (cmd === 'doing' && args[0]) out = await push({ doing: args[0] });
  else if (cmd === 'done' && args[0]) out = await push({ done: [args[0]] });
  else if (cmd === 'say' && args[0]) out = await push({ say: args[0] });
  else if (cmd === 'ask' && args.length >= 2) out = await push({ asks: [{ text: args[0], options: args.slice(1) }] });
  else if (cmd === 'report' && args[0]) out = await push(JSON.parse(args[0]));
  else if (cmd === 'pull') out = await bubu.pull();
  else die('Use: new-key | doing <text> | done <text> | say <text> | ask <question> <option>... | report <json> | pull');
} catch (e) { die(e.message); }
console.log(JSON.stringify(out, null, 1));
