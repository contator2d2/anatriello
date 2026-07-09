// SmartRoute — Onda 6: Roteirização inteligente
// Endpoints:
//   POST /api/smartroute/planner/auto-plan  → gera preview (não persiste)
//   POST /api/smartroute/planner/commit     → persiste plano como rotas
//   POST /api/smartroute/planner/routes/:id/reoptimize → re-otimiza mantendo paradas concluídas

import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

// ---------- utils ----------
const R_KM = 6371;
function haversine(a, b) {
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const toMin = (t) => t ? Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5)) : null;
const fmtEta = (m) => m == null ? '—' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

// Sweep algorithm: agrupa por ângulo em torno do depósito
function sweepCluster(depot, orders, k) {
  const withAngle = orders.map((o) => ({
    ...o,
    _angle: Math.atan2(o.lat - depot.lat, o.lng - depot.lng),
  }));
  withAngle.sort((a, b) => a._angle - b._angle);
  const clusters = Array.from({ length: k }, () => []);
  const per = Math.ceil(withAngle.length / k);
  withAngle.forEach((o, i) => clusters[Math.min(k - 1, Math.floor(i / per))].push(o));
  return clusters;
}

// Bin-pack respeitando capacidade — devolve arrays de orders por veículo
function assignByCapacity(clusters, vehicles) {
  const bins = vehicles.map((v) => ({
    vehicle: v,
    capKg: Number(v.capacity_kg) || Infinity,
    capM3: Number(v.capacity_m3) || Infinity,
    usedKg: 0, usedM3: 0,
    orders: [],
  }));
  // aloca cluster→bin de mesmo índice; overflow vai para o bin mais folgado
  clusters.forEach((cluster, i) => {
    const primary = bins[i] || bins[0];
    for (const o of cluster) {
      const w = Number(o.weight_kg || 0), v = Number(o.volume_m3 || 0);
      let target = primary;
      if (target.usedKg + w > target.capKg || target.usedM3 + v > target.capM3) {
        target = [...bins].sort((a, b) =>
          ((a.capKg - a.usedKg) + (a.capM3 - a.usedM3) * 100) -
          ((b.capKg - b.usedKg) + (b.capM3 - b.usedM3) * 100)
        ).pop();
      }
      target.orders.push(o);
      target.usedKg += w; target.usedM3 += v;
    }
  });
  return bins;
}

// Nearest-neighbor com janela e prioridade — igual ao optimize-advanced
function sequence(depot, orders, startClockMin = 8 * 60, speedKmH = 30) {
  const remaining = [...orders];
  let cur = { lat: depot.lat, lng: depot.lng };
  let clock = startClockMin;
  const seq = []; let totalKm = 0;
  const warnings = [];
  while (remaining.length) {
    remaining.sort((a, b) => {
      const dA = haversine(cur, a), dB = haversine(cur, b);
      const etaA = clock + (dA / speedKmH) * 60, etaB = clock + (dB / speedKmH) * 60;
      const wStartA = toMin(a.time_window_start), wStartB = toMin(b.time_window_start);
      const wEndA = toMin(a.time_window_end), wEndB = toMin(b.time_window_end);
      const lateA = wEndA != null && etaA > wEndA ? 1000 : 0;
      const lateB = wEndB != null && etaB > wEndB ? 1000 : 0;
      const earlyA = wStartA != null && etaA < wStartA ? (wStartA - etaA) : 0;
      const earlyB = wStartB != null && etaB < wStartB ? (wStartB - etaB) : 0;
      const prioA = (a.priority || 5) * -2, prioB = (b.priority || 5) * -2;
      return (dA + earlyA / 5 + prioA + lateA) - (dB + earlyB / 5 + prioB + lateB);
    });
    const next = remaining.shift();
    const km = haversine(cur, next); totalKm += km;
    clock += (km / speedKmH) * 60;
    const wStart = toMin(next.time_window_start), wEnd = toMin(next.time_window_end);
    if (wStart != null && clock < wStart) clock = wStart;
    if (wEnd != null && clock > wEnd) warnings.push(`${next.pdv_name || 'PDV'} fora da janela (${fmtEta(clock)})`);
    seq.push({ ...next, eta_min: Math.round(clock) });
    clock += Number(next.service_time_min) || 15;
    cur = next;
  }
  return { seq, totalKm, endClock: clock, warnings };
}

