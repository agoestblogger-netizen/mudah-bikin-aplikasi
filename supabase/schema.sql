-- =======================================================
-- MUDAH BIKIN APLIKASI - DATABASE SCHEMA
-- Organisasi Supabase Baru: Mudah Bikin Aplikasi
-- =======================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: App Projects
CREATE TABLE IF NOT EXISTS public.app_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    app_type VARCHAR(50) DEFAULT 'web_app', -- 'web_app', 'dashboard', 'form_crud', 'landing_page'
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'canvas_active', 'brief_completed', 'deployed'
    
    -- Styling & Theme
    theme_palette JSONB DEFAULT '{"primary": "#6366f1", "mode": "dark"}'::jsonb,
    styling_config JSONB DEFAULT '{}'::jsonb,
    
    -- Checklists & Brief Data
    feature_checklist JSONB DEFAULT '[]'::jsonb,
    roles_checklist JSONB DEFAULT '[]'::jsonb,
    schema_checklist JSONB DEFAULT '[]'::jsonb,
    
    -- Prototype & Canvas Code
    canvas_html TEXT,
    canvas_css TEXT,
    canvas_js TEXT,
    
    -- Backend Google Apps Script
    gas_script TEXT,
    gas_web_app_url TEXT,
    spreadsheet_id TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table: Visual Assets
CREATE TABLE IF NOT EXISTS public.visual_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.app_projects(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL, -- 'logo', 'icon', 'background', 'reference_image'
    asset_name VARCHAR(255) NOT NULL,
    asset_url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table: Audit Logs & Quality Self-Checks
CREATE TABLE IF NOT EXISTS public.quality_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.app_projects(id) ON DELETE CASCADE,
    has_canvas_code BOOLEAN DEFAULT FALSE,
    has_dynamic_state BOOLEAN DEFAULT FALSE,
    has_admin_user_management BOOLEAN DEFAULT FALSE,
    has_gas_backend BOOLEAN DEFAULT FALSE,
    audit_score INT DEFAULT 0,
    audit_notes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.app_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;

-- Multi-user ownership untuk app_projects (demo: file disimpan per akun)
CREATE INDEX IF NOT EXISTS idx_app_projects_user_updated
    ON public.app_projects (user_id, updated_at DESC);

-- Policy per-user untuk app_projects (setiap user hanya melihat file miliknya)
CREATE POLICY "Users can view own projects" ON public.app_projects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.app_projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.app_projects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.app_projects
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Allow public read access to visual_assets" ON public.visual_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update to visual_assets" ON public.visual_assets FOR ALL USING (true);

CREATE POLICY "Allow public read access to quality_audits" ON public.quality_audits FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update to quality_audits" ON public.quality_audits FOR ALL USING (true);

-- 4. Table: Rate Limits (Persistent Rate Limiter — tidak reset saat container restart)
-- Identifier: user_id (jika login) atau IP sebagai fallback
CREATE TABLE IF NOT EXISTS public.rate_limits (
    identifier TEXT PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- RLS dinonaktifkan — diakses langsung via supabaseAdmin (service role key)
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;

-- Index untuk cleanup window expired (opsional, bisa dijadikan cron)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);
