DO $$
BEGIN
  IF to_regclass('public.merch_routes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_merch_routes_org_visit ON public.merch_routes (organization_id, visit_date DESC, scheduled_time);
    CREATE INDEX IF NOT EXISTS idx_merch_routes_org_promoter_visit ON public.merch_routes (organization_id, promoter_id, visit_date DESC);
    CREATE INDEX IF NOT EXISTS idx_merch_routes_org_brand_visit ON public.merch_routes (organization_id, brand_id, visit_date DESC);
    CREATE INDEX IF NOT EXISTS idx_merch_routes_org_pdv_visit ON public.merch_routes (organization_id, pdv_id, visit_date DESC);
  END IF;

  IF to_regclass('public.route_product_executions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_route_product_exec_route_status ON public.route_product_executions (route_id, status);
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'route_product_executions' AND column_name = 'route_brand_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_route_product_exec_route_brand ON public.route_product_executions (route_brand_id);
    END IF;
  END IF;

  IF to_regclass('public.route_brands') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_route_brands_route ON public.route_brands (route_id);
    CREATE INDEX IF NOT EXISTS idx_route_brands_brand ON public.route_brands (brand_id);
  END IF;

  IF to_regclass('public.brand_checklists') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_brand_checklists_org_brand_active ON public.brand_checklists (organization_id, brand_id, active, created_at DESC);
  END IF;

  IF to_regclass('public.connections') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_connections_org_created ON public.connections (organization_id, created_at DESC);
  END IF;

  IF to_regclass('public.connection_members') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_connection_members_user_conn ON public.connection_members (user_id, connection_id);
  END IF;

  IF to_regclass('public.conversations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_conversations_unread_by_connection ON public.conversations (connection_id, last_message_at DESC) WHERE unread_count > 0 AND is_archived = false;
  END IF;

  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_timestamp ON public.chat_messages (conversation_id, timestamp DESC);
  END IF;
END $$;