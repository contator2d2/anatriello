CREATE TABLE IF NOT EXISTS public.smartroute_route_pdvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  pdv_id UUID NOT NULL,
  sequence INTEGER DEFAULT 0,
  delivery_window TEXT DEFAULT 'qualquer',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, pdv_id)
);

GRANT ALL ON public.smartroute_route_pdvs TO service_role;

ALTER TABLE public.smartroute_route_pdvs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages SmartRoute route PDVs" ON public.smartroute_route_pdvs;
CREATE POLICY "Service role manages SmartRoute route PDVs"
ON public.smartroute_route_pdvs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

ALTER TABLE public.smartroute_route_pdvs ADD COLUMN IF NOT EXISTS delivery_window TEXT DEFAULT 'qualquer';