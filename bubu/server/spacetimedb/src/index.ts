// Bubu server module.
// Holds the agents, the things they need from the owner ("asks"), and the
// Telegram link that lets agents message the owner with answer buttons.
import { schema, table, t, SenderError, type InferSchema, type ReducerCtx } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import { readUpdates, keyboard, looksLikeBotToken } from './telegram';

const POLL_EVERY_MICROS = 2_000_000n;
const TELEGRAM_API = 'https://api.telegram.org';

const owner = table(
  { name: 'owner' },
  {
    id: t.u32().primaryKey(),
    identity: t.identity(),
  }
);

// Private: holds the bot token. Never public.
const telegram = table(
  { name: 'telegram' },
  {
    id: t.u32().primaryKey(),
    apiBase: t.string(),
    botToken: t.string(),
    botUsername: t.string(),
    linkCode: t.string(),
    chatId: t.option(t.string()),
    updateOffset: t.i64(),
  }
);

const agent = table(
  { name: 'agent' },
  {
    id: t.string().primaryKey(),
    name: t.string(),
    job: t.string(),
    character: t.string(),
    notify: t.bool(),
  }
);

const ask = table(
  { name: 'ask' },
  {
    id: t.u64().primaryKey().autoInc(),
    agentId: t.string().index('btree'),
    text: t.string(),
    options: t.array(t.string()),
    answer: t.option(t.string()),
    answeredVia: t.option(t.string()),
    telegramMessageId: t.option(t.i64()),
    createdAt: t.timestamp(),
  }
);

const pollTimer = table(
  { name: 'poll_timer' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
  }
);

const spacetimedb = schema({ owner, telegram, agent, ask, pollTimer });
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

function isOwner(ctx: Ctx): boolean {
  const o = ctx.db.owner.id.find(0);
  return !!o && o.identity.equals(ctx.sender);
}

function requireOwner(ctx: Ctx) {
  if (!isOwner(ctx)) throw new SenderError('only the owner can do this');
}

function newCode(rand: (lo: number, hi: number) => number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[rand(0, chars.length - 1)];
  return s;
}

export const init = spacetimedb.init(ctx => {
  ctx.db.pollTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(POLL_EVERY_MICROS) });
});

// ---------- owner + agents

// The first identity to call this becomes the owner of this Bubu.
export const claimOwner = spacetimedb.reducer(ctx => {
  if (ctx.db.owner.id.find(0)) {
    if (isOwner(ctx)) return;
    throw new SenderError('this Bubu already has an owner');
  }
  ctx.db.owner.insert({ id: 0, identity: ctx.sender });
});

export const upsertAgent = spacetimedb.reducer(
  { id: t.string(), name: t.string(), job: t.string(), character: t.string(), notify: t.bool() },
  (ctx, a) => {
    requireOwner(ctx);
    if (ctx.db.agent.id.find(a.id)) ctx.db.agent.id.update(a);
    else ctx.db.agent.insert(a);
  }
);

// An agent asks the owner something. Telegram delivery happens on the next poll.
export const createAsk = spacetimedb.reducer(
  { agentId: t.string(), text: t.string(), options: t.array(t.string()) },
  (ctx, { agentId, text, options }) => {
    requireOwner(ctx);
    if (!ctx.db.agent.id.find(agentId)) throw new SenderError('unknown agent');
    if (options.length === 0 || options.length > 6) throw new SenderError('give 1 to 6 options');
    ctx.db.ask.insert({
      id: 0n, agentId, text, options,
      answer: undefined, answeredVia: undefined, telegramMessageId: undefined,
      createdAt: ctx.timestamp,
    });
  }
);

// Answer from inside the app.
export const answerAsk = spacetimedb.reducer(
  { askId: t.u64(), answer: t.string() },
  (ctx, { askId, answer }) => {
    requireOwner(ctx);
    const a = ctx.db.ask.id.find(askId);
    if (!a) throw new SenderError('no such ask');
    if (a.answer !== undefined) return;
    ctx.db.ask.id.update({ ...a, answer, answeredVia: 'app' });
  }
);

// ---------- what the owner's app can see

const TelegramStatus = t.object('TelegramStatus', {
  connected: t.bool(),
  botUsername: t.string(),
  linkCode: t.string(),
  linked: t.bool(),
});

export const myTelegram = spacetimedb.view(
  { name: 'my_telegram', public: true },
  t.option(TelegramStatus),
  ctx => {
    const o = ctx.db.owner.id.find(0);
    if (!o || !o.identity.equals(ctx.sender)) return undefined;
    const tg = ctx.db.telegram.id.find(0);
    if (!tg) return { connected: false, botUsername: '', linkCode: '', linked: false };
    return { connected: true, botUsername: tg.botUsername, linkCode: tg.linkCode, linked: tg.chatId !== undefined };
  }
);

export const myAgents = spacetimedb.view(
  { name: 'my_agents', public: true },
  t.array(agent.rowType),
  ctx => {
    const o = ctx.db.owner.id.find(0);
    if (!o || !o.identity.equals(ctx.sender)) return [];
    return [...ctx.db.agent.iter()];
  }
);

export const myAsks = spacetimedb.view(
  { name: 'my_asks', public: true },
  t.array(ask.rowType),
  ctx => {
    const o = ctx.db.owner.id.find(0);
    if (!o || !o.identity.equals(ctx.sender)) return [];
    return [...ctx.db.ask.iter()];
  }
);

// ---------- Telegram

type Http = { http: { fetch: (url: string, init?: any) => { status: number; text: () => string } } };

