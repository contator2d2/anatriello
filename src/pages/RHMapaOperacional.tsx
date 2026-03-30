import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRhMapData, useServiceRegions, useCreateRegion, useUpdateRegion, useDeleteRegion, useEmployees, useGeocode } from "@/hooks/use-rh";
import { usePDVs } from "@/hooks/use-promotor";
import { Map, MapPin, Users, Navigation, Layers, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const REGION_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const createMarkerIcon = (color: string, size = 12) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:${size * 2}px;height:${size * 2}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -size],
  });

const PDV_ICON = createMarkerIcon('#3b82f6', 10);
const EMPLOYEE_ICON = createMarkerIcon('#22c55e', 8);
const SUPERVISOR_ICON = createMarkerIcon('#f59e0b', 12);

interface MapViewProps {
  pdvs: any[];
  employees: any[];
  regions: any[];
  showPDVs: boolean;
  showEmployees: boolean;
  showRegions: boolean;
  selectedRegion: string | null;
}

function OperationalMap({ pdvs, employees, regions, showPDVs, showEmployees, showRegions, selectedRegion }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.LayerGroup>(L.layerGroup());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView([-14.235, -51.9253], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(mapRef.current);
    layersRef.current.addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    layersRef.current.clearLayers();
    const bounds: L.LatLng[] = [];

    // Draw regions
    if (showRegions) {
      regions.forEach(r => {
        if (selectedRegion && r.id !== selectedRegion) return;
        const polygon = Array.isArray(r.polygon) ? r.polygon : [];
        if (polygon.length >= 3) {
          const poly = L.polygon(polygon, { color: r.color || '#3b82f6', fillOpacity: 0.15, weight: 2 });
          poly.bindPopup(`<b>${r.name}</b><br/>Supervisor: ${r.supervisor_name || '—'}`);
          layersRef.current.addLayer(poly);
        }
      });
    }

    // Draw PDVs
    if (showPDVs) {
      pdvs.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const pos = L.latLng(Number(p.latitude), Number(p.longitude));
        bounds.push(pos);
        const marker = L.marker(pos, { icon: PDV_ICON });
        marker.bindPopup(`<b>📍 ${p.name}</b><br/>${p.client_name || ''}<br/>${p.address || ''}, ${p.city || ''}-${p.state || ''}<br/>Raio: ${p.radius_meters}m`);
        if (p.radius_meters) {
          L.circle(pos, { radius: p.radius_meters, color: '#3b82f6', fillOpacity: 0.08, weight: 1 }).addTo(layersRef.current);
        }
        layersRef.current.addLayer(marker);
      });
    }

    // Draw employees
    if (showEmployees) {
      employees.forEach(e => {
        if (!e.home_latitude || !e.home_longitude) return;
        const pos = L.latLng(Number(e.home_latitude), Number(e.home_longitude));
        bounds.push(pos);
        const icon = e.worker_profile === 'supervisor' ? SUPERVISOR_ICON : EMPLOYEE_ICON;
        const marker = L.marker(pos, { icon });
        marker.bindPopup(`<b>👤 ${e.full_name}</b><br/>${e.position || e.worker_profile}<br/>${e.city || ''}-${e.state || ''}`);
        layersRef.current.addLayer(marker);
      });
    }

    if (bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }
  }, [pdvs, employees, regions, showPDVs, showEmployees, showRegions, selectedRegion]);

  return <div ref={containerRef} className="w-full h-[500px] rounded-lg border" />;
}

