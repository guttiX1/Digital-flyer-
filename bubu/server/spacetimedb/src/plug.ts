// Pure helpers for the agent plug (no database, no network) so they can be unit tested.
// An agent reports with a secret key. The server keeps only the key's SHA-256 hash.

export const LIMITS = {
  text: 500,       // doing, done, ask question, say
  option: 40,      // one answer button
  options: 6,      // buttons per ask
  done: 10,        // done items per report
  asks: 5,         // asks per report
  openAsks: 20,    // unanswered asks one agent may have at once
  events: 50,      // done items kept per agent
};

export type Report = {
  doing?: string;
  done: string[];
  asks: { text: string; options: string[] }[];
  say?: string;
};

export function looksLikeAgentKey(key: string): boolean {
  return /^bubu_[A-Za-z0-9]{32,64}$/.test(key);
}

export function looksLikeHash(h: string): boolean {
  return /^[0-9a-f]{64}$/.test(h);
}

function str(v: unknown, what: string, max: number): string {
  if (typeof v !== 'string') throw new Error(`${what} must be text`);
  const s = v.trim();
  if (s === '') throw new Error(`${what} is empty`);
  if (s.length > max) throw new Error(`${what} is longer than ${max} characters`);
  return s;
}

// Reads one report from an agent. Throws Error with a plain reason when it is not valid.
// {"doing": "...", "done": ["..."], "asks": [{"text": "...", "options": ["Yes", "No"]}], "say": "..."}
export function parseReport(json: string): Report {
  let v: any;
  try { v = JSON.parse(json); } catch { throw new Error('report is not valid JSON'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('report must be an object');
  const known = new Set(['doing', 'done', 'asks', 'say']);
  for (const k of Object.keys(v)) if (!known.has(k)) throw new Error(`unknown field "${k}"`);
  const r: Report = { done: [], asks: [] };
  if (v.doing !== undefined) r.doing = str(v.doing, 'doing', LIMITS.text);
  if (v.say !== undefined) r.say = str(v.say, 'say', LIMITS.text);
  if (v.done !== undefined) {
    if (!Array.isArray(v.done)) throw new Error('done must be a list');
    if (v.done.length > LIMITS.done) throw new Error(`at most ${LIMITS.done} done items per report`);
    r.done = v.done.map((d: unknown) => str(d, 'done item', LIMITS.text));
  }
  if (v.asks !== undefined) {
    if (!Array.isArray(v.asks)) throw new Error('asks must be a list');
    if (v.asks.length > LIMITS.asks) throw new Error(`at most ${LIMITS.asks} asks per report`);
    r.asks = v.asks.map((a: any) => {
      if (!a || typeof a !== 'object') throw new Error('each ask must be an object');
      const text = str(a.text, 'ask text', LIMITS.text);
      if (!Array.isArray(a.options) || a.options.length < 1 || a.options.length > LIMITS.options)
        throw new Error(`each ask needs 1 to ${LIMITS.options} options`);
      return { text, options: a.options.map((o: unknown) => str(o, 'option', LIMITS.option)) };
    });
  }
  if (r.doing === undefined && r.say === undefined && r.done.length === 0 && r.asks.length === 0)
    throw new Error('report is empty');
  return r;
}

// SHA-256 of a UTF-8 string, as lowercase hex. Small and dependency-free because the
// module runtime has no crypto library.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function sha256Hex(s: string): string {
  const bytes = utf8(s);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < bytes.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = (bytes[i + 4 * j] << 24) | (bytes[i + 4 * j + 1] << 16) | (bytes[i + 4 * j + 2] << 8) | bytes[i + 4 * j + 3];
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
}
