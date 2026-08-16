-- =======================================================
-- MUDAH BIKIN APLIKASI - DATABASE SCHEMA
-- Organisasi Supabase Baru: Mudah Bikin Aplikasi
-- =======================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: App Projects
CREATE TABLE IF NOT EXISTS public.app_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Allow Public / Anon Read & Write for Prototype Development
CREATE POLICY "Allow public read access to app_projects" ON public.app_projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update to app_projects" ON public.app_projects FOR ALL USING (true);

CREATE POLICY "Allow public read access to visual_assets" ON public.visual_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update to visual_assets" ON public.visual_assets FOR ALL USING (true);

CREATE POLICY "Allow public read access to quality_audits" ON public.quality_audits FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update to quality_audits" ON public.quality_audits FOR ALL USING (true);
