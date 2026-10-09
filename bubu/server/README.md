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

## Not built yet
- The Telegram setup screen inside the Bubu app.
- Real agents creating asks (the agent plug). For now asks are created by the owner.
- WhatsApp and SMS.

## Run it
```
cd spacetimedb && npm install && npm test   # unit tests for the Telegram logic
spacetime login                               # once, opens the browser
spacetime publish bubu                        # from this folder, to Maincloud
spacetime call bubu claim_owner
```
Create the bot in Telegram with @BotFather (`/newbot`). Paste the token only in
the Bubu app or in your own terminal. Never in a chat or a file in this repo.
