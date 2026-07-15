DROP POLICY IF EXISTS "Backend can read SmartRoute operation settings" ON public.smartroute_org_operation_settings;
CREATE POLICY "Backend can read SmartRoute operation settings"
ON public.smartroute_org_operation_settings
FOR SELECT
TO service_role
USING (true);