export default function RHMapaOperacional() {
  const { data: mapData, isLoading } = useRhMapData();
  const { data: regionsData = [] } = useServiceRegions();
  const { data: allEmployees = [] } = useEmployees({ status: 'ativo' });
  const createRegion = useCreateRegion();
  const deleteRegion = useDeleteRegion();
  const geocode = useGeocode();
  const { toast } = useToast();

  const [showPDVs, setShowPDVs] = useState(true);
  const [showEmployees, setShowEmployees] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regionDialog, setRegionDialog] = useState(false);
  const [regionForm, setRegionForm] = useState<any>({ name: '', color: '#3b82f6', supervisor_id: '', notes: '', cities: '', states: '' });

  const pdvs = mapData?.pdvs || [];
  const employees = mapData?.employees || [];
  const regions = mapData?.regions || [];

  const supervisors = allEmployees.filter((e: any) => e.worker_profile === 'supervisor' || e.worker_profile === 'administrativo');

  const pdvsWithCoords = pdvs.filter((p: any) => p.latitude && p.longitude).length;
  const empsWithCoords = employees.filter((e: any) => e.home_latitude && e.home_longitude).length;

  const handleCreateRegion = async () => {
    if (!regionForm.name) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    try {
      const citiesArr = regionForm.cities ? regionForm.cities.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
      const statesArr = regionForm.states ? regionForm.states.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean) : [];
      await createRegion.mutateAsync({ ...regionForm, cities: citiesArr, states: statesArr });
      toast({ title: 'Região criada!' });
      setRegionDialog(false);
      setRegionForm({ name: '', color: '#3b82f6', supervisor_id: '', notes: '', cities: '', states: '' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteRegion = async (id: string) => {
    try {
      await deleteRegion.mutateAsync(id);
      toast({ title: 'Região removida' });
      if (selectedRegion === id) setSelectedRegion(null);
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Map className="h-6 w-6 text-primary" /> Mapa Operacional
            </h1>
            <p className="text-sm text-muted-foreground">PDVs, promotores e regiões de atendimento</p>
          </div>
          <Button onClick={() => setRegionDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Região
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-primary">{pdvs.length}</p><p className="text-[10px] text-muted-foreground">PDVs Total</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-primary">{pdvsWithCoords}</p><p className="text-[10px] text-muted-foreground">PDVs no Mapa</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-green-600">{employees.length}</p><p className="text-[10px] text-muted-foreground">Colaboradores</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-green-600">{empsWithCoords}</p><p className="text-[10px] text-muted-foreground">No Mapa</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-accent-foreground">{regions.length}</p><p className="text-[10px] text-muted-foreground">Regiões</p></CardContent></Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Button variant={showPDVs ? 'default' : 'outline'} size="sm" onClick={() => setShowPDVs(!showPDVs)} className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> PDVs ({pdvsWithCoords})
          </Button>
          <Button variant={showEmployees ? 'default' : 'outline'} size="sm" onClick={() => setShowEmployees(!showEmployees)} className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Colaboradores ({empsWithCoords})
          </Button>
          <Button variant={showRegions ? 'default' : 'outline'} size="sm" onClick={() => setShowRegions(!showRegions)} className="gap-1.5 text-xs">
            <Navigation className="h-3.5 w-3.5" /> Regiões ({regions.length})
          </Button>
          {selectedRegion && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedRegion(null)} className="text-xs">
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Map */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <OperationalMap
            pdvs={pdvs}
            employees={employees}
            regions={regions}
            showPDVs={showPDVs}
            showEmployees={showEmployees}
            showRegions={showRegions}
            selectedRegion={selectedRegion}
          />
        )}

        {/* Legend */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-4 items-center text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> PDV</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Colaborador</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Supervisor</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/20 border border-blue-500 inline-block" /> Área de Região</span>
          </CardContent>
        </Card>

        {/* Regions list */}
        {regionsData.length > 0 && (
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Navigation className="h-4 w-4" /> Regiões de Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {regionsData.map((r: any) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedRegion === r.id ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 hover:bg-muted/50'}`}
                  onClick={() => setSelectedRegion(selectedRegion === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: r.color, borderColor: r.color }} />
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Supervisor: {r.supervisor_name || '—'} • {r.pdv_count || 0} PDVs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{r.pdv_count || 0} PDVs</Badge>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteRegion(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* PDVs without coordinates warning */}
        {pdvs.length > pdvsWithCoords && (
          <Card className="border-yellow-200">
            <CardContent className="p-3 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-700">{pdvs.length - pdvsWithCoords} PDVs sem coordenadas</p>
                <p className="text-xs text-muted-foreground">Edite os PDVs para gerar as coordenadas pelo endereço</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Region Dialog */}
      <Dialog open={regionDialog} onOpenChange={setRegionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Região de Atendimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={regionForm.name} onChange={e => setRegionForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Ex: Zona Sul SP" /></div>
            <div><Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {REGION_COLORS.map(c => (
                  <button key={c} onClick={() => setRegionForm((f: any) => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${regionForm.color === c ? 'scale-110 border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div><Label>Supervisor</Label>
              <Select value={regionForm.supervisor_id || '__none__'} onValueChange={v => setRegionForm((f: any) => ({ ...f, supervisor_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar supervisor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {supervisors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cidades (separadas por vírgula)</Label><Input value={regionForm.cities} onChange={e => setRegionForm((f: any) => ({ ...f, cities: e.target.value }))} placeholder="São Paulo, Guarulhos, Osasco" /></div>
            <div><Label>Estados (UFs)</Label><Input value={regionForm.states} onChange={e => setRegionForm((f: any) => ({ ...f, states: e.target.value }))} placeholder="SP, RJ" /></div>
            <div><Label>Observações</Label><Textarea value={regionForm.notes} onChange={e => setRegionForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRegionDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateRegion} disabled={createRegion.isPending}>
              {createRegion.isPending ? 'Criando...' : 'Criar Região'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
