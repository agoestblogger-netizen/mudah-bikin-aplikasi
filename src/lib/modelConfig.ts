export type AIProvider = 'openrouter' | 'openai' | 'gemini';

export type ModelCategory = 'GRATIS' | 'EKONOMIS' | 'SEIMBANG' | 'UNGGUL';

export interface AIModelOption {
  id: string;
  label: string;
  category: ModelCategory;
  pricePerMInput: string;
  context: string;
}

export interface ProviderConfig {
  id: AIProvider;
  label: string;
  keyPlaceholder: string;
  signupUrl: string;
  baseChatUrl?: string;
}

export interface ModelSettings {
  provider: AIProvider;
  token: string;
  model: string;
}

// Storage keys (baru)
export const PROVIDER_KEY_STORAGE = 'ai_provider_key';
export const PROVIDER_TOKEN_STORAGE = 'ai_provider_token';
export const PROVIDER_MODEL_STORAGE = 'ai_provider_model';

// Storage keys lama (untuk migrasi backward-compat)
const LEGACY_OPENROUTER_KEY_STORAGE = 'openrouter_api_key';
const LEGACY_OPENROUTER_MODEL_STORAGE = 'selected_model';

export const DEFAULT_PROVIDER: AIProvider = 'openrouter';

export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';

export const OPENROUTER_SIGNUP_URL = 'https://openrouter.ai/settings/keys';
export const OPENAI_SIGNUP_URL = 'https://platform.openai.com/api-keys';
export const GEMINI_SIGNUP_URL = 'https://aistudio.google.com/app/apikey';

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
export const OPENAI_API_BASE = 'https://api.openai.com/v1';

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyPlaceholder: 'sk-or-v1-...',
    signupUrl: OPENROUTER_SIGNUP_URL,
    baseChatUrl: OPENROUTER_API_BASE,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyPlaceholder: 'sk-proj-...',
    signupUrl: OPENAI_SIGNUP_URL,
    baseChatUrl: OPENAI_API_BASE,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyPlaceholder: 'AIza atau AQ.Ab...',
    signupUrl: GEMINI_SIGNUP_URL,
  },
];

export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  GRATIS: '🆓 Gratis',
  EKONOMIS: '💰 Ekonomis',
  SEIMBANG: '⚖️ Seimbang',
  UNGGUL: '🚀 Unggul',
};

export const CATEGORY_ORDER: ModelCategory[] = ['GRATIS', 'EKONOMIS', 'SEIMBANG', 'UNGGUL'];

// Daftar model yang ditampilkan saat user sudah memasang key provider tersebut.
// OpenRouter di-fetch live dari API (lihat /api/openrouter/models), di sini hanya fallback statis.
const ROUTER_STATIC_MODELS: AIModelOption[] = [
  { id: 'openrouter/free', label: 'OpenRouter Free (auto-select)', category: 'GRATIS', pricePerMInput: '$0', context: 'Auto' },
];

const OPENAI_MODELS: AIModelOption[] = [
  { id: 'gpt-5-nano', label: 'GPT-5 Nano', category: 'EKONOMIS', pricePerMInput: '$0.05', context: '400K' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', category: 'EKONOMIS', pricePerMInput: '$0.15', context: '128K' },
];

const GEMINI_MODELS: AIModelOption[] = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', category: 'GRATIS', pricePerMInput: 'Kuota gratis', context: '1M' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', category: 'GRATIS', pricePerMInput: 'Kuota gratis', context: '1M' },
];

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openrouter: OPENROUTER_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
};

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  return PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
}

export function getModelsForProvider(provider: AIProvider): AIModelOption[] {
  if (provider === 'openrouter') return [...ROUTER_STATIC_MODELS];
  if (provider === 'openai') return OPENAI_MODELS;
  if (provider === 'gemini') return GEMINI_MODELS;
  return [];
}

export function getModelLabel(modelId: string, provider?: AIProvider): string {
  if (provider) {
    const found = getModelsForProvider(provider).find((m) => m.id === modelId);
    if (found) return found.label;
  }
  return modelId;
}

export function loadModelSettings(): ModelSettings {
  if (typeof window === 'undefined') {
    return { provider: DEFAULT_PROVIDER, token: '', model: DEFAULT_MODELS[DEFAULT_PROVIDER] };
  }

  const ls = window.localStorage;
  const provider = (ls.getItem(PROVIDER_KEY_STORAGE) as AIProvider | null) || DEFAULT_PROVIDER;
  const token = ls.getItem(PROVIDER_TOKEN_STORAGE) || '';

  let model = ls.getItem(PROVIDER_MODEL_STORAGE) || '';

  // Migrasi dari storage lama (single-provider OpenRouter) jika ditemukan
  if (!token && !ls.getItem(PROVIDER_TOKEN_STORAGE)) {
    const legacyKey = ls.getItem(LEGACY_OPENROUTER_KEY_STORAGE) || '';
    const legacyModel = ls.getItem(LEGACY_OPENROUTER_MODEL_STORAGE) || '';
    if (legacyKey) {
      ls.setItem(PROVIDER_KEY_STORAGE, 'openrouter');
      ls.setItem(PROVIDER_TOKEN_STORAGE, legacyKey);
      ls.setItem(PROVIDER_MODEL_STORAGE, legacyModel || OPENROUTER_DEFAULT_MODEL);
      ls.removeItem(LEGACY_OPENROUTER_KEY_STORAGE);
      ls.removeItem(LEGACY_OPENROUTER_MODEL_STORAGE);
      return { provider: 'openrouter', token: legacyKey, model: legacyModel || OPENROUTER_DEFAULT_MODEL };
    }
  }

  if (!model) model = DEFAULT_MODELS[provider];
  return { provider, token, model };
}

export function saveModelSettings(settings: ModelSettings): void {
  if (typeof window === 'undefined') return;
  const ls = window.localStorage;
  ls.setItem(PROVIDER_KEY_STORAGE, settings.provider);
  ls.setItem(PROVIDER_TOKEN_STORAGE, settings.token.trim());
  ls.setItem(PROVIDER_MODEL_STORAGE, settings.model);
  ls.removeItem(LEGACY_OPENROUTER_KEY_STORAGE);
  ls.removeItem(LEGACY_OPENROUTER_MODEL_STORAGE);
}
