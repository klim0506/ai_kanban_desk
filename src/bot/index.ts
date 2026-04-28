// IMPORTANT: env.ts must be the very first import — loads .env.local before other modules
import "./env";

import { Bot } from "grammy";
import { registerCommands } from "./commands";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("ОШИБКА: TELEGRAM_BOT_TOKEN не задан в .env.local");
  process.exit(1);
}

const bot = new Bot(token);
registerCommands(bot);

console.log("Запускаю бота...");

bot
  .start({ onStart: (info) => console.log(`Бот @${info.username} запущен (polling)`) })
  .catch((err) => {
    console.error("Бот упал:", err);
    process.exit(1);
  });
