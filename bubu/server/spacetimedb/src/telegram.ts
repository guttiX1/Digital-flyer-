// Pure Telegram helpers (no database, no network) so they can be unit tested.

export type Tap = { askId: bigint; idx: number; callbackId: string; chat: string; messageId: number };

export type UpdateResult = {
  chatId: string | undefined;
  offset: bigint;
  taps: Tap[];
  greet: string[];
  ignoredCallbacks: string[];
};

// Reads a batch from getUpdates.
// - "/start <linkCode>" links the chat (only if no chat is linked yet).
// - Button taps count only from the linked chat; others are acknowledged and ignored.
export function readUpdates(updates: any[], linkCode: string, chatId: string | undefined, offset: bigint): UpdateResult {
  const taps: Tap[] = [];
  const greet: string[] = [];
  const ignoredCallbacks: string[] = [];
  for (const u of updates) {
    if (typeof u?.update_id !== 'number') continue;
    const next = BigInt(u.update_id) + 1n;
    if (next > offset) offset = next;
    if (u.message && typeof u.message.text === 'string') {
      const parts = u.message.text.trim().split(/\s+/);
      if (parts[0] === '/start' && linkCode !== '' && parts[1] === linkCode && chatId === undefined) {
        chatId = String(u.message.chat.id);
        greet.push(chatId);
      }
    } else if (u.callback_query) {
      const cq = u.callback_query;
      const from = cq.message ? String(cq.message.chat.id) : '';
      const m = /^a:(\d+):(\d+)$/.exec(cq.data || '');
      if (m && chatId !== undefined && from === chatId) {
        taps.push({ askId: BigInt(m[1]), idx: Number(m[2]), callbackId: String(cq.id), chat: from, messageId: cq.message.message_id });
      } else {
        ignoredCallbacks.push(String(cq.id));
      }
    }
  }
  return { chatId, offset, taps, greet, ignoredCallbacks };
}

// Inline buttons, two per row. callback_data stays well under Telegram's 64 byte limit.
export function keyboard(askId: bigint, options: string[]) {
  const buttons = options.map((label, i) => ({ text: label, callback_data: `a:${askId}:${i}` }));
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}

export function looksLikeBotToken(token: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token);
}
