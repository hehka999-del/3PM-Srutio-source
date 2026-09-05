# 3PM Studio 6.0.0 — Public Edition

A configurable Discord administration bot with moderation, ranking, public statistics, tickets, polls, tables, AutoMod, language selection and optional Groq AI.

## Features

- Moderation: warn, mute, timeout, kick, ban, cases and warn queue.
- Ranking: PNG `/rank` card, server leaderboard `/top`, level bonuses.
- Public statistics: `/stats-setup` creates visible voice counters that cannot be joined.
- Tickets: `/ticket-setup` + `/ticket` with private support channels.
- Tables: step-by-step builder with lines, media and up to 5 link buttons.
- Polls: percentage bars, vote buttons and automatic results.
- AutoMod/filter: links, invites, CAPS, mentions, Zalgo, repeated text and bad words.
- Languages: per-user language selector with English as the default.
- AI: one `/ai` entry point, three Groq API-key slots, persistent server rules, optional automatic chat, moderation review helpers and bounded in-memory history.
- Lightweight architecture designed for small hosting limits.

## Quick start

### 1. Create your Discord application

Create a bot application in the Discord Developer Portal. Copy the bot token and application ID.

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
BOT_TOKEN=your_bot_token
CLIENT_ID=your_application_id
OWNER_ID=your_discord_user_id

GROQ_API_KEY_1=
GROQ_API_KEY_2=
GROQ_API_KEY_3=

GROQ_MODEL_1=llama-3.1-8b-instant
GROQ_MODEL_2=openai/gpt-oss-20b
GROQ_MODEL_3=openai/gpt-oss-120b
```

Never commit `.env`. It is already ignored by `.gitignore`.

### 3. Install dependencies

```bash
npm install
```

### 4. Start

```bash
npm start
```

For a syntax check:

```bash
npm run check
```

## FPS.ms / Pterodactyl

Upload the repository files except `node_modules/` and `.env`.

Set the same values in the hosting panel's Environment Variables, then run:

```bash
npm install
npm start
```

Recommended startup file: `src/index.js`.

## First server setup

1. Add the bot with the permissions your server needs.
2. Put the bot's highest role above roles it must manage.
3. Run `/setup`.
4. Run `/logs` and select a log channel.
5. Run `/ticket-setup` if you want tickets.
6. Run `/stats-setup` for public server counters.
7. Run `/languages` so each user can select their preferred UI language.
8. Use `/help` to see the command list.

## AI setup

Set one, two or three Groq keys. The bot rotates across configured keys when a key is rate-limited or temporarily unavailable.

AI settings are stored per server in `data.json`. Keep them concise because they are added to the system prompt.

The public build uses current Groq model IDs as defaults: `llama-3.1-8b-instant`, `openai/gpt-oss-20b`, and `openai/gpt-oss-120b`. Availability, pricing and rate limits are controlled by Groq.

## Important security notes

- No Discord token, owner ID, guild ID, API key or server-specific channel ID is included in this repository.
- Do not commit `.env`, `data.json` with private content, or private server assets.
- Review any assets before publishing them.

## Command reference

See [`COMMANDS.md`](COMMANDS.md).

## Project structure

```text
src/
  ai.js        Groq client, key rotation and AI memory
  commands.js  Slash-command definitions
  config.js    Environment configuration
  db.js        JSON persistence and defaults
  index.js     Discord client and handlers
  ui.js        Embeds, language UI and shared components
assets/        Optional public assets
.env.example  Environment template
COMMANDS.md   Command reference
QUICKSTART.md Fast setup checklist
LICENSE       MIT license
```
