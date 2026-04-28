@echo off
echo Starting Telegram bot (polling mode)...
echo Make sure TELEGRAM_BOT_TOKEN is set in .env.local
echo.
node_modules\.bin\tsx --env-file=.env.local src/bot/index.ts
