import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePhotoBook } from "@/hooks/use-merch-routes";
import { useBrands } from "@/hooks/use-merchandising";
import { usePDVs } from "@/hooks/use-promotor";
import { resolveMediaUrl } from "@/lib/media";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Camera, Image, Download, Eye, Filter, Calendar, MapPin, Tag, User, ZoomIn } from "lucide-react";

const PHOTO_TYPES: Record<string, string> = {
  checkin: 'Check-in', checkout: 'Check-out', before: 'Antes', after: 'Depois',
  category_before: 'Antes (Categoria)', category_after: 'Depois (Categoria)',
  stock: 'Estoque', shelf: 'Prateleira', extra_point: 'Ponto Extra',
  damage: 'Avaria', expiry: 'Validade', contingency: 'Contingência',
};

export default function MerchBookFotos() {
  const [brandFilter, setBrandFilter] = useState('');
  const [pdvFilter, setPdvFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [viewPhoto, setViewPhoto] = useState<any>(null);

  const { data: brands = [] } = useBrands();
  const { data: pdvs = [] } = usePDVs();
  const { data: photos = [], isLoading } = usePhotoBook({
    brand_id: brandFilter || undefined,
    pdv_id: pdvFilter || undefined,
    date_from: dateFrom, date_to: dateTo,
  });

  // Group by date → PDV → brand
  const grouped = (photos as any[]).reduce((acc: any, p: any) => {
    const date = p.captured_at?.slice(0, 10) || 'sem-data';
    const pdv = p.pdv_name || 'PDV';
    const brand = p.brand_name || 'Marca';
    if (!acc[date]) acc[date] = {};
    if (!acc[date][pdv]) acc[date][pdv] = {};
    if (!acc[date][pdv][brand]) acc[date][pdv][brand] = [];
    acc[date][pdv][brand].push(p);
    return acc;
  }, {} as Record<string, any>);

  const sortedDates = Object.keys(grouped).sort().reverse();

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <Select value={brandFilter || '__all__'} onValueChange={v => setBrandFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as marcas</SelectItem>
                    {brands.filter((b: any) => b?.id).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <Select value={pdvFilter || '__all__'} onValueChange={v => setPdvFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="PDV" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os PDVs</SelectItem>
                    {(pdvs as any[]).filter((p: any) => p?.id).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
              </div>
              <div>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 text-center">
            <Camera className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{photos.length}</div>
            <p className="text-xs text-muted-foreground">Total de fotos</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{sortedDates.length}</div>
            <p className="text-xs text-muted-foreground">Dias com fotos</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <MapPin className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{new Set((photos as any[]).map((p: any) => p.pdv_id)).size}</div>
            <p className="text-xs text-muted-foreground">PDVs</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <User className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{new Set((photos as any[]).map((p: any) => p.promoter_id)).size}</div>
            <p className="text-xs text-muted-foreground">Promotores</p>
          </CardContent></Card>
        </div>

        {/* Photo Grid grouped */}
        {sortedDates.map(date => (
          <div key={date} className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </h2>
            {Object.entries(grouped[date]).map(([pdv, brandGroups]: [string, any]) => (
              <Card key={pdv}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> {pdv}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(brandGroups).map(([brand, bPhotos]: [string, any]) => (
                    <div key={brand}>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{brand}</span>
                        <Badge variant="secondary" className="text-[10px]">{bPhotos.length} fotos</Badge>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {bPhotos.map((photo: any) => {
                          const photoUrl = resolveMediaUrl(photo.photo_url);

                          return (
                          <div key={photo.id} className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border bg-muted"
                            onClick={() => setViewPhoto({ ...photo, photo_url: photoUrl })}>
                            {photoUrl ? (
                              <img src={photoUrl} alt={photo.product_name || photo.category_name || 'Foto de execução'} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Image className="h-6 w-6 text-muted-foreground" /></div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="h-5 w-5 text-white" />
                            </div>
                            <Badge className="absolute bottom-1 left-1 text-[8px] py-0 px-1" variant="secondary">
                              {PHOTO_TYPES[photo.photo_type] || photo.photo_type}
                            </Badge>
                            {photo.upload_source === 'web' && (
                              <Badge className="absolute top-1 right-1 text-[8px] py-0 px-1 bg-orange-500 text-white">WEB</Badge>
                            )}
                          </div>
                        )})}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

        {photos.length === 0 && !isLoading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Camera className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma foto encontrada no período selecionado</p>
          </CardContent></Card>
        )}
      </div>

      {/* Photo Viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Camera className="h-4 w-4" />
              {PHOTO_TYPES[viewPhoto?.photo_type] || viewPhoto?.photo_type} — {viewPhoto?.product_name || viewPhoto?.category_name || 'Geral'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewPhoto?.photo_url && (
              <img src={viewPhoto.photo_url} alt="" className="w-full rounded-lg max-h-[60vh] object-contain bg-muted" />
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Promotor:</span> {viewPhoto?.promoter_name || '—'}</div>
              <div><span className="text-muted-foreground">Data:</span> {viewPhoto?.captured_at ? new Date(viewPhoto.captured_at).toLocaleString('pt-BR') : '—'}</div>
              <div><span className="text-muted-foreground">Produto:</span> {viewPhoto?.product_name || '—'}</div>
              <div><span className="text-muted-foreground">Categoria:</span> {viewPhoto?.category_name || '—'}</div>
              <div><span className="text-muted-foreground">Origem:</span> {viewPhoto?.upload_source === 'web' ? '🖥️ Upload via Web (supervisor)' : '📱 App do promotor'}</div>
              {viewPhoto?.contingency_reason && <div className="col-span-2"><span className="text-muted-foreground">Motivo contingência:</span> {viewPhoto.contingency_reason}</div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
