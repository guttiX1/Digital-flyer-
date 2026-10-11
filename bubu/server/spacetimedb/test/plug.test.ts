import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex, parseReport, looksLikeAgentKey, looksLikeHash, LIMITS } from '../src/plug.ts';

test('sha256 matches node crypto, including accents and emoji', () => {
  for (const s of ['', 'abc', 'bubu_' + 'x'.repeat(40), 'El Juez · carrera ñ 🐴', 'a'.repeat(1000)]) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s, 'utf8').digest('hex'));
  }
});

test('agent keys and hashes', () => {
  assert.ok(looksLikeAgentKey('bubu_' + 'A1b2'.repeat(10)));
  assert.ok(!looksLikeAgentKey('bubu_short'));
  assert.ok(!looksLikeAgentKey('xx_' + 'a'.repeat(40)));
  assert.ok(looksLikeHash('a'.repeat(64)));
  assert.ok(!looksLikeHash('A'.repeat(64)));
});

test('a full report is read', () => {
  const r = parseReport(JSON.stringify({
    doing: ' Writing the flyer ', done: ['Checked dates'],
    asks: [{ text: 'Is race 3 confirmed?', options: ['Yes', 'Not yet'] }], say: 'Hola',
  }));
  assert.equal(r.doing, 'Writing the flyer');
  assert.deepEqual(r.done, ['Checked dates']);
  assert.deepEqual(r.asks, [{ text: 'Is race 3 confirmed?', options: ['Yes', 'Not yet'] }]);
  assert.equal(r.say, 'Hola');
});

test('bad reports are refused with a reason', () => {
  const bad: [string, RegExp][] = [
    ['not json', /not valid JSON/],
    ['[]', /must be an object/],
    ['{}', /empty/],
    ['{"doing":""}', /empty/],
    ['{"doing":5}', /must be text/],
    ['{"hack":1,"doing":"x"}', /unknown field/],
    ['{"asks":[{"text":"q","options":[]}]}', /1 to 6 options/],
    [JSON.stringify({ asks: [{ text: 'q', options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }] }), /1 to 6 options/],
    [JSON.stringify({ doing: 'x'.repeat(LIMITS.text + 1) }), /longer than/],
    [JSON.stringify({ done: Array(LIMITS.done + 1).fill('d') }), /at most/],
    [JSON.stringify({ asks: [{ text: 'q', options: ['x'.repeat(LIMITS.option + 1)] }] }), /longer than/],
  ];
  for (const [json, why] of bad) assert.throws(() => parseReport(json), why, json);
});
