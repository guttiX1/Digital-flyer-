// Shared client for the Bubu agent plug (used by bubu-agent.mjs and bubu-mcp.mjs). Node 18+, no installs.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function fromEnv(env = process.env) {
  return { url: (env.BUBU_URL || '').replace(/\/+$/, ''), db: env.BUBU_DB || '', key: env.BUBU_AGENT_KEY || '' };
}

export function makeClient({ url, db, key }) {
  const missing = !url || !db || !key ? 'Set BUBU_URL, BUBU_DB and BUBU_AGENT_KEY first.' : '';

  // The server needs a caller identity; this one is anonymous and kept in ~/.bubu so it is reused.
  async function token() {
    const dir = join(homedir(), '.bubu');
    const file = join(dir, 'identity-' + createHash('sha256').update(url).digest('hex').slice(0, 12));
    try { return readFileSync(file, 'utf8').trim(); } catch {}
    const res = await fetch(`${url}/v1/identity`, { method: 'POST' });
    if (!res.ok) throw new Error(`Could not reach Bubu at ${url} (HTTP ${res.status}).`);
    const t = (await res.json()).token;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(file, t, { mode: 0o600 });
    return t;
  }

  async function call(name, params) {
    if (missing) throw new Error(missing);
    const res = await fetch(`${url}/v1/database/${encodeURIComponent(db)}/call/${name}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Bubu said HTTP ${res.status}: ${text}`);
    const out = JSON.parse(JSON.parse(text));
    if (!out.ok) throw new Error(`Bubu refused it: ${out.error}`);
    return out;
  }

  return {
    push: report => call('agent_push', [key, JSON.stringify(report)]),
    pull: () => call('agent_pull', [key]),
  };
}
