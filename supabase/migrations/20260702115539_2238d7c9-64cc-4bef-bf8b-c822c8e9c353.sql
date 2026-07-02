
CREATE TABLE public.ticker_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  label text NOT NULL DEFAULT 'AVISO',
  color text NOT NULL DEFAULT '#dc2626',
  priority boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  terminal_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticker_messages TO anon, authenticated;
GRANT ALL ON public.ticker_messages TO service_role;
ALTER TABLE public.ticker_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all" ON public.ticker_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ticker_messages_updated BEFORE UPDATE ON public.ticker_messages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.terminals ADD COLUMN IF NOT EXISTS show_ticker boolean NOT NULL DEFAULT true;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ticker_messages;
ALTER TABLE public.ticker_messages REPLICA IDENTITY FULL;
