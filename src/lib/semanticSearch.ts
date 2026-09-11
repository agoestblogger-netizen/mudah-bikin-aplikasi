import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  MASTER_TEMPLATES,
  INDUSTRY_OVERLAYS,
  PROCESS_PATTERNS,
  TEMPLATE_PROCESS_MAP,
  getTemplateProcessMap
} from '@/lib/templates';

/**
 * Semantic search untuk pemetaan bisnis (Langkah 0).
 * - Index repository di tabel `semantic_index` (Gemini gemini-embedding-001, 768 dim).
 * - Teks prompt user TIDAK disimpan; hanya embedding repository yang tersimpan.
 */

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;
const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

// Threshold hasil kalibrasi (lihat pengujian 8 prompt representatif).
export const OVERLAY_CONFIDENCE_THRESHOLD = 0.68;
export const OVERLAY_MARGIN_THRESHOLD = 0.03;
export const TEMPLATE_CONFIDENCE_THRESHOLD = 0.7;
export const TEMPLATE_MARGIN_THRESHOLD = 0.03;

export function getTemplateIdForOverlay(overlayId: string): string | undefined {
  const entry = TEMPLATE_PROCESS_MAP.find((m) => m.overlayIds.includes(overlayId));
  return entry?.templateId;
}

type SemanticKind = 'template' | 'overlay' | 'pattern';

