import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();

// ===== ADMIN ROUTES =====

// List routes with filters
router.get('/routes', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const { promoter_id, brand_id, pdv_id, status, date_from, date_to, supervisor_id } = req.query;
    let sql = `SELECT r.*, e.full_name as promoter_name, p.name as pdv_name, b.name as brand_name,
               sv.full_name as supervisor_name, bc.name as checklist_name
               FROM merch_routes r
               LEFT JOIN employees e ON e.id = r.promoter_id
               LEFT JOIN pdvs p ON p.id = r.pdv_id
               LEFT JOIN brands b ON b.id = r.brand_id
               LEFT JOIN employees sv ON sv.id = r.supervisor_id
               LEFT JOIN brand_checklists bc ON bc.id = r.checklist_id
               WHERE r.organization_id = $1`;
    const params = [orgId];
    let idx = 2;

    if (promoter_id) { sql += ` AND r.promoter_id = $${idx++}`; params.push(promoter_id); }
    if (brand_id) { sql += ` AND r.brand_id = $${idx++}`; params.push(brand_id); }
    if (pdv_id) { sql += ` AND r.pdv_id = $${idx++}`; params.push(pdv_id); }
    if (status) { sql += ` AND r.status = $${idx++}`; params.push(status); }
    if (supervisor_id) { sql += ` AND r.supervisor_id = $${idx++}`; params.push(supervisor_id); }
    if (date_from) { sql += ` AND r.visit_date >= $${idx++}`; params.push(date_from); }
    if (date_to) { sql += ` AND r.visit_date <= $${idx++}`; params.push(date_to); }

    sql += ' ORDER BY r.visit_date, r.scheduled_time';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('routes.list', err);
    // If table doesn't exist yet, return empty
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro ao listar rotas' });
  }
});

// Create route (with recurrence support)
router.post('/routes', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const { promoter_id, supervisor_id, pdv_id, brand_id, checklist_id, visit_date, scheduled_time,
            window_start, window_end, estimated_duration_min, priority, visit_type, notes,
            recurrence_type, recurrence_interval, recurrence_until, recurrence_weekdays } = req.body;

    // Resolve effective checklist for this brand when not explicitly passed
    let effectiveChecklistId = checklist_id || null;
    if (!effectiveChecklistId && brand_id) {
      try {
        const checklistRes = await query(
          `SELECT id FROM brand_checklists
           WHERE organization_id=$1 AND brand_id=$2 AND active=true
           ORDER BY created_at DESC LIMIT 1`,
          [orgId, brand_id]
        );
        effectiveChecklistId = checklistRes.rows[0]?.id || null;
      } catch { /* brand_checklists may not exist yet */ }
    }

    // Build list of dates to create
    const dates = [];
    const startDate = new Date(visit_date + 'T12:00:00Z');
    
    if (!recurrence_type || recurrence_type === 'none') {
      dates.push(visit_date);
    } else {
      const endDate = recurrence_until ? new Date(recurrence_until + 'T12:00:00Z') : new Date(startDate);
      if (!recurrence_until) endDate.setMonth(endDate.getMonth() + 3); // default 3 months
      const interval = recurrence_interval || 1;
      
      let current = new Date(startDate);
      while (current <= endDate) {
        if (recurrence_type === 'daily') {
          dates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + interval);
        } else if (recurrence_type === 'weekly') {
          if (recurrence_weekdays && recurrence_weekdays.length > 0) {
            const weekStart = new Date(current);
            weekStart.setDate(weekStart.getDate() - weekStart.getUTCDay() + 1);
            for (const wd of recurrence_weekdays) {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + (wd - 1));
              if (d >= startDate && d <= endDate) {
                dates.push(d.toISOString().split('T')[0]);
              }
            }
            current.setDate(current.getDate() + 7 * interval);
          } else {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 7 * interval);
          }
        } else if (recurrence_type === 'monthly') {
          dates.push(current.toISOString().split('T')[0]);
          current.setMonth(current.getMonth() + interval);
        }
      }
      const uniqueDates = [...new Set(dates)];
      dates.length = 0;
      dates.push(...uniqueDates.sort());
    }

    const recurrence = (recurrence_type && recurrence_type !== 'none')
      ? JSON.stringify({ type: recurrence_type, interval: recurrence_interval || 1, until: recurrence_until, weekdays: recurrence_weekdays })
      : null;

    const created = [];
    for (const d of dates) {
      const result = await query(
        `INSERT INTO merch_routes (organization_id, promoter_id, supervisor_id, pdv_id, brand_id, checklist_id,
         visit_date, scheduled_time, window_start, window_end, estimated_duration_min, priority, visit_type,
         recurrence, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [orgId, promoter_id, supervisor_id, pdv_id, brand_id, effectiveChecklistId, d, scheduled_time,
         window_start, window_end, estimated_duration_min || 60, priority || 'normal', visit_type || 'regular',
         recurrence, notes, req.userId]
      );

      try {
        const mixProducts = await query(
          `SELECT pbp.product_id, p.category_id
           FROM pdv_brand_products pbp
           JOIN products p ON p.id = pbp.product_id
           WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.active=true`,
          [pdv_id, brand_id]
        );
        for (const mp of mixProducts.rows) {
          await query(
            `INSERT INTO route_product_executions (route_id, product_id, category_id) VALUES ($1,$2,$3)
             ON CONFLICT DO NOTHING`,
            [result.rows[0].id, mp.product_id, mp.category_id]
          );
        }
        logInfo('routes.products_hydrated', { route_id: result.rows[0].id, count: mixProducts.rows.length });
      } catch (e) { logError('routes.hydrate_products', e); }

      created.push(result.rows[0]);
    }

    logInfo('routes.created', { count: created.length, first_id: created[0]?.id, checklist_id: effectiveChecklistId });
    res.json(created.length === 1 ? created[0] : { routes: created, count: created.length });
  } catch (err) { logError('routes.create', err); res.status(500).json({ error: 'Erro ao criar rota' }); }
});

// Update route (supports scope: 'single' | 'future')
router.put('/routes/:id', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const existing = await query('SELECT * FROM merch_routes WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });

    const old = existing.rows[0];
    const scope = req.body._scope || 'single';
    // Remove internal field
    delete req.body._scope;

    const fields = ['promoter_id','supervisor_id','pdv_id','brand_id','checklist_id','visit_date','scheduled_time',
                    'window_start','window_end','estimated_duration_min','priority','visit_type','notes','status'];

    const updates = [];
    const params = [req.params.id];
    let idx = 2;

    for (const f of fields) {
      if (req.body[f] !== undefined && req.body[f] !== old[f]) {
        await query(
          `INSERT INTO route_edit_audit_logs (route_id, field_changed, old_value, new_value, edited_by, editor_role, source, reason, route_was_completed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [req.params.id, f, String(old[f] || ''), String(req.body[f] || ''), req.userId, 'admin', 'web', req.body.edit_reason || null, old.status === 'completed']
        );
        updates.push(`${f}=$${idx++}`);
        params.push(req.body[f]);
      }
    }

    if (!updates.length) return res.json(old);
    updates.push(`updated_at=NOW()`);

    // Apply to single or future sibling routes
    if (scope === 'future') {
      // Build SET clause for siblings (exclude visit_date and status for bulk)
      const bulkFields = ['promoter_id','supervisor_id','pdv_id','brand_id','checklist_id','scheduled_time',
                          'window_start','window_end','estimated_duration_min','priority','visit_type','notes'];
      const bulkUpdates = [];
      const bulkParams = [];
      let bIdx = 1;
      for (const f of bulkFields) {
        if (req.body[f] !== undefined && req.body[f] !== old[f]) {
          bulkUpdates.push(`${f}=$${bIdx++}`);
          bulkParams.push(req.body[f]);
        }
      }
      if (bulkUpdates.length > 0) {
        bulkUpdates.push(`updated_at=NOW()`);
        bulkParams.push(orgId, old.promoter_id, old.pdv_id, old.brand_id, old.visit_date);
        const whereStart = bIdx;
        const bulkSql = `UPDATE merch_routes SET ${bulkUpdates.join(',')}
          WHERE organization_id=$${whereStart} AND promoter_id=$${whereStart+1} AND pdv_id=$${whereStart+2}
          AND brand_id=$${whereStart+3} AND visit_date >= $${whereStart+4}
          AND status IN ('scheduled','confirmed')`;
        await query(bulkSql, bulkParams);
        logInfo('routes.bulk_updated', { base_route: req.params.id, scope: 'future' });
      }
    }

    // Always update the current route with all changes
    const result = await query(`UPDATE merch_routes SET ${updates.join(',')} WHERE id=$1 RETURNING *`, params);

    // Re-hydrate products when pdv or brand changed
    const newPdv = req.body.pdv_id || old.pdv_id;
    const newBrand = req.body.brand_id || old.brand_id;
    if (req.body.pdv_id !== undefined || req.body.brand_id !== undefined) {
      try {
        await query(`DELETE FROM route_product_executions WHERE route_id=$1 AND (status IS NULL OR status='pending')`, [req.params.id]);
        const mixProducts = await query(
          `SELECT pbp.product_id, p.category_id
           FROM pdv_brand_products pbp
           JOIN products p ON p.id = pbp.product_id
           WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.active=true`,
          [newPdv, newBrand]
        );
        for (const mp of mixProducts.rows) {
          await query(
            `INSERT INTO route_product_executions (route_id, product_id, category_id) VALUES ($1,$2,$3)
             ON CONFLICT DO NOTHING`,
            [req.params.id, mp.product_id, mp.category_id]
          );
        }
        logInfo('routes.products_rehydrated', { route_id: req.params.id, count: mixProducts.rows.length });
      } catch (e) { logError('routes.rehydrate_products', e); }
    }

    res.json(result.rows[0]);
  } catch (err) { logError('routes.update', err); res.status(500).json({ error: 'Erro ao atualizar rota' }); }
});

