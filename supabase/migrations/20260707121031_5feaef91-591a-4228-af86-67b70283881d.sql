
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ticker_scroll_speed numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS ticker_visible_all boolean NOT NULL DEFAULT true;

ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS size_bytes bigint NOT NULL DEFAULT 0;
