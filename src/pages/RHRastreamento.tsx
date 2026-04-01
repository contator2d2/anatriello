import { useState, useEffect, useRef, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MapPin, Search, Play, Pause, SkipForward, SkipBack, Clock, Navigation, Loader2, Route, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function useTrackableEmployees(date: string) {
  return useQuery({
    queryKey: ['trackable-employees', date],
    queryFn: () => api<any[]>(`/api/promotor/rh/trackable-employees?date=${date}`),
  });
}

function useLocationHistory(employeeId: string | null, date: string) {
  return useQuery({
    queryKey: ['location-history', employeeId, date],
    queryFn: () => api<any>(`/api/promotor/rh/location-history?employee_id=${employeeId}&date=${date}`),
    enabled: !!employeeId,
  });
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RHRastreamento() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);

  const { data: employees = [], isLoading: loadingEmps } = useTrackableEmployees(date);
  const { data: historyData, isLoading: loadingHistory } = useLocationHistory(selectedEmployee, date);

  const points = historyData?.points || [];
  const employee = historyData?.employee;

  const totalDistance = useMemo(() => {
    if (points.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += calcDistance(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
    }
    return d;
  }, [points]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const s = search.toLowerCase();
    return employees.filter((e: any) => e.full_name?.toLowerCase().includes(s));
  }, [employees, search]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-14.235, -51.925], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapInstanceRef.current = map;
    pointsLayerRef.current = L.layerGroup().addTo(map);

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Draw route when points change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null; }
    if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
    if (pointsLayerRef.current) pointsLayerRef.current.clearLayers();

    if (points.length === 0) return;

    const coords: L.LatLngExpression[] = points.map((p: any) => [parseFloat(p.latitude), parseFloat(p.longitude)]);

    // Draw full path
    polylineRef.current = L.polyline(coords, {
      color: 'hsl(var(--primary))',
      weight: 4,
      opacity: 0.8,
      dashArray: '8, 6',
    }).addTo(map);

    // Start marker
    L.circleMarker(coords[0] as L.LatLngExpression, {
      radius: 8, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1,
    }).bindPopup(`<b>Início</b><br>${format(new Date(points[0].recorded_at), "HH:mm:ss", { locale: ptBR })}`).addTo(pointsLayerRef.current!);

    // End marker
    if (coords.length > 1) {
      L.circleMarker(coords[coords.length - 1] as L.LatLngExpression, {
        radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1,
      }).bindPopup(`<b>Último</b><br>${format(new Date(points[points.length - 1].recorded_at), "HH:mm:ss", { locale: ptBR })}`).addTo(pointsLayerRef.current!);
    }

    // Current position marker
    markerRef.current = L.marker(coords[0] as L.LatLngExpression, {
      icon: L.divIcon({
        className: 'tracking-marker',
        html: `<div style="background:hsl(var(--primary));width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map);

    map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [points]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying || points.length === 0) return;
    const interval = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= points.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, points.length, playbackSpeed]);

  // Update marker position on playback
  useEffect(() => {
    if (!markerRef.current || !points[playbackIndex]) return;
    const p = points[playbackIndex];
    markerRef.current.setLatLng([parseFloat(p.latitude), parseFloat(p.longitude)]);
  }, [playbackIndex, points]);

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-card">
            <div className="p-4 space-y-3 border-b border-border">
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Route className="h-5 w-5 text-primary" />
                Rastreamento
              </h1>
              <Input type="date" value={date} onChange={e => { setDate(e.target.value); setSelectedEmployee(null); }} className="text-sm" />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar promotor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm" />
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[200px] lg:max-h-none">
              {loadingEmps ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum registro de rastreamento</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredEmployees.map((emp: any) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedEmployee === emp.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{emp.full_name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{emp.point_count} pontos</span>
                            {emp.first_point && (
                              <>
                                <span>•</span>
                                <span>{format(new Date(emp.first_point), "HH:mm")} - {format(new Date(emp.last_point), "HH:mm")}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Map Area */}
          <div className="flex-1 flex flex-col relative">
            <div ref={mapRef} className="flex-1 min-h-[300px]" />

            {loadingHistory && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1000]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Info overlay */}
            {employee && points.length > 0 && (
              <div className="absolute top-4 left-4 z-[1000]">
                <Card className="shadow-lg">
                  <CardContent className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{employee.full_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {points.length} pontos</span>
                      <span className="flex items-center gap-1"><Navigation className="h-3 w-3" /> {(totalDistance / 1000).toFixed(1)} km</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(points[0].recorded_at), "HH:mm")} - {format(new Date(points[points.length - 1].recorded_at), "HH:mm")}</span>
                    </div>
                    {points[playbackIndex] && (
                      <p className="text-xs text-primary font-medium">
                        🕐 {format(new Date(points[playbackIndex].recorded_at), "HH:mm:ss")}
                        {points[playbackIndex].battery_level != null && ` • 🔋 ${points[playbackIndex].battery_level}%`}
                        {points[playbackIndex].is_moving && ' • 🚶 Em movimento'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Playback controls */}
            {points.length > 1 && (
              <div className="absolute bottom-4 left-4 right-4 z-[1000]">
                <Card className="shadow-lg">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setPlaybackIndex(Math.max(0, playbackIndex - 10))}>
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button variant={isPlaying ? "secondary" : "default"} size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setIsPlaying(!isPlaying)}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setPlaybackIndex(Math.min(points.length - 1, playbackIndex + 10))}>
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <Slider
                          value={[playbackIndex]}
                          max={points.length - 1}
                          step={1}
                          onValueChange={([v]) => setPlaybackIndex(v)}
                          className="cursor-pointer"
                        />
                      </div>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        {playbackIndex + 1}/{points.length}
                      </Badge>
                      <select
                        value={playbackSpeed}
                        onChange={e => setPlaybackSpeed(Number(e.target.value))}
                        className="text-xs bg-muted rounded px-2 py-1 border-none"
                      >
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={5}>5x</option>
                        <option value={10}>10x</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Empty state */}
            {!selectedEmployee && (
              <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
                <Card className="shadow-lg pointer-events-auto">
                  <CardContent className="p-6 text-center">
                    <Route className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Selecione uma data e um promotor para visualizar o rastreamento</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