interface SemanticIndexDoc {
  id: string;
  kind: SemanticKind;
  label: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SemanticMatch {
  id: string;
  kind: string;
  label: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface SemanticMappingResult {
  confident: boolean;
  templateId?: string;
  overlayIds?: string[];
  patternIds?: string[];
  topScore: number;
  candidates: SemanticMatch[];
}

export function buildSemanticIndexDocs(): SemanticIndexDoc[] {
  const docs: SemanticIndexDoc[] = [];

  for (const t of MASTER_TEMPLATES) {
    docs.push({
      id: t.id,
      kind: 'template',
      label: t.nama,
      content:
        `Template aplikasi ${t.id} ${t.nama}. ${t.deskripsi} ` +
        `Peran bawaan: ${t.roleDefault.join(', ')}. ` +
        `Modul: ${t.modulDanSection.map((m) => `${m.modul} (${m.sections.join(', ')})`).join('; ')}.`,
      metadata: { templateId: t.id }
    });
  }

  for (const o of INDUSTRY_OVERLAYS) {
    docs.push({
      id: o.id,
      kind: 'overlay',
      label: o.nama,
      content:
        `Overlay industri ${o.nama}. Kata kunci: ${o.keywords.join(', ')}. ` +
        `Catatan khas: ${o.notes.join('; ')}. ` +
        `Masalah umum: ${o.painPoints.map((p) => p.label).join('; ')}. ` +
        `Peran: ${o.roleLabels.join(', ')}. ` +
        `Komponen wajib: ${o.coreItems.join('; ')}.`,
      metadata: { overlayId: o.id }
    });
  }

  for (const p of PROCESS_PATTERNS) {
    docs.push({
      id: p.id,
      kind: 'pattern',
      label: p.nama,
      content:
        `Pola proses bisnis ${p.id} ${p.nama}. ${p.tujuan} ` +
        `Entitas: ${p.entities.map((e) => e.name).join(', ')}. ` +
        `Tahapan: ${p.stages.map((s) => s.label).join(' -> ')}. ` +
        `Aktor: ${p.actors.map((a) => a.role).join(', ')}.`,
      metadata: { patternId: p.id }
    });
  }

  return docs;
}

export function getRepoVersion(docs: SemanticIndexDoc[]): string {
  const payload = docs.map((d) => ({ id: d.id, content: d.content }));
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
  apiKey: string
): Promise<number[] | null> {
  if (!text.trim() || !apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIM
      })
    });
    if (!res.ok) {
      console.warn('Embedding HTTP error:', res.status, (await res.text()).slice(0, 160));
      return null;
    }
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) return null;
    return values;
  } catch (err) {
    console.warn('Embedding failed:', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Lazy seeding: index repository bila versi belum ada / berubah.
 */
export async function ensureSemanticIndex(
  apiKey: string
): Promise<{ ok: boolean; indexed: number; reason?: string }> {
  const docs = buildSemanticIndexDocs();
  const version = getRepoVersion(docs);

  try {
    const { data, error } = await supabaseAdmin
      .from('semantic_index')
      .select('id, repo_version');

    if (error) {
      return { ok: false, indexed: 0, reason: error.message };
    }

    const rows = (data || []) as { id: string; repo_version: string }[];
    const isFresh =
      rows.length === docs.length && rows.every((r) => r.repo_version === version);
    if (isFresh) return { ok: true, indexed: 0 };

    const embeddings = await mapWithConcurrency(docs, 4, (doc) =>
      embedText(doc.content, 'RETRIEVAL_DOCUMENT', apiKey)
    );

    const insertRows = docs
      .map((doc, idx) => ({
        id: doc.id,
        kind: doc.kind,
        label: doc.label,
        content: doc.content,
        metadata: doc.metadata,
        embedding: embeddings[idx] ? `[${embeddings[idx]!.join(',')}]` : null,
        repo_version: version,
        updated_at: new Date().toISOString()
      }))
      .filter((row) => row.embedding);

    if (insertRows.length === 0) {
      return { ok: false, indexed: 0, reason: 'Sebagian besar embedding gagal dibuat' };
    }

    await supabaseAdmin.from('semantic_index').delete().not('id', 'is', null);

    for (let i = 0; i < insertRows.length; i += 25) {
      const chunk = insertRows.slice(i, i + 25);
      const { error: insertError } = await supabaseAdmin.from('semantic_index').insert(chunk);
      if (insertError) {
        return { ok: false, indexed: 0, reason: insertError.message };
      }
    }

    return { ok: true, indexed: insertRows.length };
  } catch (err) {
    return { ok: false, indexed: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function querySemanticIndex(
  embedding: number[],
  kinds: string[],
  matchCount = 8
): Promise<SemanticMatch[]> {
  const { data, error } = await supabaseAdmin.rpc('match_semantic_index', {
    query_embedding: `[${embedding.join(',')}]`,
    match_count: matchCount,
    kinds
  });
  if (error) {
    console.warn('match_semantic_index error:', error.message);
    return [];
  }
  return (data || []) as SemanticMatch[];
}

/**
 * Pemetaan bisnis via kemiripan semantik.
 * Dua jalur keputusan:
 * 1. Overlay-first: overlay teratas cukup tinggi & margin jelas → template pemilik overlay.
 * 2. Template-first: template teratas cukup tinggi & margin jelas → pakai map template.
 * confident=true berarti hasil dipakai tanpa AI mapper.
 */
export async function resolveSemanticMapping(
  prompt: string,
  apiKey: string
): Promise<SemanticMappingResult | null> {
  const embedding = await embedText(prompt, 'RETRIEVAL_QUERY', apiKey);
  if (!embedding) return null;

  const matches = await querySemanticIndex(embedding, ['template', 'overlay'], 8);
  if (matches.length === 0) return null;

  const overlays = matches.filter((m) => m.kind === 'overlay');
  const templates = matches.filter((m) => m.kind === 'template');
  const topOverlay = overlays[0];
  const secondOverlay = overlays[1];
  const topTemplate = templates[0];
  const secondTemplate = templates[1];

  const topScore = Math.max(topOverlay?.similarity ?? 0, topTemplate?.similarity ?? 0);

  // Jalur 1: overlay-first
  if (topOverlay && topOverlay.similarity >= OVERLAY_CONFIDENCE_THRESHOLD) {
    const overlayMargin = secondOverlay ? topOverlay.similarity - secondOverlay.similarity : 1;
    const owningTemplateId = getTemplateIdForOverlay(topOverlay.id);
    if (owningTemplateId && overlayMargin >= OVERLAY_MARGIN_THRESHOLD) {
      const map = getTemplateProcessMap(owningTemplateId);
      return {
        confident: true,
        templateId: owningTemplateId,
        overlayIds: map?.overlayIds && map.overlayIds.length > 0 ? map.overlayIds : [topOverlay.id],
        patternIds: map?.patternIds || [],
        topScore: topOverlay.similarity,
        candidates: matches
      };
    }
  }

  // Jalur 2: template-first (mis. HR yang tidak punya overlay khusus)
  if (topTemplate && topTemplate.similarity >= TEMPLATE_CONFIDENCE_THRESHOLD) {
    const templateMargin = secondTemplate ? topTemplate.similarity - secondTemplate.similarity : 1;
    if (templateMargin >= TEMPLATE_MARGIN_THRESHOLD) {
      const map = getTemplateProcessMap(topTemplate.id);
      return {
        confident: true,
        templateId: topTemplate.id,
        overlayIds: map?.overlayIds || [],
        patternIds: map?.patternIds || [],
        topScore: topTemplate.similarity,
        candidates: matches
      };
    }
  }

  return {
    confident: false,
    topScore,
    candidates: matches,
    templateId: topTemplate?.id
  };
}