// ---------- AUTO-PLAN (preview) ----------
router.post('/auto-plan', async (req, res) => {
  try {
    const org = req.organizationId;
    const { date, order_ids, vehicle_ids, driver_ids, depot_id, start_hour = 8 } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date obrigatório' });

    // depósito
    let depot = null;
    if (depot_id) {
      const d = await query(`SELECT id, name, lat, lng FROM smartroute_depots WHERE id=$1 AND organization_id=$2`, [depot_id, org]);
      depot = d.rows[0];
    }
    if (!depot) {
      const d = await query(`SELECT id, name, lat, lng FROM smartroute_depots WHERE organization_id=$1 AND is_default=true LIMIT 1`, [org]);
      depot = d.rows[0];
    }
    if (!depot || depot.lat == null) return res.status(400).json({ error: 'Depósito sem coordenadas — cadastre um CD com lat/lng.' });

    // pedidos elegíveis (pendentes + geolocalizados)
    const ords = await query(
      `SELECT o.id, o.pdv_id, o.order_number, o.weight_kg, o.volume_m3, o.priority,
              o.time_window_start, o.time_window_end, o.service_time_min,
              p.name AS pdv_name, p.lat, p.lng
         FROM smartroute_orders o
         JOIN smartroute_pdvs p ON p.id = o.pdv_id
        WHERE o.organization_id=$1 AND o.status='pendente'
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          ${order_ids?.length ? `AND o.id = ANY($2::uuid[])` : ''}`,
      order_ids?.length ? [org, order_ids] : [org]
    );
    if (!ords.rows.length) return res.status(400).json({ error: 'Nenhum pedido elegível (pendente + PDV geolocalizado).' });

    // veículos & motoristas
    const vs = await query(
      `SELECT id, plate, model, capacity_kg, capacity_m3, km_per_liter, fuel_price_per_liter
         FROM smartroute_vehicles
        WHERE organization_id=$1 AND is_active=true
          ${vehicle_ids?.length ? `AND id = ANY($2::uuid[])` : ''}
        ORDER BY capacity_kg DESC NULLS LAST`,
      vehicle_ids?.length ? [org, vehicle_ids] : [org]
    );
    if (!vs.rows.length) return res.status(400).json({ error: 'Nenhum veículo disponível.' });

    const drs = await query(
      `SELECT id, full_name FROM smartroute_drivers
        WHERE organization_id=$1 AND is_active=true
          ${driver_ids?.length ? `AND id = ANY($2::uuid[])` : ''}`,
      driver_ids?.length ? [org, driver_ids] : [org]
    );

    const k = Math.min(vs.rows.length, Math.max(1, Math.ceil(ords.rows.length / 20)));
    const chosenVehicles = vs.rows.slice(0, k);
    const clusters = sweepCluster(depot, ords.rows, k);
    const bins = assignByCapacity(clusters, chosenVehicles);

    const plans = bins.filter((b) => b.orders.length).map((b, i) => {
      const { seq, totalKm, endClock, warnings } = sequence(depot, b.orders, start_hour * 60);
      const km = Math.round(totalKm * 10) / 10;
      const kmPerL = Number(b.vehicle.km_per_liter) || null;
      const priceL = Number(b.vehicle.fuel_price_per_liter) || null;
      const fuel = kmPerL ? Math.round((totalKm / kmPerL) * 100) / 100 : null;
      const cost = fuel != null && priceL ? Math.round(fuel * priceL * 100) / 100 : null;
      return {
        cluster_index: i,
        vehicle: b.vehicle,
        driver: drs.rows[i] || null,
        depot,
        stops: seq.map((s, idx) => ({
          sequence: idx + 1,
          order_id: s.id,
          pdv_id: s.pdv_id,
          pdv_name: s.pdv_name,
          order_number: s.order_number,
          lat: s.lat, lng: s.lng,
          weight_kg: Number(s.weight_kg || 0),
          volume_m3: Number(s.volume_m3 || 0),
          eta_min: s.eta_min,
          eta_hhmm: fmtEta(s.eta_min),
        })),
        totals: {
          stops: seq.length,
          weight_kg: Math.round(b.usedKg * 10) / 10,
          volume_m3: Math.round(b.usedM3 * 100) / 100,
          capacity_used_kg_pct: b.capKg === Infinity ? null : Math.round((b.usedKg / b.capKg) * 100),
          capacity_used_m3_pct: b.capM3 === Infinity ? null : Math.round((b.usedM3 / b.capM3) * 100),
          total_km: km,
          duration_min: Math.round(endClock - start_hour * 60),
          fuel_liters: fuel,
          cost_brl: cost,
        },
        warnings,
      };
    });

    const unassigned = ords.rows.length - plans.reduce((a, p) => a + p.stops.length, 0);
    res.json({
      date, depot, generated_at: new Date().toISOString(),
      plans, unassigned,
      summary: {
        routes: plans.length,
        total_stops: plans.reduce((a, p) => a + p.totals.stops, 0),
        total_km: Math.round(plans.reduce((a, p) => a + p.totals.total_km, 0) * 10) / 10,
        total_cost_brl: Math.round(plans.reduce((a, p) => a + (p.totals.cost_brl || 0), 0) * 100) / 100,
      },
    });
  } catch (e) { logError('planner.auto-plan', e); res.status(500).json({ error: e.message }); }
});

