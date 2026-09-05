# Quick Setup Checklist

## Local

1. Install Node.js 20 or newer.
2. Copy `.env.example` → `.env`.
3. Enter `BOT_TOKEN`, `CLIENT_ID`, and optionally `OWNER_ID`.
4. Add `GROQ_API_KEY_1/2/3` if AI is wanted.
5. Run `npm install`.
6. Run `npm start`.

## FPS.ms

1. Create a Node.js server.
2. Upload the repository except `node_modules/` and `.env`.
3. Set environment variables in the panel.
4. Set the startup file to `src/index.js`.
5. Run `npm install` once.
6. Start the server.

## Discord

1. Add the bot to your server.
2. Move the bot role above every role it needs to manage.
3. Run `/setup`.
4. Configure `/logs`, `/ticket-setup`, `/stats-setup`, and `/languages` as needed.
