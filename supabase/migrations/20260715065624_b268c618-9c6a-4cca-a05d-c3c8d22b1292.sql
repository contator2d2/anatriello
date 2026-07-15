DROP POLICY IF EXISTS "Authenticated users can manage SmartRoute operation settings" ON public.smartroute_org_operation_settings;
REVOKE ALL ON public.smartroute_org_operation_settings FROM authenticated;
GRANT ALL ON public.smartroute_org_operation_settings TO service_role;