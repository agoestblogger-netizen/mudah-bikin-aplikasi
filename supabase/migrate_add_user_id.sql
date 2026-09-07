-- =======================================================
-- MIGRASI: Multi-user ownership untuk app_projects
-- Menambahkan kolom user_id + RLS per-user (menggantikan akses publik)
-- =======================================================

-- 1. Tambah kolom owner (nullable untuk kompatibilitas baris lama yang ada)
ALTER TABLE public.app_projects
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Indeks untuk query daftar file terbaru per user
CREATE INDEX IF NOT EXISTS idx_app_projects_user_updated
    ON public.app_projects (user_id, updated_at DESC);

-- 3. Hapus policy akses publik lama (development-only)
DROP POLICY IF EXISTS "Allow public read access to app_projects" ON public.app_projects;
DROP POLICY IF EXISTS "Allow public insert/update to app_projects" ON public.app_projects;

-- 4. Policy per-user (RLS)
CREATE POLICY "Users can view own projects" ON public.app_projects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.app_projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.app_projects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.app_projects
    FOR DELETE USING (auth.uid() = user_id);