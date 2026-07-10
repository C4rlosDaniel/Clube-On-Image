-- Add global letterbox toggle for media display.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ticker_letterbox_mode boolean NOT NULL DEFAULT true;
