# Bubu server (SpacetimeDB)

The Bubu backend is one SpacetimeDB module. It stores the agents and the
things they need from you ("asks"), and it connects to Telegram so agents can
message you with answer buttons. There is no other server.

## What works now
- One owner per Bubu (`claim_owner`). Only the owner can add agents, create asks or connect Telegram.
- `connect_telegram(botToken)`: checks the token with Telegram, saves it privately, and makes a link code.
- Open your bot and send `/start <link code>` to link your chat.
- Every 2 seconds the module reads Telegram, records button taps as answers, and sends new asks with buttons.
- Answers can also come from the app (`answer_ask`). Whichever comes first wins.

- **Agent plug:** any agent (Claude, Dots, Grok, your own script) can report to your Bubu
  with its own secret key: what it is doing, what it finished, questions with answer
  buttons, and things it wants to say. It reads your answers and messages back.
  Only the key's SHA-256 hash is stored, and the key is made on your device, never on the server.
- You talk to an agent with `say_to_agent`; the agent gets it on its next `pull`.
- The owner's app reads `my_status`, `my_done`, `my_chat`, `my_asks`, `my_agent_keys`. Strangers see nothing.

- **Your phone:** the Bubu app links to your Bubu with a one-time code and then shows your
  real agents, their questions with answer buttons, and sends what you type to the agent.
  Not linked, it shows the sample business.

## Not built yet
- The Telegram setup screen inside the Bubu app.
- WhatsApp and SMS.

## Plug in an agent
1. Make a key on your own computer: `node bubu-agent.mjs new-key`. Keep the key secret.
2. Add the agent and give Bubu only the hash:
   ```
   spacetime call bubu upsert_agent juez "El Juez" "Carreras lead" vq-caporal true
   spacetime call bubu set_agent_key juez <hash>
   ```
3. Where the agent runs, set `BUBU_URL`, `BUBU_DB` and `BUBU_AGENT_KEY` (the key), then:
   ```
   node bubu-agent.mjs doing "Writing the flyer"
   node bubu-agent.mjs ask "Is race 3 confirmed?" "Yes" "Not yet"
   node bubu-agent.mjs pull
   ```
   Any language works: `POST /v1/identity` once for a token, then
   `POST /v1/database/<db>/call/agent_push` with body `["<key>", "<report json>"]`
   and `.../call/agent_pull` with `["<key>"]`. Both answer with JSON text.
   **MCP agents (Claude Code, Claude Desktop, Cursor, ...):** add `bubu-mcp.mjs` as an MCP server
   with the same three settings. The agent gets 5 tools: `bubu_doing`, `bubu_done`, `bubu_ask`,
   `bubu_say`, `bubu_check`. Claude Code:
   ```
   claude mcp add bubu -e BUBU_URL=... -e BUBU_DB=bubu -e BUBU_AGENT_KEY=bubu_... -- node /path/to/bubu-mcp.mjs
   ```
4. Link the app on your phone: run `node bubu-agent.mjs pair-code`, then the
   `spacetime call bubu set_pair_code <hash>` line it prints. In the app open
   Settings → Connect my Bubu and type the code (works once, for 15 minutes).
   Lost phone: `spacetime call bubu unlink_all_devices`.
5. Lost or leaked key: `spacetime call bubu revoke_agent_key juez`, then make a new one.

## Run it
```
cd spacetimedb && npm install && npm test   # unit tests for the Telegram logic
spacetime login                               # once, opens the browser
spacetime publish bubu                        # from this folder, to Maincloud
spacetime call bubu claim_owner
```
Create the bot in Telegram with @BotFather (`/newbot`). Paste the token only in
the Bubu app or in your own terminal. Never in a chat or a file in this repo.
