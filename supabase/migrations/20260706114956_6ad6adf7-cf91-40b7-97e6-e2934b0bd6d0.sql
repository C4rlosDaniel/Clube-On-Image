ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ticker_height_px integer NOT NULL DEFAULT 96,
  ADD COLUMN IF NOT EXISTS ticker_font_family text NOT NULL DEFAULT 'Roboto',
  ADD COLUMN IF NOT EXISTS ticker_font_min integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS ticker_font_max integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS ticker_bg_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS ticker_bg_opacity numeric NOT NULL DEFAULT 0.95;