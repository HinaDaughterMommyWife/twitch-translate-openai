# Twitch chat translator with openai (only one user)

<div align="center" style="margin-bottom: 80px; margin-top: 80px;">
<img src="https://jx7ybzgtf5.ufs.sh/f/XWI0PqIVLI3zPisyzyToZdG5DTu1Ra8wX9xi0lWPJUnct7gM" width="600" />
</div>

---

A program that translates Twitch chat messages from a specific user into another language.

It uses **OpenAI** for translation and **tmi.js** to connect to the Twitch API.

The program loads contextual information from the markdown file located at [context/translate.md](context/translate.md).

### Environment Variables

API keys and configuration are managed through a `.env` file. The following variables are required:

```bash
# Twitch API credentials & other configurations

TWITCH_CLIENT_ID="your_client_id_here"
TWITCH_CLIENT_SECRET="your_client_secret_here"

TWITCH_BOT_USERNAME="your_bot_username_here"
TWITCH_LISTENING_CHANNEL="your_channel_here"
TWITCH_TARGET_USERNAME="target_username_here"

TWITCH_REDIRECT_URI="http://localhost:3000/callback"

# OpenAI API credentials

OPENAI_BASE_URL="your_base_API_url_here"
OPENAI_API_KEY="your_deepseek_api_key_here"
```

---

## Requirements

- [Bun](https://bun.sh/) (recommended) or Node.js
- [PM2](https://pm2.keymetrics.io/) (for VPS or self-hosting)

---

## Installation

```bash
bun install
```

---

## Usage

```bash
bun run index.ts
```

Simple health check:

```bash
# on twitch chat
ඞඞ
```

---

## Self-Hosting or VPS

```bash
pm2 start ecosystem.config.js
```

Stop:

```bash
pm2 stop ecosystem.config.js
```

---

## Logs

```bash
pm2 logs
```

To view only the bot's logs:

```bash
# Live monitoring (only messages from the target user and translated messages)
tail -f twitch-bot.log

# One-time output
cat twitch-bot.log
```

Made by [Hina Lover](https://github.com/HinaDaughterMommyWife) 💕
