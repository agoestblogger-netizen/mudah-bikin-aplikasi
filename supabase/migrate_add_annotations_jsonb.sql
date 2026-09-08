-- Add annotations JSONB for OpenDesign-like marks/comments/patches
ALTER TABLE public.app_projects
ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '{}'::jsonb;
