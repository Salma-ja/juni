// Load .env when present (local dev). No-op on hosts that inject env vars.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.env');
if (fs.existsSync(file)) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* ignore malformed .env */
  }
}
export const ROOT = root;
