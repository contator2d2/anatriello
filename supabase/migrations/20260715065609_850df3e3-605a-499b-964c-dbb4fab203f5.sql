CREATE TABLE IF NOT EXISTS public.smartroute_org_operation_settings (
  organization_id UUID PRIMARY KEY,
  max_checkin_distance_m INTEGER DEFAULT 30,
  require_facade_photo BOOLEAN DEFAULT true,
  require_vehicle_checklist BOOLEAN DEFAULT false,
  preferred_nav_app TEXT DEFAULT 'ask',
  allow_checkout_with_occurrence BOOLEAN DEFAULT true,
  require_signature BOOLEAN DEFAULT true,
  require_invoice_photo BOOLEAN DEFAULT true,
  require_receiver_document BOOLEAN DEFAULT false,
  receiver_document_type TEXT DEFAULT 'cpf',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartroute_org_operation_settings TO authenticated;
GRANT ALL ON public.smartroute_org_operation_settings TO service_role;

ALTER TABLE public.smartroute_org_operation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage SmartRoute operation settings" ON public.smartroute_org_operation_settings;
CREATE POLICY "Authenticated users can manage SmartRoute operation settings"
ON public.smartroute_org_operation_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);