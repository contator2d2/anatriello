
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.app_logs;

GRANT SELECT, INSERT ON public.app_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_logs TO authenticated;
GRANT ALL ON public.app_logs TO service_role;

CREATE POLICY "Anyone can insert logs"
  ON public.app_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read logs"
  ON public.app_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS app_logs_created_at_idx ON public.app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_level_idx ON public.app_logs (level);
