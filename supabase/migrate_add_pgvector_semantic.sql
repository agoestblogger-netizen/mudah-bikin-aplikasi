-- Migrasi: semantic search untuk pemetaan bisnis (Gemini gemini-embedding-001, 768 dim).
-- Repository statis di-index ulang bila repo_version berubah.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.semantic_index (
  id text PRIMARY KEY,
  kind text NOT NULL,
  label text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  repo_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS semantic_index_embedding_idx
  ON public.semantic_index USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_semantic_index(
  query_embedding vector(768),
  match_count int DEFAULT 8,
  kinds text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  kind text,
  label text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    si.id,
    si.kind,
    si.label,
    si.metadata,
    1 - (si.embedding <=> query_embedding) AS similarity
  FROM public.semantic_index si
  WHERE si.embedding IS NOT NULL
    AND (kinds IS NULL OR si.kind = ANY(kinds))
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Pastikan PostgREST memuat fungsi/tabel baru
NOTIFY pgrst, 'reload schema';
