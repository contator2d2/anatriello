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
          // If weekdays specified, create for each selected weekday in that week
          if (recurrence_weekdays && recurrence_weekdays.length > 0) {
            const weekStart = new Date(current);
            weekStart.setDate(weekStart.getDate() - weekStart.getUTCDay() + 1); // Monday
            for (const wd of recurrence_weekdays) {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + (wd - 1)); // wd: 1=Mon..7=Sun
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
      // Deduplicate
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
        [orgId, promoter_id, supervisor_id, pdv_id, brand_id, checklist_id, d, scheduled_time,
         window_start, window_end, estimated_duration_min || 60, priority || 'normal', visit_type || 'regular',
         recurrence, notes, req.userId]
      );

      // Auto-load products from PDV mix
      try {
        const mixProducts = await query(
          `SELECT pbp.product_id, p.category_id FROM pdv_brand_products pbp
           JOIN products p ON p.id = pbp.product_id
           WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.active=true`,
          [pdv_id, brand_id]
        );
        for (const mp of mixProducts.rows) {
          await query(
            `INSERT INTO route_product_executions (route_id, product_id, category_id) VALUES ($1,$2,$3)`,
            [result.rows[0].id, mp.product_id, mp.category_id]
          );
        }
      } catch (e) { /* mix table may not exist yet */ }

      created.push(result.rows[0]);
    }

    logInfo('routes.created', { count: created.length, first_id: created[0]?.id });
    res.json(created.length === 1 ? created[0] : { routes: created, count: created.length });
  } catch (err) { logError('routes.create', err); res.status(500).json({ error: 'Erro ao criar rota' }); }
});

// Update route
router.put('/routes/:id', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    const orgId = orgRes.rows[0].organization_id;

    const existing = await query('SELECT * FROM merch_routes WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });

    const old = existing.rows[0];
    const fields = ['promoter_id','supervisor_id','pdv_id','brand_id','checklist_id','visit_date','scheduled_time',
                    'window_start','window_end','estimated_duration_min','priority','visit_type','notes','status'];

    const updates = [];
    const params = [req.params.id];
    let idx = 2;

    for (const f of fields) {
      if (req.body[f] !== undefined && req.body[f] !== old[f]) {
        // Audit log
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

    const result = await query(`UPDATE merch_routes SET ${updates.join(',')} WHERE id=$1 RETURNING *`, params);
    res.json(result.rows[0]);
  } catch (err) { logError('routes.update', err); res.status(500).json({ error: 'Erro ao atualizar rota' }); }
});

// Delete route
router.delete('/routes/:id', authenticate, async (req, res) => {
  try {
    const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Sem organização' });
    await query('DELETE FROM merch_routes WHERE id=$1 AND organization_id=$2', [req.params.id, orgRes.rows[0].organization_id]);
    res.json({ ok: true });
  } catch (err) { logError('routes.delete', err); res.status(500).json({ error: 'Erro' }); }
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
    if (!brand_id) return res.json([]);
    // Check if table exists first
    const tableCheck = await query("SELECT to_regclass('public.brand_checklists') as t");
    if (!tableCheck.rows[0].t) return res.json([]);
    let sql = 'SELECT bc.*, b.name as brand_name FROM brand_checklists bc JOIN brands b ON b.id=bc.brand_id WHERE bc.organization_id=$1';
    const params = [orgId];
    sql += ' AND bc.brand_id=$2'; params.push(brand_id);
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
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
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
    req.employeeId = decoded.employee_id;
    req.orgId = decoded.organization_id;
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
    const route = await query('SELECT * FROM merch_routes WHERE id=$1 AND promoter_id=$2', [req.params.id, req.employeeId]);
    if (!route.rows.length) return res.status(404).json({ error: 'Rota não encontrada' });
    if (route.rows[0].status !== 'scheduled' && route.rows[0].status !== 'confirmed') {
      return res.status(400).json({ error: 'Rota não pode receber check-in neste status' });
    }

    const result = await query(
      `UPDATE merch_routes SET status='in_progress', checkin_at=NOW(), checkin_latitude=$2,
       checkin_longitude=$3, checkin_device=$4, checkin_photo_url=$5, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, latitude, longitude, device, photo_url]
    );

    // Save checkin photo
    if (photo_url) {
      await query(
        `INSERT INTO route_photos (route_id, photo_type, photo_url, latitude, longitude, upload_source, uploaded_by)
         VALUES ($1,'checkin',$2,$3,$4,'app',$5)`,
        [req.params.id, photo_url, latitude, longitude, req.employeeId]
      );
    }

    // Log
    await query(
      `INSERT INTO route_execution_logs (route_id, action, details, performed_by, source)
       VALUES ($1,'checkin',$2,$3,'app')`,
      [req.params.id, JSON.stringify({ latitude, longitude }), req.employeeId]
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

export default router;
