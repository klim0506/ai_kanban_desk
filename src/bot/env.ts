// Must be imported FIRST in bot/index.ts — loads .env.local before any other module initializes
import dotenv from "dotenv";
import path from "path";

const root = process.cwd();
const envLocalPath = path.resolve(root, ".env.local");
const envPath = path.resolve(root, ".env");

// .env is a shared baseline, .env.local keeps machine-specific overrides.
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });
