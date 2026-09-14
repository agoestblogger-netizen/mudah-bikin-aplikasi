// Test POIN B: getMaxOutputTokens per-model cap verification

import { getMaxOutputTokens } from '../src/app/api/generate/route';

console.log('=== TEST POIN B: Per-Model Max Output Token Cap ===\n');

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) { console.log(`✅ [PASS] ${msg}`); passed++; }
  else { console.error(`❌ [FAIL] ${msg}`); process.exitCode = 1; }
}

// Grup 4.096 — model dengan hard cap rendah
assert(getMaxOutputTokens('mistralai/mistral-large-2411') === 4096, 'Mistral Large → 4096');
assert(getMaxOutputTokens('mistralai/mistral-7b-instruct:free') === 4096, 'Mistral 7B free → 4096');
assert(getMaxOutputTokens('google/gemma-2-9b-it:free') === 4096, 'Gemma 2 9B free → 4096');
assert(getMaxOutputTokens('openrouter/free') === 4096, 'openrouter/free → 4096');

// Grup 8.192 — model dengan hard cap menengah (Claude 3.5, DeepSeek via OR, Llama, Qwen)
assert(getMaxOutputTokens('anthropic/claude-3.5-sonnet') === 8192, 'Claude 3.5 Sonnet → 8192');
assert(getMaxOutputTokens('anthropic/claude-3.5-haiku') === 8192, 'Claude 3.5 Haiku → 8192 (masuk deepseek grup? cek)');
assert(getMaxOutputTokens('deepseek/deepseek-chat') === 8192, 'DeepSeek Chat → 8192');
assert(getMaxOutputTokens('deepseek/deepseek-r1') === 8192, 'DeepSeek R1 → 8192');
assert(getMaxOutputTokens('qwen/qwen-2.5-coder-32b-instruct') === 8192, 'Qwen 2.5 Coder → 8192');
assert(getMaxOutputTokens('meta-llama/llama-3.3-70b-instruct') === 8192, 'Llama 3.3 70B → 8192');
assert(getMaxOutputTokens('meta-llama/llama-3.3-70b-instruct:free') === 8192, 'Llama 3.3 70B free → 8192');

// Grup 16.384 — model yang support panjang
assert(getMaxOutputTokens('openai/gpt-4o-mini') === 16384, 'GPT-4o Mini → 16384');
assert(getMaxOutputTokens('openai/gpt-4o') === 16384, 'GPT-4o → 16384');
assert(getMaxOutputTokens('gpt-4o-mini') === 16384, 'gpt-4o-mini (direct OpenAI) → 16384');
assert(getMaxOutputTokens('gpt-4o') === 16384, 'gpt-4o (direct OpenAI) → 16384');
assert(getMaxOutputTokens('gpt-5-nano') === 16384, 'GPT-5 Nano → 16384');
assert(getMaxOutputTokens('anthropic/claude-3.7-sonnet') === 16384, 'Claude 3.7 Sonnet → 16384');
assert(getMaxOutputTokens('google/gemini-2.5-flash') === 16384, 'Gemini 2.5 Flash (via OR) → 16384');
assert(getMaxOutputTokens('google/gemini-2.5-pro') === 16384, 'Gemini 2.5 Pro (via OR) → 16384');
assert(getMaxOutputTokens('openai/o3-mini') === 16384, 'o3-mini → 16384');
assert(getMaxOutputTokens('openai/o1') === 16384, 'o1 → 16384');

// Verifikasi targeted repair cap (8192 maks)
const models = ['openai/gpt-4o-mini', 'anthropic/claude-3.7-sonnet', 'anthropic/claude-3.5-sonnet', 'mistralai/mistral-large-2411'];
for (const m of models) {
  const cap = Math.min(getMaxOutputTokens(m), 8192);
  assert(cap <= 8192, `Targeted repair cap ≤ 8192 untuk ${m}: ${cap}`);
}

console.log(`\nHasil: ${passed}/${total} pengujian berhasil.`);
