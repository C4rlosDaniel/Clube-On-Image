
-- Layouts (reusable zone geometry)
CREATE TABLE public.layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layouts TO anon, authenticated;
GRANT ALL ON public.layouts TO service_role;

ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all" ON public.layouts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER touch_layouts BEFORE UPDATE ON public.layouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Presentations: add layout + per-zone bindings
ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS layout_id uuid REFERENCES public.layouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zones jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed built-in layouts (idempotent by name)
INSERT INTO public.layouts (name, description, zones, is_builtin)
SELECT * FROM (VALUES
  ('Tela cheia', 'Uma única zona ocupando 100%',
    '[{"key":"A","x":0,"y":0,"w":100,"h":100}]'::jsonb, true),
  ('70/30 Horizontal', 'Zona A à esquerda (70%) + Zona B à direita (30%)',
    '[{"key":"A","x":0,"y":0,"w":70,"h":100},{"key":"B","x":70,"y":0,"w":30,"h":100}]'::jsonb, true),
  ('50/50 Vertical', 'Zona A em cima (50%) + Zona B embaixo (50%)',
    '[{"key":"A","x":0,"y":0,"w":100,"h":50},{"key":"B","x":0,"y":50,"w":100,"h":50}]'::jsonb, true),
  ('80/20 Rodapé', 'Zona A ocupa 80% + Zona B rodapé 20%',
    '[{"key":"A","x":0,"y":0,"w":100,"h":80},{"key":"B","x":0,"y":80,"w":100,"h":20}]'::jsonb, true)
) AS v(name, description, zones, is_builtin)
WHERE NOT EXISTS (SELECT 1 FROM public.layouts WHERE public.layouts.name = v.name);
