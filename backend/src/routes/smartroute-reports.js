// SmartRoute AI - Relatórios avançados (SLA, heatmap, BI operacional)
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';
import { ensureSmartRouteTables } from './smartroute.js';

const router = express.Router();
router.use(authenticate);
router.use(async (req, res, next) => { try { await ensureSmartRouteTables(); next(); } catch (e) { next(e); } });

const orgId = (req) => req.user?.organization_id;
const period = (req) => {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const fromDate = new Date(to);
  fromDate.setDate(fromDate.getDate() - Number(req.query.days || 30));
  const from = req.query.from || fromDate.toISOString().slice(0, 10);
  return { from, to };
};

// KPIs gerais do período
router.get('/kpis', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const r = await query(
      `SELECT
         COUNT(DISTINCT r.id)::int AS total_routes,
         COALESCE(SUM(r.total_distance_km),0)::float AS total_km,
         COUNT(s.id)::int AS total_stops,
         COUNT(s.id) FILTER (WHERE s.status='concluida')::int AS delivered,
         COUNT(s.id) FILTER (WHERE s.status='falhou')::int AS failed,
         AVG(EXTRACT(EPOCH FROM (s.departed_at - s.arrived_at))/60) FILTER (WHERE s.departed_at IS NOT NULL AND s.arrived_at IS NOT NULL)::float AS avg_stop_minutes,
         AVG(EXTRACT(EPOCH FROM (r.ended_at - r.started_at))/60) FILTER (WHERE r.ended_at IS NOT NULL AND r.started_at IS NOT NULL)::float AS avg_route_minutes
       FROM smartroute_routes r
       LEFT JOIN smartroute_route_stops s ON s.route_id=r.id
       WHERE r.organization_id=$1 AND r.planned_date BETWEEN $2 AND $3`,
      [org, from, to]
    );
    const row = r.rows[0] || {};
    const total = (row.delivered || 0) + (row.failed || 0);
    const sla = total > 0 ? (row.delivered / total) * 100 : 0;
    res.json({ ...row, sla_percent: sla, period: { from, to } });
  } catch (e) { logError('sr.reports.kpis', e); res.status(500).json({ error: e.message }); }
});

// Série diária (entregas x falhas x km)
router.get('/timeseries', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const r = await query(
      `SELECT r.planned_date AS date,
              COUNT(s.id) FILTER (WHERE s.status='concluida')::int AS delivered,
              COUNT(s.id) FILTER (WHERE s.status='falhou')::int AS failed,
              COALESCE(SUM(r.total_distance_km),0)::float AS km
       FROM smartroute_routes r
       LEFT JOIN smartroute_route_stops s ON s.route_id=r.id
       WHERE r.organization_id=$1 AND r.planned_date BETWEEN $2 AND $3
       GROUP BY r.planned_date ORDER BY r.planned_date`,
      [org, from, to]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SLA por motorista
router.get('/sla/drivers', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const r = await query(
      `SELECT d.id, d.full_name,
              COUNT(s.id)::int AS total,
              COUNT(s.id) FILTER (WHERE s.status='concluida')::int AS delivered,
              COUNT(s.id) FILTER (WHERE s.status='falhou')::int AS failed,
              CASE WHEN COUNT(s.id) FILTER (WHERE s.status IN ('concluida','falhou'))>0
                THEN (COUNT(s.id) FILTER (WHERE s.status='concluida')::float / COUNT(s.id) FILTER (WHERE s.status IN ('concluida','falhou')))*100
                ELSE NULL END AS sla_percent,
              AVG(EXTRACT(EPOCH FROM (s.departed_at - s.arrived_at))/60) FILTER (WHERE s.departed_at IS NOT NULL AND s.arrived_at IS NOT NULL)::float AS avg_stop_min
       FROM smartroute_drivers d
       LEFT JOIN smartroute_routes r ON r.driver_id=d.id AND r.planned_date BETWEEN $2 AND $3
       LEFT JOIN smartroute_route_stops s ON s.route_id=r.id
       WHERE d.organization_id=$1
       GROUP BY d.id, d.full_name
       HAVING COUNT(s.id) > 0
       ORDER BY sla_percent DESC NULLS LAST`,
      [org, from, to]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SLA por PDV (problemas recorrentes)
router.get('/sla/pdvs', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const r = await query(
      `SELECT p.id, p.name, p.city, p.state,
              COUNT(s.id)::int AS total,
              COUNT(s.id) FILTER (WHERE s.status='concluida')::int AS delivered,
              COUNT(s.id) FILTER (WHERE s.status='falhou')::int AS failed,
              CASE WHEN COUNT(s.id) FILTER (WHERE s.status IN ('concluida','falhou'))>0
                THEN (COUNT(s.id) FILTER (WHERE s.status='concluida')::float / COUNT(s.id) FILTER (WHERE s.status IN ('concluida','falhou')))*100
                ELSE NULL END AS sla_percent
       FROM smartroute_pdvs p
       LEFT JOIN smartroute_route_stops s ON s.pdv_id=p.id
       LEFT JOIN smartroute_routes r ON r.id=s.route_id AND r.planned_date BETWEEN $2 AND $3
       WHERE p.organization_id=$1
       GROUP BY p.id, p.name, p.city, p.state
       HAVING COUNT(s.id) > 0
       ORDER BY sla_percent ASC NULLS LAST
       LIMIT 100`,
      [org, from, to]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Heatmap de entregas (por lat/lng)
router.get('/heatmap', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const kind = req.query.kind === 'failed' ? 'falhou' : 'concluida';
    const r = await query(
      `SELECT COALESCE(s.checkin_lat, p.lat) AS lat,
              COALESCE(s.checkin_lng, p.lng) AS lng,
              COUNT(*)::int AS weight
       FROM smartroute_route_stops s
       JOIN smartroute_routes r ON r.id=s.route_id
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       WHERE r.organization_id=$1 AND r.planned_date BETWEEN $2 AND $3
         AND s.status=$4
         AND COALESCE(s.checkin_lat, p.lat) IS NOT NULL
       GROUP BY 1,2`,
      [org, from, to, kind]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Distribuição por horário (BI operacional)
router.get('/hourly', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const r = await query(
      `SELECT EXTRACT(HOUR FROM s.arrived_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE s.status='concluida')::int AS delivered
       FROM smartroute_route_stops s
       JOIN smartroute_routes r ON r.id=s.route_id
       WHERE r.organization_id=$1 AND r.planned_date BETWEEN $2 AND $3 AND s.arrived_at IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      [org, from, to]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Motivos de falha
router.get('/failure-reasons', async (req, res) => {
  try {
    const org = orgId(req);
    const { from, to } = period(req);
    const r = await query(
      `SELECT COALESCE(NULLIF(TRIM(s.notes),''),'Sem motivo informado') AS reason,
              COUNT(*)::int AS total
       FROM smartroute_route_stops s
       JOIN smartroute_routes r ON r.id=s.route_id
       WHERE r.organization_id=$1 AND r.planned_date BETWEEN $2 AND $3 AND s.status='falhou'
       GROUP BY 1 ORDER BY total DESC LIMIT 20`,
      [org, from, to]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
