CREATE TABLE public.split_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  terminal_id uuid REFERENCES public.terminals(id) ON DELETE SET NULL,
  orientation text NOT NULL DEFAULT 'vertical_direita',
  zone2_pct integer NOT NULL DEFAULT 25,
  active boolean NOT NULL DEFAULT false,
  zone1 jsonb NOT NULL DEFAULT '{"source":"playlist","presentationId":null,"mediaIds":[],"durationMs":5000,"transition":"fade","letterbox":true,"fillStyle":"blur","description":""}'::jsonb,
  zone2 jsonb NOT NULL DEFAULT '{"source":"playlist","presentationId":null,"mediaIds":[],"durationMs":5000,"transition":"fade","letterbox":true,"fillStyle":"blur","description":""}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_layouts TO anon;
GRANT ALL ON public.split_layouts TO service_role;

ALTER TABLE public.split_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all" ON public.split_layouts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_split_layouts_updated BEFORE UPDATE ON public.split_layouts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.media ADD COLUMN IF NOT EXISTS origin_tag text NOT NULL DEFAULT '';

ALTER PUBLICATION supabase_realtime ADD TABLE public.split_layouts;