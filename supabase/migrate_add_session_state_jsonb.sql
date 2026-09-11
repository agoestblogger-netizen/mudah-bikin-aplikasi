-- Migrasi: kolom session_state untuk sesi mockup terpandu (Multiple-Choice Flow).
-- Menyimpan MockupSessionState (match, painPoints, roles, flow, features, step).
ALTER TABLE public.app_projects
  ADD COLUMN IF NOT EXISTS session_state JSONB NOT NULL DEFAULT '{}'::jsonb;