// ---------- COMMIT ----------
router.post('/commit', async (req, res) => {
  try {
    const org = req.organizationId;
    const { date, depot_id, plans } = req.body || {};
    if (!date || !Array.isArray(plans) || !plans.length) return res.status(400).json({ error: 'date + plans obrigatórios' });

    const created = [];
    for (const p of plans) {
      const code = `RT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      const r = await query(
        `INSERT INTO smartroute_routes (organization_id, code, driver_id, vehicle_id, planned_date, status,
                                        depot_id, total_stops, total_distance_km, estimated_duration_min,
                                        estimated_fuel_liters, estimated_cost_brl)
         VALUES ($1,$2,$3,$4,$5,'planejada',$6,$7,$8,$9,$10,$11) RETURNING id, code`,
        [org, code, p.driver?.id || null, p.vehicle?.id || null, date, depot_id || p.depot?.id || null,
          p.stops.length, p.totals.total_km, p.totals.duration_min, p.totals.fuel_liters, p.totals.cost_brl]
      );
      const routeId = r.rows[0].id;
      for (const s of p.stops) {
        const st = await query(
          `INSERT INTO smartroute_route_stops (route_id, order_id, pdv_id, sequence, eta_min)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [routeId, s.order_id, s.pdv_id, s.sequence, s.eta_min]
        );
        await query(`UPDATE smartroute_orders SET status='em_rota', route_stop_id=$2, updated_at=NOW() WHERE id=$1`,
          [s.order_id, st.rows[0].id]);
      }
      created.push(r.rows[0]);
    }
    res.json({ ok: true, created });
  } catch (e) { logError('planner.commit', e); res.status(500).json({ error: e.message }); }
});

// ---------- RE-OTIMIZAÇÃO em tempo real ----------
// Mantém paradas concluídas fixas, re-sequencia apenas as pendentes considerando posição atual.
router.post('/routes/:id/reoptimize', async (req, res) => {
  try {
    const org = req.organizationId;
    const r = await query(`SELECT * FROM smartroute_routes WHERE id=$1 AND organization_id=$2`, [req.params.id, org]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });
    const route = r.rows[0];

    const stops = await query(
      `SELECT s.id, s.sequence, s.state, s.pdv_id, p.lat, p.lng, p.name AS pdv_name,
              o.weight_kg, o.volume_m3, o.priority, o.time_window_start, o.time_window_end, o.service_time_min
         FROM smartroute_route_stops s
         LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
         LEFT JOIN smartroute_orders o ON o.id=s.order_id
        WHERE s.route_id=$1 ORDER BY s.sequence`, [req.params.id]);

    const done = stops.rows.filter((s) => ['DONE', 'DONE_CONF', 'FAILED'].includes(s.state));
    const pending = stops.rows.filter((s) => !['DONE', 'DONE_CONF', 'FAILED'].includes(s.state) && s.lat != null && s.lng != null);
    if (!pending.length) return res.json({ ok: true, message: 'Sem paradas pendentes para re-otimizar.', kept: done.length });

    // ponto atual: última parada concluída ou depósito
    const anchor = done.length
      ? done[done.length - 1]
      : { lat: route.depot_lat, lng: route.depot_lng };
    if (anchor.lat == null) return res.status(400).json({ error: 'Sem ponto de partida (depósito ou parada concluída) para re-otimizar.' });

    const now = new Date();
    const startClock = now.getHours() * 60 + now.getMinutes();
    const { seq, totalKm, warnings } = sequence(anchor, pending, startClock);

    let sequenceCounter = done.length;
    for (const s of seq) {
      sequenceCounter++;
      await query(`UPDATE smartroute_route_stops SET sequence=$2, eta_min=$3, updated_at=NOW() WHERE id=$1`,
        [s.id, sequenceCounter, s.eta_min]);
    }
    const kmRounded = Math.round(totalKm * 10) / 10;
    await query(`UPDATE smartroute_routes SET total_distance_km = COALESCE(total_distance_km,0) + 0, updated_at=NOW() WHERE id=$1`, [route.id]);

    res.json({
      ok: true,
      kept_completed: done.length,
      resequenced: seq.length,
      remaining_km: kmRounded,
      warnings,
      reoptimized_from: done.length ? `parada #${done.length}` : 'depósito',
    });
  } catch (e) { logError('planner.reoptimize', e); res.status(500).json({ error: e.message }); }
});

export default router;