function tgCall(ctx: Http, base: string, token: string, method: string, body: unknown): any {
  const res = ctx.http.fetch(`${base}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = JSON.parse(res.text()); } catch { json = null; }
  if (res.status !== 200 || !json || json.ok !== true) {
    const why = json && json.description ? json.description : `HTTP ${res.status}`;
    throw new Error(`Telegram ${method} failed: ${why}`);
  }
  return json.result;
}

// Owner pastes the token from @BotFather. We check it with getMe before saving.
// Returns 'ok: <bot username>' or 'error: <why>'.
// apiBase is only for tests; leave it empty to use Telegram.
export const connectTelegram = spacetimedb.procedure(
  { botToken: t.string(), apiBase: t.string() },
  t.string(),
  (ctx, { botToken, apiBase }) => {
    const owned = ctx.withTx(tx => {
      const o = tx.db.owner.id.find(0);
      return !!o && o.identity.equals(ctx.sender);
    });
    if (!owned) return 'error: only the owner can do this';
    const base = apiBase || TELEGRAM_API;
    const token = botToken.trim();
    if (!looksLikeBotToken(token)) return 'error: that does not look like a bot token';
    let me: any;
    try { me = tgCall(ctx, base, token, 'getMe', {}); }
    catch (e) { return `error: ${String(e instanceof Error ? e.message : e)}`; }
    const username: string = me.username || '';
    return ctx.withTx(tx => {
      const code = newCode((lo, hi) => tx.random.integerInRange(lo, hi));
      const row = { id: 0, apiBase: base, botToken: token, botUsername: username, linkCode: code, chatId: undefined, updateOffset: 0n };
      if (tx.db.telegram.id.find(0)) tx.db.telegram.id.update(row);
      else tx.db.telegram.insert(row);
      return `ok: ${username}`;
    });
  }
);

export const disconnectTelegram = spacetimedb.reducer(ctx => {
  requireOwner(ctx);
  ctx.db.telegram.id.delete(0);
  for (const a of [...ctx.db.ask.iter()]) {
    if (a.telegramMessageId !== undefined) ctx.db.ask.id.update({ ...a, telegramMessageId: undefined });
  }
});

// Runs every 2 seconds: reads new Telegram updates (link + button taps),
// then sends any asks that have not gone out yet.
export const pollTelegram = spacetimedb.procedure(
  { onSchedule: pollTimer },
  { timer: pollTimer.rowType },
  t.unit(),
  (ctx, _args) => {
    const tg = ctx.withTx(tx => tx.db.telegram.id.find(0));
    if (!tg) return {};
    const base = tg.apiBase, token = tg.botToken;

    let updates: any[] = [];
    try {
      updates = tgCall(ctx, base, token, 'getUpdates', {
        offset: Number(tg.updateOffset), timeout: 0, allowed_updates: ['message', 'callback_query'],
      });
    } catch (e) {
      console.error(String(e));
      return {};
    }

    const r = readUpdates(updates, tg.linkCode, tg.chatId, tg.updateOffset);
    const chatId = r.chatId, offset = r.offset, taps = r.taps, greet = r.greet;
    for (const id of r.ignoredCallbacks) {
      try { tgCall(ctx, base, token, 'answerCallbackQuery', { callback_query_id: id }); } catch (e) { console.error(String(e)); }
    }

    // Save the link, the offset and the answers.
    const confirmations = ctx.withTx(tx => {
      const cur = tx.db.telegram.id.find(0);
      if (!cur) return [];
      tx.db.telegram.id.update({ ...cur, chatId, updateOffset: offset });
      const out: { callbackId: string; chat: string; messageId: number; text: string }[] = [];
      for (const a of taps) {
        const row = tx.db.ask.id.find(a.askId);
        if (!row) continue;
        const label = row.options[a.idx];
        if (label === undefined) continue;
        const final = row.answer ?? label;
        if (row.answer === undefined) tx.db.ask.id.update({ ...row, answer: label, answeredVia: 'telegram' });
        const ag = tx.db.agent.id.find(row.agentId);
        out.push({ callbackId: a.callbackId, chat: a.chat, messageId: a.messageId,
          text: `${ag ? ag.name : 'Agent'}: ${row.text}\n\n✓ ${final}` });
      }
      return out;
    });

    for (const c of greet) {
      try { tgCall(ctx, base, token, 'sendMessage', { chat_id: c, text: 'Connected to Bubu. Your agents will message you here when they need you.' }); }
      catch (e) { console.error(String(e)); }
    }
    for (const c of confirmations) {
      try {
        tgCall(ctx, base, token, 'answerCallbackQuery', { callback_query_id: c.callbackId, text: 'Got it' });
        tgCall(ctx, base, token, 'editMessageText', { chat_id: c.chat, message_id: c.messageId, text: c.text });
      } catch (e) { console.error(String(e)); }
    }

    // Send asks that have not been delivered yet.
    if (chatId === undefined) return {};
    const pending = ctx.withTx(tx => [...tx.db.ask.iter()]
      .filter(a => a.answer === undefined && a.telegramMessageId === undefined)
      .map(a => {
        const ag = tx.db.agent.id.find(a.agentId);
        return { id: a.id, text: a.text, options: a.options, name: ag ? ag.name : 'Agent', notify: ag ? ag.notify : false };
      })
      .filter(a => a.notify));
    for (const p of pending.slice(0, 10)) {
      let sent: any;
      try {
        sent = tgCall(ctx, base, token, 'sendMessage', {
          chat_id: chatId, text: `${p.name}: ${p.text}`, reply_markup: keyboard(p.id, p.options),
        });
      } catch (e) { console.error(String(e)); continue; }
      ctx.withTx(tx => {
        const row = tx.db.ask.id.find(p.id);
        if (row) tx.db.ask.id.update({ ...row, telegramMessageId: BigInt(sent.message_id) });
      });
    }
    return {};
  }
);
