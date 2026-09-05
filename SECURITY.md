# Security

This repository is intended to be public.

Never commit:

- `.env`
- bot tokens
- API keys
- private Discord IDs that are not intentionally public
- private server exports
- private attachments or server-specific assets

Use environment variables for secrets. The code expects:

- `BOT_TOKEN`
- `CLIENT_ID`
- optional `OWNER_ID`
- optional `GROQ_API_KEY_1`
- optional `GROQ_API_KEY_2`
- optional `GROQ_API_KEY_3`

The bot's AI feature only uses the keys present in the environment and does not write them to `data.json`.
