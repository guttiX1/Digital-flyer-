#!/usr/bin/env node
// Bubu MCP connector: plug any MCP agent (Claude Code, Claude Desktop, Cursor, ...) into your Bubu.
// The agent gets 5 tools to tell you what it is doing, ask you things and read your answers.
// No installs (Node 18+). Runs over stdio. Needs BUBU_URL, BUBU_DB and BUBU_AGENT_KEY.
//
// Claude Code:  claude mcp add bubu -e BUBU_URL=... -e BUBU_DB=bubu -e BUBU_AGENT_KEY=bubu_... -- node /path/to/bubu-mcp.mjs
import { createInterface } from 'node:readline';
import { fromEnv, makeClient } from './plug-client.mjs';

const bubu = makeClient(fromEnv());
const str = d => ({ type: 'string', description: d });

const TOOLS = [
  {
    name: 'bubu_doing',
    description: 'Tell your owner what you are working on right now. Shows on your character in the Bubu app. Call it when you start a task or switch tasks.',
    inputSchema: { type: 'object', properties: { text: str('What you are doing, in one short plain sentence.') }, required: ['text'] },
    run: a => bubu.push({ doing: a.text }),
  },
  {
    name: 'bubu_done',
    description: 'Report things you finished. They show in your Done list in the Bubu app.',
    inputSchema: { type: 'object', properties: { items: { type: 'array', items: { type: 'string' }, description: 'One short line per finished thing (max 10).' } }, required: ['items'] },
    run: a => bubu.push({ done: a.items }),
  },
  {
    name: 'bubu_ask',
    description: 'Ask your owner a question that only they can decide, with answer buttons. It shows as "needs you" in the Bubu app (and Telegram if linked). The answer is not instant: check later with bubu_check.',
    inputSchema: {
      type: 'object',
      properties: { question: str('The question, short and clear.'), options: { type: 'array', items: { type: 'string' }, description: '1 to 6 short answer buttons, e.g. ["Yes", "Not yet"].' } },
      required: ['question', 'options'],
    },
    run: a => bubu.push({ asks: [{ text: a.question, options: a.options }] }),
  },
  {
    name: 'bubu_say',
    description: 'Say something to your owner. It appears as your character talking in the Bubu app.',
    inputSchema: { type: 'object', properties: { text: str('What to say, short.') }, required: ['text'] },
    run: a => bubu.push({ say: a.text }),
  },
  {
    name: 'bubu_check',
    description: "Get your owner's new answers to your questions and anything they said to you since you last checked. Each answer and message is returned once.",
    inputSchema: { type: 'object', properties: {} },
    run: () => bubu.pull(),
  },
];

const send = msg => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(m) {
  const { id, method, params } = m;
  if (method === 'initialize') return reply(id, {
    protocolVersion: params?.protocolVersion || '2025-06-18',
    capabilities: { tools: {} },
    serverInfo: { name: 'bubu', version: '0.1.0' },
    instructions: 'You are shown to your owner as a character in the Bubu phone app. Keep them posted: bubu_doing when you start something, bubu_done when you finish, bubu_ask only for decisions only they can make, bubu_check to read their answers.',
  });
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS.map(({ run, ...t }) => t) });
  if (method === 'tools/call') {
    const tool = TOOLS.find(t => t.name === params?.name);
    if (!tool) return fail(id, -32602, `unknown tool ${params?.name}`);
    try {
      const out = await tool.run(params.arguments || {});
      return reply(id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
    } catch (e) {
      return reply(id, { content: [{ type: 'text', text: String(e.message || e) }], isError: true });
    }
  }
  if (id !== undefined) return fail(id, -32601, `method not found: ${method}`);
}

createInterface({ input: process.stdin }).on('line', line => {
  if (!line.trim()) return;
  let m;
  try { m = JSON.parse(line); } catch { return fail(null, -32700, 'parse error'); }
  handle(m).catch(e => m.id !== undefined && fail(m.id, -32603, String(e.message || e)));
});
