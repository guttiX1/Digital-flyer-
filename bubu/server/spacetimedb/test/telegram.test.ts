import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readUpdates, keyboard, looksLikeBotToken } from '../src/telegram.ts';

const msg = (id: number, chat: number, text: string) => ({ update_id: id, message: { chat: { id: chat }, text } });
const tap = (id: number, chat: number, data: string) => ({ update_id: id, callback_query: { id: `cb${id}`, data, message: { message_id: 77, chat: { id: chat } } } });

test('links the chat with the right /start code', () => {
  const r = readUpdates([msg(5, 42, '/start ABCD2345')], 'ABCD2345', undefined, 0n);
  assert.equal(r.chatId, '42'); assert.deepEqual(r.greet, ['42']); assert.equal(r.offset, 6n);
});
test('ignores a wrong code and does not relink an already linked chat', () => {
  assert.equal(readUpdates([msg(1, 42, '/start WRONG')], 'ABCD2345', undefined, 0n).chatId, undefined);
  const r = readUpdates([msg(2, 99, '/start ABCD2345')], 'ABCD2345', '42', 0n);
  assert.equal(r.chatId, '42'); assert.deepEqual(r.greet, []);
});
test('empty link code never links', () => {
  assert.equal(readUpdates([msg(1, 42, '/start')], '', undefined, 0n).chatId, undefined);
});
test('counts taps only from the linked chat', () => {
  const r = readUpdates([tap(10, 42, 'a:7:1'), tap(11, 99, 'a:7:0'), tap(12, 42, 'junk')], 'X', '42', 0n);
  assert.equal(r.taps.length, 1);
  assert.equal(r.taps[0].askId, 7n); assert.equal(r.taps[0].idx, 1);
  assert.deepEqual(r.ignoredCallbacks, ['cb11', 'cb12']);
  assert.equal(r.offset, 13n);
});
test('offset never goes backwards and skips malformed updates', () => {
  const r = readUpdates([{ nope: 1 }, msg(3, 1, 'hi')], 'X', '42', 50n);
  assert.equal(r.offset, 50n);
});
test('keyboard puts two buttons per row with short callback data', () => {
  const k = keyboard(12345678901234n, ['A', 'B', 'C']);
  assert.equal(k.inline_keyboard.length, 2);
  assert.equal(k.inline_keyboard[0][1].callback_data, 'a:12345678901234:1');
  for (const row of k.inline_keyboard) for (const b of row) assert.ok(Buffer.byteLength(b.callback_data) <= 64);
});
test('bot token shape', () => {
  assert.ok(looksLikeBotToken('123456789:AAFakeTokenForLocalTesting_xyz'));
  assert.ok(!looksLikeBotToken('nope'));
});