// Delete route (supports scope: 'single' | 'future')
router.delete('/routes/:id', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;
    const scope = req.query.scope || 'single';

    if (scope === 'future') {
      // Find current route to get its siblings
      const current = await query('SELECT * FROM merch_routes WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
      if (!current.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });
      const r = current.rows[0];
      const result = await query(
        `DELETE FROM merch_routes WHERE organization_id=$1 AND promoter_id=$2 AND pdv_id=$3 AND brand_id=$4
         AND visit_date >= $5 AND status IN ('scheduled','confirmed')`,
        [orgId, r.promoter_id, r.pdv_id, r.brand_id, r.visit_date]
      );
      res.json({ ok: true, deleted: result.rowCount });
    } else {
      await query('DELETE FROM merch_routes WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
      res.json({ ok: true });
    }
  } catch (err) { logError('routes.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// Get mix preview for a PDV+Brand (what products would be added)
router.get('/routes/mix-preview', authenticate, async (req, res) => {
  try {
    const { pdv_id, brand_id } = req.query;
    if (!pdv_id || !brand_id) return res.json([]);
    const result = await query(
      `SELECT pbp.id as mix_id, pbp.product_id, pbp.mandatory, pbp.priority,
       p.name as product_name, p.sku, p.barcode, p.image_url,
       pc.name as category_name, ps.name as subcategory_name
       FROM pdv_brand_products pbp
       JOIN products p ON p.id = pbp.product_id
       LEFT JOIN product_categories pc ON pc.id = p.category_id
       LEFT JOIN product_subcategories ps ON ps.id = p.subcategory_id
       WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.active=true
       ORDER BY pc.name, ps.name, p.name`,
      [pdv_id, brand_id]
    );
    res.json(result.rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    logError('routes.mix_preview', err); res.status(500).json({ error: 'Erro' });
  }
});

// Get route products (executions)
router.get('/routes/:id/products', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT rpe.*, p.name as product_name, p.sku, p.barcode, p.image_url,
       pc.name as category_name, ps.name as subcategory_name
       FROM route_product_executions rpe
       JOIN products p ON p.id = rpe.product_id
       LEFT JOIN product_categories pc ON pc.id = rpe.category_id
       LEFT JOIN product_subcategories ps ON ps.id = p.subcategory_id
       WHERE rpe.route_id=$1 ORDER BY pc.name, ps.name, p.name`, [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    logError('routes.products', err); res.status(500).json({ error: 'Erro' });
  }
});

// Add product to route
router.post('/routes/:id/products', authenticate, async (req, res) => {
  try {
    const { product_id, category_id } = req.body;
    const result = await query(
      `INSERT INTO route_product_executions (route_id, product_id, category_id)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.id, product_id, category_id]
    );
    res.json(result.rows[0] || { ok: true });
  } catch (err) { logError('routes.add_product', err); res.status(500).json({ error: 'Erro' }); }
});

// Remove product from route
router.delete('/routes/:id/products/:productId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM route_product_executions WHERE route_id=$1 AND product_id=$2', [req.params.id, req.params.productId]);
    res.json({ ok: true });
  } catch (err) { logError('routes.remove_product', err); res.status(500).json({ error: 'Erro' }); }
});

// Sync route products from mix (re-hydrate)
router.post('/routes/:id/sync-products', authenticate, async (req, res) => {
  try {
    const route = await query('SELECT pdv_id, brand_id FROM merch_routes WHERE id=$1', [req.params.id]);
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });
    const { pdv_id, brand_id } = route.rows[0];
    
    await query(`DELETE FROM route_product_executions WHERE route_id=$1 AND (status IS NULL OR status='pending')`, [req.params.id]);
    
    const mixProducts = await query(
      `SELECT pbp.product_id, p.category_id
       FROM pdv_brand_products pbp
       JOIN products p ON p.id = pbp.product_id
       WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.active=true`,
      [pdv_id, brand_id]
    );
    for (const mp of mixProducts.rows) {
      await query(
        `INSERT INTO route_product_executions (route_id, product_id, category_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [req.params.id, mp.product_id, mp.category_id]
      );
    }
    
    const result = await query(
      `SELECT rpe.*, p.name as product_name, p.sku, p.barcode, p.image_url,
       pc.name as category_name, ps.name as subcategory_name
       FROM route_product_executions rpe
       JOIN products p ON p.id = rpe.product_id
       LEFT JOIN product_categories pc ON pc.id = rpe.category_id
       LEFT JOIN product_subcategories ps ON ps.id = p.subcategory_id
       WHERE rpe.route_id=$1 ORDER BY pc.name, ps.name, p.name`, [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { logError('routes.sync_products', err); res.status(500).json({ error: 'Erro' }); }
});

// Duplicate route
router.post('/routes/:id/duplicate', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const original = await query('SELECT * FROM merch_routes WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    if (!original.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });

    const o = original.rows[0];
    const newDate = req.body.visit_date || o.visit_date;

    const result = await query(
      `INSERT INTO merch_routes (organization_id, promoter_id, supervisor_id, pdv_id, brand_id, checklist_id,
       visit_date, scheduled_time, window_start, window_end, estimated_duration_min, priority, visit_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [orgId, o.promoter_id, o.supervisor_id, o.pdv_id, o.brand_id, o.checklist_id,
       newDate, o.scheduled_time, o.window_start, o.window_end, o.estimated_duration_min,
       o.priority, o.visit_type, o.notes, req.userId]
    );

    // Copy product executions
    const execs = await query('SELECT product_id, category_id FROM route_product_executions WHERE route_id=$1', [req.params.id]);
    for (const e of execs.rows) {
      await query('INSERT INTO route_product_executions (route_id, product_id, category_id) VALUES ($1,$2,$3)',
        [result.rows[0].id, e.product_id, e.category_id]);
    }

    res.json(result.rows[0]);
  } catch (err) { logError('routes.duplicate', err); res.status(500).json({ error: 'Erro' }); }
});

