#!/usr/bin/env node
/**
 * Script seeding/refresh index semantic (cadangan bila lazy seeding tidak jalan).
 *
 * Pemakaian:
 *   node scripts/seed-semantic-index.mjs [baseUrl]
 *
 * Env yang dibutuhkan:
 *   NEXT_PUBLIC_SUPABASE_URL   (atau SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY             (server; untuk endpoint /api/semantic/seed)
 *
 * Script juga bisa membaca file .env.production / .env.local di root project.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

const root = resolve(process.cwd());
loadEnvFile(resolve(root, '.env.production'));
loadEnvFile(resolve(root, '.env.local'));

const baseUrl = process.argv[2] || process.env.SEED_BASE_URL || 'http://127.0.0.1:3001';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY tidak ditemukan (env / .env.production / .env.local).');
  process.exit(1);
}

const endpoint = `${baseUrl.replace(/\/$/, '')}/api/semantic/seed`;

const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-seed-key': serviceKey }
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

console.log(`POST ${endpoint} -> HTTP ${res.status}`);
console.log(JSON.stringify(data, null, 2));

process.exit(res.ok && data.success ? 0 : 1);