// Get route detail with executions
router.get('/routes/:id', authenticate, async (req, res) => {
  try {
    const route = await query(
      `SELECT r.*, e.full_name as promoter_name, p.name as pdv_name, b.name as brand_name,
       p.latitude as pdv_lat, p.longitude as pdv_lng, p.address as pdv_address, p.city as pdv_city
       FROM merch_routes r
       LEFT JOIN employees e ON e.id = r.promoter_id
       LEFT JOIN pdvs p ON p.id = r.pdv_id
       LEFT JOIN brands b ON b.id = r.brand_id
       WHERE r.id=$1`, [req.params.id]
    );
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });

    const executions = await query(
      `SELECT rpe.*, pr.name as product_name, pr.sku, pr.barcode, pr.image_url,
       pc.name as category_name, ps.name as subcategory_name
       FROM route_product_executions rpe
       JOIN products pr ON pr.id = rpe.product_id
       LEFT JOIN product_categories pc ON pc.id = rpe.category_id
       LEFT JOIN product_subcategories ps ON ps.id = pr.subcategory_id
       WHERE rpe.route_id=$1 ORDER BY pc.name, ps.name, pr.name`, [req.params.id]
    );

    const photos = await query('SELECT * FROM route_photos WHERE route_id=$1 ORDER BY captured_at', [req.params.id]);
    const logs = await query(
      `SELECT rel.*, e.full_name as performer_name FROM route_execution_logs rel
       LEFT JOIN employees e ON e.id = rel.performed_by
       WHERE rel.route_id=$1 ORDER BY rel.created_at`, [req.params.id]
    );
    const damages = await query('SELECT pd.*, pr.name as product_name FROM product_damages pd JOIN products pr ON pr.id=pd.product_id WHERE pd.route_id=$1', [req.params.id]);
    const ruptures = await query('SELECT pr2.*, p.name as product_name FROM product_ruptures pr2 JOIN products p ON p.id=pr2.product_id WHERE pr2.route_id=$1', [req.params.id]);

    res.json({
      ...route.rows[0],
      executions: executions.rows,
      photos: photos.rows,
      logs: logs.rows,
      damages: damages.rows,
      ruptures: ruptures.rows,
    });
  } catch (err) { logError('routes.detail', err); res.status(500).json({ error: 'Erro' }); }
});

// Route execution timeline (real-time panel)
router.get('/routes/live', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;

    const result = await query(
      `SELECT r.*, e.full_name as promoter_name, p.name as pdv_name, b.name as brand_name
       FROM merch_routes r
       LEFT JOIN employees e ON e.id = r.promoter_id
       LEFT JOIN pdvs p ON p.id = r.pdv_id
       LEFT JOIN brands b ON b.id = r.brand_id
       WHERE r.organization_id=$1 AND r.visit_date = CURRENT_DATE
       ORDER BY r.scheduled_time`, [orgId]
    );
    res.json(result.rows);
  } catch (err) { logError('routes.live', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== BRAND CHECKLISTS =====
router.get('/brand-checklists', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.json([]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id } = req.query;

    // Ensure table exists
    await query(`CREATE TABLE IF NOT EXISTS brand_checklists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      brand_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      require_checkin_photo BOOLEAN DEFAULT true,
      require_checkout_photo BOOLEAN DEFAULT false,
      require_stock_count BOOLEAN DEFAULT false,
      require_validity_check BOOLEAN DEFAULT false,
      require_extra_point BOOLEAN DEFAULT false,
      stock_count_frequency VARCHAR(20) DEFAULT 'every_visit',
      validity_check_frequency VARCHAR(20) DEFAULT 'every_visit',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    let sql = 'SELECT bc.*, b.name as brand_name FROM brand_checklists bc LEFT JOIN brands b ON b.id=bc.brand_id WHERE bc.organization_id=$1';
    const params = [orgId];
    if (brand_id) { sql += ' AND bc.brand_id=$2'; params.push(brand_id); }
    sql += ' ORDER BY b.name, bc.name';
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('checklists.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/brand-checklists', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id, name, description, require_checkin_photo, require_checkout_photo, require_stock_count,
            require_validity_check, require_extra_point, stock_count_frequency, validity_check_frequency } = req.body;

    // Ensure table exists
    await query(`CREATE TABLE IF NOT EXISTS brand_checklists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      brand_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      require_checkin_photo BOOLEAN DEFAULT true,
      require_checkout_photo BOOLEAN DEFAULT false,
      require_stock_count BOOLEAN DEFAULT false,
      require_validity_check BOOLEAN DEFAULT false,
      require_extra_point BOOLEAN DEFAULT false,
      stock_count_frequency VARCHAR(20) DEFAULT 'every_visit',
      validity_check_frequency VARCHAR(20) DEFAULT 'every_visit',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    const result = await query(
      `INSERT INTO brand_checklists (organization_id, brand_id, name, description, require_checkin_photo,
       require_checkout_photo, require_stock_count, require_validity_check, require_extra_point,
       stock_count_frequency, validity_check_frequency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orgId, brand_id, name, description, require_checkin_photo ?? true, require_checkout_photo ?? false,
       require_stock_count ?? false, require_validity_check ?? false, require_extra_point ?? false,
       stock_count_frequency || 'every_visit', validity_check_frequency || 'every_visit']
    );
    res.json(result.rows[0]);
  } catch (err) { logError('checklists.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/brand-checklists/:id', authenticate, async (req, res) => {
  try {
    const { name, description, require_checkin_photo, require_checkout_photo, require_stock_count,
            require_validity_check, require_extra_point, stock_count_frequency, validity_check_frequency, active } = req.body;
    const result = await query(
      `UPDATE brand_checklists SET name=COALESCE($2,name), description=COALESCE($3,description),
       require_checkin_photo=COALESCE($4,require_checkin_photo), require_checkout_photo=COALESCE($5,require_checkout_photo),
       require_stock_count=COALESCE($6,require_stock_count), require_validity_check=COALESCE($7,require_validity_check),
       require_extra_point=COALESCE($8,require_extra_point), stock_count_frequency=COALESCE($9,stock_count_frequency),
       validity_check_frequency=COALESCE($10,validity_check_frequency), active=COALESCE($11,active), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, name, description, require_checkin_photo, require_checkout_photo, require_stock_count,
       require_validity_check, require_extra_point, stock_count_frequency, validity_check_frequency, active]
    );
    res.json(result.rows[0]);
  } catch (err) { logError('checklists.update', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== DAMAGES (admin) =====
router.get('/damages', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id, pdv_id, product_id, status } = req.query;
    let sql = `SELECT pd.*, pr.name as product_name, p.name as pdv_name, b.name as brand_name, e.full_name as promoter_name
               FROM product_damages pd
               JOIN products pr ON pr.id=pd.product_id
               JOIN pdvs p ON p.id=pd.pdv_id
               JOIN brands b ON b.id=pd.brand_id
               JOIN employees e ON e.id=pd.promoter_id
               WHERE pd.organization_id=$1`;
    const params = [orgId];
    let idx = 2;
    if (brand_id) { sql += ` AND pd.brand_id=$${idx++}`; params.push(brand_id); }
    if (pdv_id) { sql += ` AND pd.pdv_id=$${idx++}`; params.push(pdv_id); }
    if (product_id) { sql += ` AND pd.product_id=$${idx++}`; params.push(product_id); }
    if (status) { sql += ` AND pd.status=$${idx++}`; params.push(status); }
    sql += ' ORDER BY pd.created_at DESC';
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('damages.list', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== PHOTO QUALITY SETTINGS =====
router.get('/photo-settings', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    res.json((await query('SELECT * FROM photo_quality_settings WHERE organization_id=$1', [orgId])).rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/photo-settings', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id, blur_tolerance, min_brightness, max_brightness, compression_quality, max_file_size_mb,
            require_checkin_photo, require_category_photo, require_checkout_photo, watermark_enabled } = req.body;
    const result = await query(
      `INSERT INTO photo_quality_settings (organization_id, brand_id, blur_tolerance, min_brightness, max_brightness,
       compression_quality, max_file_size_mb, require_checkin_photo, require_category_photo, require_checkout_photo, watermark_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orgId, brand_id, blur_tolerance ?? 50, min_brightness ?? 30, max_brightness ?? 90,
       compression_quality ?? 80, max_file_size_mb ?? 5, require_checkin_photo ?? true,
       require_category_photo ?? true, require_checkout_photo ?? false, watermark_enabled ?? true]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== BRAND PROMOTER ASSIGNMENTS =====
router.get('/brand-promoters', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id } = req.query;
    let sql = `SELECT bpa.*, e.full_name as promoter_name, b.name as brand_name
               FROM brand_promoter_assignments bpa
               JOIN employees e ON e.id=bpa.employee_id
               JOIN brands b ON b.id=bpa.brand_id
               WHERE bpa.organization_id=$1 AND bpa.active=true`;
    const params = [orgId];
    if (brand_id) { sql += ' AND bpa.brand_id=$2'; params.push(brand_id); }
    res.json((await query(sql, params)).rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// Create brand-promoter assignment
router.post('/brand-promoters', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id, employee_id, assignment_type } = req.body;
    const result = await query(
      `INSERT INTO brand_promoter_assignments (organization_id, brand_id, employee_id, assignment_type)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
      [orgId, brand_id, employee_id, assignment_type || 'preferred']
    );
    res.json(result.rows[0] || { ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Delete brand-promoter assignment
router.delete('/brand-promoters/:id', authenticate, async (req, res) => {
  try {
    await query('UPDATE brand_promoter_assignments SET active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== SUPERVISOR: CONTINGENCY PHOTO UPLOAD =====
router.post('/routes/:id/contingency-photos', authenticate, async (req, res) => {
  try {
    const { photo_type, category_id, product_id, exposure_point, photo_url, reason } = req.body;
    const route = await query('SELECT * FROM merch_routes WHERE id=$1', [req.params.id]);
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });

    const photo = await query(
      `INSERT INTO route_photos (route_id, photo_type, category_id, product_id, exposure_point, photo_url,
       upload_source, uploaded_by, contingency_reason, contingency_uploaded_by, contingency_device)
       VALUES ($1,$2,$3,$4,$5,$6,'web',$7,$8,$7,'web_upload') RETURNING *`,
      [req.params.id, photo_type || 'contingency', category_id, product_id, exposure_point, photo_url, req.userId, reason]
    );

    // Log contingency
    await query(
      `INSERT INTO contingency_photo_uploads (route_id, photo_id, uploaded_by, uploader_role, source, reason)
       VALUES ($1,$2,$3,'supervisor','web',$4)`,
      [req.params.id, photo.rows[0].id, req.userId, reason]
    );

    // Audit log
    await query(
      `INSERT INTO route_edit_audit_logs (route_id, field_changed, new_value, edited_by, editor_role, source, reason, route_was_completed)
       VALUES ($1,'photo_added',$2,$3,'supervisor','web',$4,$5)`,
      [req.params.id, photo_url, req.userId, reason || 'Contingência operacional', route.rows[0].status === 'completed']
    );

    // Execution author
    await query(
      `INSERT INTO execution_authors (route_id, action, performed_by, performer_role, source, details)
       VALUES ($1,'contingency_photo',$2,'supervisor','web',$3)`,
      [req.params.id, req.userId, JSON.stringify({ photo_type, reason })]
    );

    res.json(photo.rows[0]);
  } catch (err) { logError('routes.contingency_photo', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== SUPERVISOR: SWAP/ADD/REMOVE PROMOTER =====
router.post('/routes/:id/assign-promoter', authenticate, async (req, res) => {
  try {
    const { employee_id, reason, action } = req.body; // action: 'replace', 'add', 'remove'
    const route = await query('SELECT * FROM merch_routes WHERE id=$1', [req.params.id]);
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });
    const old = route.rows[0];

    // Log history
    await query(
      `INSERT INTO route_person_assignment_history (route_id, employee_id, action, reason, changed_by, progress_at_change)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, action === 'remove' ? old.promoter_id : employee_id, action || 'replace', reason, req.userId, old.progress_pct || 0]
    );

    if (action === 'replace' || !action) {
      // Audit old promoter
      await query(
        `INSERT INTO route_edit_audit_logs (route_id, field_changed, old_value, new_value, edited_by, editor_role, source, reason, route_was_completed)
         VALUES ($1,'promoter_id',$2,$3,$4,'supervisor','web',$5,$6)`,
        [req.params.id, old.promoter_id, employee_id, req.userId, reason, old.status === 'completed']
      );
      await query('UPDATE merch_routes SET promoter_id=$2, updated_at=NOW() WHERE id=$1', [req.params.id, employee_id]);
    }

    // Add to route_person_assignments
    if (action !== 'remove') {
      await query(
        `INSERT INTO route_person_assignments (route_id, employee_id, role, assigned_by)
         VALUES ($1,$2,'executor',$3) ON CONFLICT DO NOTHING`,
        [req.params.id, employee_id, req.userId]
      );
    } else {
      await query(
        `UPDATE route_person_assignments SET active=false, removed_at=NOW(), reason=$3
         WHERE route_id=$1 AND employee_id=$2`,
        [req.params.id, employee_id, reason]
      );
    }

    res.json({ ok: true });
  } catch (err) { logError('routes.assign_promoter', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== STOCK SCHEDULE RULES =====
router.get('/stock-schedule-rules', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id } = req.query;
    let sql = 'SELECT * FROM route_stock_schedule_rules WHERE organization_id=$1 AND active=true';
    const params = [orgId];
    if (brand_id) { sql += ' AND brand_id=$2'; params.push(brand_id); }
    res.json((await query(sql, params)).rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/stock-schedule-rules', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id, category_id, product_id, pdv_id, rule_type, frequency, max_postponements } = req.body;
    const result = await query(
      `INSERT INTO route_stock_schedule_rules (organization_id, brand_id, category_id, product_id, pdv_id, rule_type, frequency, max_postponements)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, brand_id, category_id, product_id, pdv_id, rule_type || 'stock_count', frequency || 'every_visit', max_postponements ?? 1]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== ROUTE AUDIT LOGS =====
router.get('/routes/:id/audit', authenticate, async (req, res) => {
  try {
    const logs = await query(
      `SELECT rea.*, u.name as editor_name, u.email as editor_email
       FROM route_edit_audit_logs rea
       LEFT JOIN users u ON u.id=rea.edited_by
       WHERE rea.route_id=$1 ORDER BY rea.created_at DESC`, [req.params.id]
    );
    res.json(logs.rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== EXECUTION AUTHORS (who did what) =====
router.get('/routes/:id/authors', authenticate, async (req, res) => {
  try {
    const authors = await query(
      `SELECT ea.*, e.full_name as performer_name
       FROM execution_authors ea
       LEFT JOIN employees e ON e.id=ea.performed_by
       WHERE ea.route_id=$1 ORDER BY ea.created_at`, [req.params.id]
    );
    res.json(authors.rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== ROUTE ASSIGNMENT HISTORY =====
router.get('/routes/:id/assignment-history', authenticate, async (req, res) => {
  try {
    const history = await query(
      `SELECT rpah.*, e.full_name as employee_name, u.name as changed_by_name
       FROM route_person_assignment_history rpah
       LEFT JOIN employees e ON e.id=rpah.employee_id
       LEFT JOIN users u ON u.id=rpah.changed_by
       WHERE rpah.route_id=$1 ORDER BY rpah.created_at DESC`, [req.params.id]
    );
    res.json(history.rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== LIVE PHOTO BOOK =====
router.get('/photo-book', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const { brand_id, pdv_id, date_from, date_to } = req.query;
    let sql = `SELECT lpb.*, e.full_name as promoter_name, pc.name as category_name, pr.name as product_name
               FROM live_photo_books lpb
               LEFT JOIN employees e ON e.id=lpb.promoter_id
               LEFT JOIN product_categories pc ON pc.id=lpb.category_id
               LEFT JOIN products pr ON pr.id=lpb.product_id
               WHERE lpb.organization_id=$1`;
    const params = [orgId];
    let idx = 2;
    if (brand_id) { sql += ` AND lpb.brand_id=$${idx++}`; params.push(brand_id); }
    if (pdv_id) { sql += ` AND lpb.pdv_id=$${idx++}`; params.push(pdv_id); }
    if (date_from) { sql += ` AND lpb.captured_at >= $${idx++}`; params.push(date_from); }
    if (date_to) { sql += ` AND lpb.captured_at <= $${idx++}`; params.push(date_to + ' 23:59:59'); }
    sql += ' ORDER BY lpb.captured_at DESC LIMIT 200';
    res.json((await query(sql, params)).rows);
  } catch (err) {
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== RETURN REQUESTS =====
router.get('/return-requests', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    const orgId = orgRes.rows[0].organization_id;
    const result = await query(
      `SELECT drr.*, p.name as pdv_name, b.name as brand_name, e.full_name as promoter_name,
       (SELECT COUNT(*) FROM damage_return_items dri WHERE dri.request_id=drr.id) as item_count,
       (SELECT json_agg(row_to_json(ri)) FROM return_invoices ri WHERE ri.request_id=drr.id) as invoices
       FROM damage_return_requests drr
       JOIN pdvs p ON p.id=drr.pdv_id
       JOIN brands b ON b.id=drr.brand_id
       JOIN employees e ON e.id=drr.promoter_id
       WHERE drr.organization_id=$1
       ORDER BY drr.created_at DESC`, [orgId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== PROMOTOR APP ENDPOINTS =====

// Promotor auth middleware
function promotorAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.employeeId = decoded.employeeId || decoded.employee_id;
    req.orgId = decoded.organizationId || decoded.organization_id;
    next();
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
}

// Import jwt at top
import jwt from 'jsonwebtoken';

// Promotor: My agenda
router.get('/promotor/agenda', promotorAuth, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `SELECT r.*, p.name as pdv_name, p.address as pdv_address, p.city as pdv_city,
               p.latitude as pdv_lat, p.longitude as pdv_lng,
               b.name as brand_name, b.logo_url as brand_logo,
               bc.name as checklist_name
               FROM merch_routes r
               LEFT JOIN pdvs p ON p.id = r.pdv_id
               LEFT JOIN brands b ON b.id = r.brand_id
               LEFT JOIN brand_checklists bc ON bc.id = r.checklist_id
               WHERE r.promoter_id = $1 AND r.organization_id = $2`;
    const params = [req.employeeId, req.orgId];
    let idx = 3;
    if (date_from) { sql += ` AND r.visit_date >= $${idx++}`; params.push(date_from); }
    if (date_to) { sql += ` AND r.visit_date <= $${idx++}`; params.push(date_to); }
    sql += ' ORDER BY r.visit_date, r.scheduled_time';
    res.json((await query(sql, params)).rows);
  } catch (err) {
    logError('promotor.agenda', err);
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// Promotor: Route detail with products
router.get('/promotor/routes/:id', promotorAuth, async (req, res) => {
  try {
    const route = await query(
      `SELECT r.*, p.name as pdv_name, p.address as pdv_address, p.city as pdv_city,
       p.latitude as pdv_lat, p.longitude as pdv_lng, p.radius_meters as pdv_radius,
       b.name as brand_name, bc.name as checklist_name,
       bc.require_checkin_photo, bc.require_checkout_photo, bc.require_stock_count,
       bc.require_validity_check, bc.require_extra_point
       FROM merch_routes r
       LEFT JOIN pdvs p ON p.id = r.pdv_id
       LEFT JOIN brands b ON b.id = r.brand_id
       LEFT JOIN brand_checklists bc ON bc.id = r.checklist_id
       WHERE r.id=$1 AND r.promoter_id=$2`, [req.params.id, req.employeeId]
    );
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });

    const executions = await query(
      `SELECT rpe.*, pr.name as product_name, pr.sku, pr.barcode, pr.image_url,
       pc.name as category_name, ps.name as subcategory_name
       FROM route_product_executions rpe
       JOIN products pr ON pr.id = rpe.product_id
       LEFT JOIN product_categories pc ON pc.id = rpe.category_id
       LEFT JOIN product_subcategories ps ON ps.id = pr.subcategory_id
       WHERE rpe.route_id=$1 ORDER BY pc.name, ps.name, pr.name`, [req.params.id]
    );

    const photos = await query('SELECT * FROM route_photos WHERE route_id=$1 ORDER BY captured_at', [req.params.id]);

    // Check postponed items
    const postponed = await query(
      `SELECT rsp.*, pr.name as product_name, pc.name as category_name
       FROM route_stock_postponements rsp
       LEFT JOIN products pr ON pr.id=rsp.product_id
       LEFT JOIN product_categories pc ON pc.id=rsp.category_id
       WHERE rsp.next_route_id=$1 AND rsp.status='pending'`, [req.params.id]
    );

    res.json({
      ...route.rows[0],
      executions: executions.rows,
      photos: photos.rows,
      postponed_items: postponed.rows,
    });
  } catch (err) { logError('promotor.route_detail', err); res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Check-in
router.post('/promotor/routes/:id/checkin', promotorAuth, async (req, res) => {
  try {
    const { latitude, longitude, device, photo_url } = req.body;
    const route = await query(
      `SELECT r.*, bc.require_checkin_photo
       FROM merch_routes r
       LEFT JOIN brand_checklists bc ON bc.id = r.checklist_id
       WHERE r.id=$1 AND r.promoter_id=$2`,
      [req.params.id, req.employeeId]
    );
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });
    if (route.rows[0].status !== 'scheduled' && route.rows[0].status !== 'confirmed') {
      return res.status(400).json({ error: 'Rota não pode receber check-in neste status' });
    }
    if (route.rows[0].require_checkin_photo && !photo_url) {
      return res.status(400).json({ error: 'Esta rota exige foto obrigatória no check-in' });
    }

    const result = await query(
      `UPDATE merch_routes SET status='in_progress', checkin_at=NOW(), checkin_latitude=$2,
       checkin_longitude=$3, checkin_device=$4, checkin_photo_url=$5, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, latitude, longitude, device, photo_url || null]
    );

    if (photo_url) {
      await query(
        `INSERT INTO route_photos (route_id, photo_type, photo_url, latitude, longitude, upload_source, uploaded_by)
         VALUES ($1,'checkin',$2,$3,$4,'app',$5)`,
        [req.params.id, photo_url, latitude, longitude, req.employeeId]
      );
    }

    await query(
      `INSERT INTO route_execution_logs (route_id, action, details, performed_by, source)
       VALUES ($1,'checkin',$2,$3,'app')`,
      [req.params.id, JSON.stringify({ latitude, longitude, has_photo: !!photo_url }), req.employeeId]
    );

    res.json(result.rows[0]);
  } catch (err) { logError('promotor.checkin', err); res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Update product execution
router.put('/promotor/executions/:id', promotorAuth, async (req, res) => {
  try {
    const { checked, qty_store, qty_stock, exposure_point, observation, status } = req.body;
    // Calculate qty_total
    const currentExec = await query('SELECT * FROM route_product_executions WHERE id=$1', [req.params.id]);
    const newStore = qty_store !== undefined ? qty_store : (currentExec.rows[0]?.qty_store || 0);
    const newStock = qty_stock !== undefined ? qty_stock : (currentExec.rows[0]?.qty_stock || 0);
    const result = await query(
      `UPDATE route_product_executions SET checked=COALESCE($2,checked), qty_store=COALESCE($3,qty_store),
       qty_stock=COALESCE($4,qty_stock), qty_total=$9, exposure_point=COALESCE($5,exposure_point),
       observation=COALESCE($6,observation), status=COALESCE($7,status),
       executed_by=$8, executed_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, checked, qty_store, qty_stock, exposure_point, observation, status, req.employeeId, newStore + newStock]
    );

    // Update route progress
    if (result.rows.length) {
      const routeId = result.rows[0].route_id;
      const progress = await query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='completed') as done
         FROM route_product_executions WHERE route_id=$1`, [routeId]
      );
      const pct = progress.rows[0].total > 0 ? (progress.rows[0].done / progress.rows[0].total * 100) : 0;
      await query('UPDATE merch_routes SET progress_pct=$2, updated_at=NOW() WHERE id=$1', [routeId, pct]);
    }

    res.json(result.rows[0]);
  } catch (err) { logError('promotor.exec_update', err); res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Add validity entry
router.post('/promotor/executions/:id/validity', promotorAuth, async (req, res) => {
  try {
    const exec = await query('SELECT * FROM route_product_executions WHERE id=$1', [req.params.id]);
    if (!exec.rows.length) return res.status(404).json({ error: 'Execução não encontrada' });
    const { expiry_date, qty_store, qty_stock } = req.body;
    const result = await query(
      `INSERT INTO product_validity_entries (execution_id, route_id, product_id, expiry_date, qty_store, qty_stock, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, exec.rows[0].route_id, exec.rows[0].product_id, expiry_date, qty_store || 0, qty_stock || 0, req.employeeId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Report rupture
router.post('/promotor/executions/:id/rupture', promotorAuth, async (req, res) => {
  try {
    const exec = await query('SELECT * FROM route_product_executions WHERE id=$1', [req.params.id]);
    if (!exec.rows.length) return res.status(404).json({ error: 'Execução não encontrada' });
    const { qty_store, qty_stock, reason, observation, photo_url } = req.body;
    await query('UPDATE route_product_executions SET has_rupture=true WHERE id=$1', [req.params.id]);
    const result = await query(
      `INSERT INTO product_ruptures (route_id, product_id, execution_id, qty_store, qty_stock, reason, observation, photo_url, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [exec.rows[0].route_id, exec.rows[0].product_id, req.params.id, qty_store||0, qty_stock||0, reason, observation, photo_url, req.employeeId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Report damage
router.post('/promotor/executions/:id/damage', promotorAuth, async (req, res) => {
  try {
    const exec = await query('SELECT rpe.*, r.pdv_id, r.brand_id, r.organization_id FROM route_product_executions rpe JOIN merch_routes r ON r.id=rpe.route_id WHERE rpe.id=$1', [req.params.id]);
    if (!exec.rows.length) return res.status(404).json({ error: 'Execução não encontrada' });
    const e = exec.rows[0];
    const { qty_store, qty_stock, reason, description, photo_url, location } = req.body;
    await query('UPDATE route_product_executions SET has_damage=true WHERE id=$1', [req.params.id]);
    const result = await query(
      `INSERT INTO product_damages (organization_id, route_id, product_id, pdv_id, brand_id, execution_id, promoter_id,
       location, qty_store, qty_stock, reason, description, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [e.organization_id, e.route_id, e.product_id, e.pdv_id, e.brand_id, req.params.id, req.employeeId,
       location||'store', qty_store||0, qty_stock||0, reason, description, photo_url]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Report discard
router.post('/promotor/executions/:id/discard', promotorAuth, async (req, res) => {
  try {
    const exec = await query('SELECT * FROM route_product_executions WHERE id=$1', [req.params.id]);
    if (!exec.rows.length) return res.status(404).json({ error: 'Execução não encontrada' });
    const { qty_store, qty_stock, reason, photo_url, observation } = req.body;
    await query('UPDATE route_product_executions SET has_discard=true WHERE id=$1', [req.params.id]);
    const result = await query(
      `INSERT INTO product_discards (route_id, product_id, execution_id, qty_store, qty_stock, reason, photo_url, observation, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [exec.rows[0].route_id, exec.rows[0].product_id, req.params.id, qty_store||0, qty_stock||0, reason, photo_url, observation, req.employeeId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Upload photo
router.post('/promotor/routes/:id/photos', promotorAuth, async (req, res) => {
  try {
    const { photo_type, category_id, product_id, exposure_point, photo_url, latitude, longitude,
            original_size_bytes, compressed_size_bytes, quality_score, quality_passed } = req.body;
    const result = await query(
      `INSERT INTO route_photos (route_id, photo_type, category_id, product_id, exposure_point, photo_url,
       latitude, longitude, original_size_bytes, compressed_size_bytes, quality_score, quality_passed,
       upload_source, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'app',$13) RETURNING *`,
      [req.params.id, photo_type, category_id, product_id, exposure_point, photo_url,
       latitude, longitude, original_size_bytes, compressed_size_bytes, quality_score, quality_passed ?? true, req.employeeId]
    );

    await query(
      `INSERT INTO route_execution_logs (route_id, action, details, performed_by, source)
       VALUES ($1,'photo_uploaded',$2,$3,'app')`,
      [req.params.id, JSON.stringify({ photo_type, category_id }), req.employeeId]
    );

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Finalize route
router.post('/promotor/routes/:id/checkout', promotorAuth, async (req, res) => {
  try {
    const { latitude, longitude, photo_url, notes } = req.body;

    // Check all mandatory items
    const pending = await query(
      `SELECT COUNT(*) as cnt FROM route_product_executions WHERE route_id=$1 AND status != 'completed'`, [req.params.id]
    );

    const result = await query(
      `UPDATE merch_routes SET status='completed', checkout_at=NOW(), checkout_latitude=$2,
       checkout_longitude=$3, checkout_photo_url=$4, completion_notes=$5, progress_pct=100,
       completed_at=NOW(), updated_at=NOW() WHERE id=$1 AND promoter_id=$6 RETURNING *`,
      [req.params.id, latitude, longitude, photo_url, notes, req.employeeId]
    );

    await query(
      `INSERT INTO route_execution_logs (route_id, action, details, performed_by, source)
       VALUES ($1,'checkout',$2,$3,'app')`,
      [req.params.id, JSON.stringify({ latitude, longitude, pending: pending.rows[0].cnt }), req.employeeId]
    );

    res.json(result.rows[0]);
  } catch (err) { logError('promotor.checkout', err); res.status(500).json({ error: 'Erro' }); }
});

// Promotor: My damages
router.get('/promotor/damages', promotorAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT pd.*, pr.name as product_name, p.name as pdv_name, b.name as brand_name
               FROM product_damages pd
               JOIN products pr ON pr.id=pd.product_id
               JOIN pdvs p ON p.id=pd.pdv_id
               JOIN brands b ON b.id=pd.brand_id
               WHERE pd.promoter_id=$1`;
    const params = [req.employeeId];
    if (status) { sql += ' AND pd.status=$2'; params.push(status); }
    sql += ' ORDER BY pd.created_at DESC';
    res.json((await query(sql, params)).rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Request return
router.post('/promotor/return-requests', promotorAuth, async (req, res) => {
  try {
    const { damage_ids, pdv_id, brand_id, notes } = req.body;
    const result = await query(
      `INSERT INTO damage_return_requests (organization_id, pdv_id, brand_id, promoter_id, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.orgId, pdv_id, brand_id, req.employeeId, notes]
    );

    for (const did of damage_ids) {
      await query('INSERT INTO damage_return_items (request_id, damage_id) VALUES ($1,$2)', [result.rows[0].id, did]);
      await query('UPDATE product_damages SET status=$2 WHERE id=$1', [did, 'awaiting_invoice']);
    }

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Upload return invoice
router.post('/promotor/return-invoices', promotorAuth, async (req, res) => {
  try {
    const { request_id, invoice_number, invoice_date, issuer_name, photo_url, pdf_url } = req.body;
    const result = await query(
      `INSERT INTO return_invoices (request_id, invoice_number, invoice_date, issuer_name, photo_url, pdf_url, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [request_id, invoice_number, invoice_date, issuer_name, photo_url, pdf_url, req.employeeId]
    );

    await query('UPDATE damage_return_requests SET status=$2, updated_at=NOW() WHERE id=$1', [request_id, 'invoice_sent']);
    // Update related damages
    const items = await query('SELECT damage_id FROM damage_return_items WHERE request_id=$1', [request_id]);
    for (const item of items.rows) {
      await query('UPDATE product_damages SET status=$2 WHERE id=$1', [item.damage_id, 'invoice_sent']);
    }

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Promotor: Postpone stock count
router.post('/promotor/postpone', promotorAuth, async (req, res) => {
  try {
    const { route_id, product_id, category_id, item_type, reason } = req.body;
    // Find next route for same PDV/brand
    const currentRoute = await query('SELECT * FROM merch_routes WHERE id=$1', [route_id]);
    if (!currentRoute.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });
    const cr = currentRoute.rows[0];

    const nextRoute = await query(
      `SELECT id FROM merch_routes WHERE promoter_id=$1 AND pdv_id=$2 AND brand_id=$3
       AND visit_date > $4 AND status IN ('scheduled','confirmed')
       ORDER BY visit_date LIMIT 1`,
      [req.employeeId, cr.pdv_id, cr.brand_id, cr.visit_date]
    );

    const result = await query(
      `INSERT INTO route_stock_postponements (route_id, product_id, category_id, item_type, reason, postponed_by, next_route_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [route_id, product_id, category_id, item_type, reason, req.employeeId, nextRoute.rows[0]?.id || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== PROMOTER TEAM LIST (admin) =====
router.get('/promoters-team', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const result = await query(
      `SELECT e.id, e.full_name, e.position, e.photo_url, e.worker_profile,
              e.direct_manager_id as supervisor_id,
              sv.full_name as supervisor_name,
              (SELECT COUNT(*) FROM merch_routes mr WHERE mr.promoter_id = e.id AND mr.visit_date >= CURRENT_DATE - interval '30 days') as total_routes,
              (SELECT COUNT(DISTINCT mr.brand_id) FROM merch_routes mr WHERE mr.promoter_id = e.id AND mr.visit_date >= CURRENT_DATE - interval '90 days') as active_brands,
              (SELECT COUNT(DISTINCT mr.pdv_id) FROM merch_routes mr WHERE mr.promoter_id = e.id AND mr.visit_date >= CURRENT_DATE - interval '90 days') as active_pdvs
       FROM employees e
       LEFT JOIN employees sv ON sv.id = e.direct_manager_id
       WHERE e.organization_id = $1 AND e.worker_profile IN ('promotor','operacional') AND e.status = 'ativo'
       ORDER BY sv.full_name NULLS LAST, e.full_name`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    logError('merch.promoters-team', err);
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== AI ROUTE OPTIMIZATION =====

// Get optimization context data
router.get('/ai/optimization-context', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const { promoter_ids, brand_id, date_from, date_to, region } = req.query;

    // Get promoters with home location and brand permissions
    let promoterSql = `SELECT e.id, e.full_name, e.home_latitude, e.home_longitude, e.work_schedule,
                        e.direct_manager_id as supervisor_id,
                        COALESCE(
                          (SELECT json_agg(bpa.brand_id) FROM brand_promoter_assignments bpa WHERE bpa.employee_id = e.id AND bpa.active = true), '[]'
                        ) as brand_ids,
                        (SELECT COUNT(*) FROM merch_routes mr WHERE mr.promoter_id = e.id 
                         AND mr.visit_date >= $2 AND mr.visit_date <= $3 AND mr.status != 'cancelled') as existing_routes
                       FROM employees e
                       WHERE e.organization_id = $1 AND e.worker_profile IN ('promotor','operacional') AND e.status = 'ativo'`;
    const promoterParams = [orgId, date_from || 'now()', date_to || 'now()'];
    
    if (promoter_ids) {
      const ids = promoter_ids.split(',');
      promoterSql += ` AND e.id = ANY($4)`;
      promoterParams.push(ids);
    }
    promoterSql += ' ORDER BY e.full_name';
    
    // Get PDVs with brand mix info
    let pdvSql = `SELECT p.id, p.name, p.address, p.city, p.state, p.latitude, p.longitude, p.radius_meters,
                   COALESCE(
                     (SELECT json_agg(json_build_object('brand_id', pbp.brand_id, 'product_count', 
                       (SELECT COUNT(*) FROM pdv_brand_products pbp2 WHERE pbp2.pdv_id = p.id AND pbp2.brand_id = pbp.brand_id AND pbp2.active = true)
                     )) FROM (SELECT DISTINCT brand_id FROM pdv_brand_products WHERE pdv_id = p.id AND active = true) pbp), '[]'
                   ) as brands_mix,
                   (SELECT AVG(EXTRACT(EPOCH FROM (mr.checkout_at - mr.checkin_at))/60) 
                    FROM merch_routes mr WHERE mr.pdv_id = p.id AND mr.checkout_at IS NOT NULL 
                    AND mr.checkin_at IS NOT NULL) as avg_visit_minutes
                  FROM pdvs p WHERE p.organization_id = $1 AND p.active = true`;
    const pdvParams = [orgId];
    
    if (brand_id) {
      pdvSql += ` AND EXISTS (SELECT 1 FROM pdv_brand_products pbp WHERE pbp.pdv_id = p.id AND pbp.brand_id = $2 AND pbp.active = true)`;
      pdvParams.push(brand_id);
    }
    if (region) {
      pdvSql += ` AND p.city ILIKE $${pdvParams.length + 1}`;
      pdvParams.push(`%${region}%`);
    }
    pdvSql += ' ORDER BY p.name';

    // Get existing routes in period
    const existingSql = `SELECT r.id, r.promoter_id, r.pdv_id, r.brand_id, r.visit_date, r.scheduled_time,
                          r.estimated_duration_min, r.status, p.name as pdv_name, b.name as brand_name
                         FROM merch_routes r
                         LEFT JOIN pdvs p ON p.id = r.pdv_id
                         LEFT JOIN brands b ON b.id = r.brand_id
                         WHERE r.organization_id = $1 AND r.visit_date >= $2 AND r.visit_date <= $3 AND r.status != 'cancelled'
                         ORDER BY r.visit_date, r.scheduled_time`;

    // Get brands
    const brandsSql = `SELECT id, name FROM brands WHERE organization_id = $1 ORDER BY name`;

    const [promoters, pdvsList, existing, brands] = await Promise.all([
      query(promoterSql, promoterParams),
      query(pdvSql, pdvParams),
      query(existingSql, [orgId, date_from || new Date().toISOString().split('T')[0], date_to || new Date().toISOString().split('T')[0]]),
      query(brandsSql, [orgId]),
    ]);

    res.json({
      promoters: promoters.rows,
      pdvs: pdvsList.rows,
      existing_routes: existing.rows,
      brands: brands.rows,
    });
  } catch (err) {
    logError('merch.ai.context', err);
    if (err.code === '42P01') return res.json({ promoters: [], pdvs: [], existing_routes: [], brands: [] });
    res.status(500).json({ error: 'Erro ao carregar contexto' });
  }
});

// Generate AI route suggestions
router.post('/ai/optimize', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    // Get org AI config
    const orgConfig = await query('SELECT ai_provider, ai_model, ai_api_key FROM organizations WHERE id=$1', [orgId]);
    if (!orgConfig.rows.length || !orgConfig.rows[0].ai_api_key || orgConfig.rows[0].ai_provider === 'none') {
      return res.status(400).json({ error: 'Configure a IA da organização em Configurações > IA antes de usar o planejamento inteligente.' });
    }

    const { provider, model, apiKey } = {
      provider: orgConfig.rows[0].ai_provider,
      model: orgConfig.rows[0].ai_model,
      apiKey: orgConfig.rows[0].ai_api_key,
    };

    const { promoters, pdvs, existing_routes, date_from, date_to, brand_id, rules } = req.body;

    const systemPrompt = `Você é um assistente especializado em otimização de rotas de merchandising.
Sua tarefa é gerar sugestões de rotas otimizadas para promotores de merchandising.

REGRAS:
- Cada promotor só pode atender marcas para as quais está habilitado
- Distribua as visitas equilibradamente entre os dias do período
- Minimize o tempo de deslocamento agrupando PDVs próximos no mesmo dia
- Considere a localização da casa/base do promotor para a primeira e última visita do dia
- Respeite o limite máximo de ${rules?.max_visits_per_day || 6} visitas por dia
- Respeite o limite máximo de ${rules?.max_hours_per_day || 8} horas por dia
- Duração estimada padrão por visita: ${rules?.default_visit_duration || 60} minutos
- Tempo médio de deslocamento entre PDVs: 30 minutos (ajuste por distância se houver coordenadas)
${rules?.additional_rules || ''}

RESPONDA EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "suggestions": [
    {
      "promoter_id": "uuid",
      "promoter_name": "nome",
      "pdv_id": "uuid",
      "pdv_name": "nome",
      "brand_id": "uuid",
      "brand_name": "nome",
      "visit_date": "YYYY-MM-DD",
      "scheduled_time": "HH:MM",
      "estimated_duration_min": 60,
      "reason": "Motivo da sugestão"
    }
  ],
  "insights": [
    "Texto descritivo de cada insight/sugestão de melhoria"
  ],
  "metrics": {
    "total_visits": 0,
    "total_travel_hours_estimated": 0,
    "avg_visits_per_day": 0,
    "conflicts_avoided": 0
  }
}`;

    const userPrompt = `Gere um plano de rotas otimizado para o período de ${date_from} a ${date_to}.

PROMOTORES DISPONÍVEIS:
${JSON.stringify(promoters.map((p) => ({
  id: p.id, nome: p.full_name,
  lat: p.home_latitude, lng: p.home_longitude,
  marcas_autorizadas: p.brand_ids,
  rotas_existentes: p.existing_routes,
})), null, 2)}

PDVs PARA ATENDER:
${JSON.stringify(pdvs.map((p) => ({
  id: p.id, nome: p.name, cidade: p.city,
  lat: p.latitude, lng: p.longitude,
  marcas: p.brands_mix,
  tempo_medio_visita_min: p.avg_visit_minutes || rules?.default_visit_duration || 60,
})), null, 2)}

${brand_id ? `MARCA FOCO: ${brand_id}` : 'TODAS AS MARCAS'}

ROTAS JÁ AGENDADAS NO PERÍODO (evitar conflitos):
${JSON.stringify(existing_routes.map((r) => ({
  promotor: r.promoter_id, pdv: r.pdv_id, data: r.visit_date, hora: r.scheduled_time,
})), null, 2)}

Gere as sugestões de rota otimizadas.`;

    const { callAI: callAIFn } = await import('../lib/ai-caller.js');
    const aiResult = await callAIFn(
      { provider, model, apiKey },
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 4000, responseFormat: { type: 'json_object' } }
    );

    let parsed;
    try {
      parsed = JSON.parse(aiResult.content);
    } catch {
      // Try to extract JSON from response
      const match = aiResult.content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('IA retornou resposta inválida');
    }

    // Log optimization run
    try {
      await query(
        `INSERT INTO route_ai_optimization_runs (organization_id, run_by, date_from, date_to, brand_id,
         promoter_count, pdv_count, suggestions_count, tokens_used, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed')`,
        [orgId, req.userId, date_from, date_to, brand_id || null,
         promoters.length, pdvs.length, parsed.suggestions?.length || 0, aiResult.tokensUsed || 0]
      );
    } catch { /* table might not exist yet */ }

    res.json({
      suggestions: parsed.suggestions || [],
      insights: parsed.insights || [],
      metrics: parsed.metrics || {},
      tokens_used: aiResult.tokensUsed || 0,
    });
  } catch (err) {
    logError('merch.ai.optimize', err);
    res.status(500).json({ error: err.message || 'Erro na otimização com IA' });
  }
});

// Approve AI suggestions (bulk create routes)
router.post('/ai/approve', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const { suggestions } = req.body;
    if (!suggestions?.length) return res.status(400).json({ error: 'Nenhuma sugestão para aprovar' });

    const created = [];
    for (const s of suggestions) {
      let effectiveChecklistId = s.checklist_id || null;
      if (!effectiveChecklistId && s.brand_id) {
        try {
          const checklistRes = await query(
            `SELECT id FROM brand_checklists
             WHERE organization_id=$1 AND brand_id=$2 AND active=true
             ORDER BY created_at DESC LIMIT 1`,
            [orgId, s.brand_id]
          );
          effectiveChecklistId = checklistRes.rows[0]?.id || null;
        } catch { /* ignore */ }
      }

      const result = await query(
        `INSERT INTO merch_routes (organization_id, promoter_id, pdv_id, brand_id, checklist_id,
         visit_date, scheduled_time, estimated_duration_min, priority, visit_type, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'normal','regular',$9,$10) RETURNING *`,
        [orgId, s.promoter_id, s.pdv_id, s.brand_id, effectiveChecklistId,
         s.visit_date, s.scheduled_time, s.estimated_duration_min || 60,
         `[IA] ${s.reason || ''}`, req.userId]
      );
      created.push(result.rows[0]);

      try {
        const mixProducts = await query(
          `SELECT pbp.product_id, p.category_id
           FROM merch_pdv_brand_products pbp
           JOIN merch_products p ON p.id = pbp.product_id
           WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.active=true`,
          [s.pdv_id, s.brand_id]
        );
        for (const mp of mixProducts.rows) {
          await query(
            `INSERT INTO route_product_executions (route_id, product_id, category_id) VALUES ($1,$2,$3)`,
            [result.rows[0].id, mp.product_id, mp.category_id]
          );
        }
      } catch { /* ignore */ }
    }

    res.json({ created: created.length, routes: created });
  } catch (err) {
    logError('merch.ai.approve', err);
    res.status(500).json({ error: 'Erro ao aprovar sugestões' });
  }
});

// Workload analysis
router.get('/workload', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const { promoter_id, date_from, date_to } = req.query;

    const result = await query(
      `SELECT r.visit_date, r.promoter_id, e.full_name as promoter_name,
              COUNT(*) as visits,
              SUM(COALESCE(r.estimated_duration_min, 60)) as total_minutes,
              COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed,
              COUNT(CASE WHEN r.status = 'in_progress' THEN 1 END) as in_progress,
              COUNT(CASE WHEN r.status = 'scheduled' THEN 1 END) as scheduled
       FROM merch_routes r
       LEFT JOIN employees e ON e.id = r.promoter_id
       WHERE r.organization_id = $1 AND r.status != 'cancelled'
       ${promoter_id ? 'AND r.promoter_id = $4' : ''}
       AND r.visit_date >= $2 AND r.visit_date <= $3
       GROUP BY r.visit_date, r.promoter_id, e.full_name
       ORDER BY r.visit_date`,
      promoter_id ? [orgId, date_from, date_to, promoter_id] : [orgId, date_from, date_to]
    );

    res.json(result.rows);
  } catch (err) {
    logError('merch.workload', err);
    if (err.code === '42P01') return res.json([]);
    res.status(500).json({ error: 'Erro' });
  }
});

export default router;
