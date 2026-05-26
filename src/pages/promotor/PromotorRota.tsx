import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PromotorLayout } from "./PromotorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraCapture, type PhotoQualityConfig } from "@/components/promotor/CameraCapture";
import { FaceVerifyDialog } from "@/components/facial-recognition/FaceVerifyDialog";
import {
  usePromotorRouteDetail, usePromotorCheckin, usePromotorCheckout,
  usePromotorUpdateExecution, usePromotorReportDamage, usePromotorReportRupture,
  usePromotorAddValidity, usePromotorReportDiscard,
  usePromotorSetPointType, usePromotorCategoryPhoto, usePromotorCategoryAfterPhoto,
  usePromotorRegisterExtraPoint,
} from "@/hooks/use-promotor-routes";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, Camera, Check, AlertTriangle, Archive, Clock,
  CheckCircle2, Circle, Calendar as CalendarIcon, Trash2, Store, Info,
  Lock, Unlock, ChevronRight, Target, ImagePlus, Plus, ScanFace, Package,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { logger } from "@/lib/logger";

const EXEC_STATUS_ICON: Record<string, any> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-yellow-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

type ActionType = 'validity' | 'rupture' | 'damage' | 'discard' | null;

// PDV checkout hook
const usePromotorPdvCheckout = () => {
  const promotorApi = async (endpoint: string, options: any = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('promotor_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${endpoint}`;
    const response = await fetch(url, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Erro');
    return data;
  };
  return {
    checkout: (data: any) => promotorApi('/api/merch/promotor/pdv-checkout', { method: 'POST', body: data }),
  };
};

// ===== Category Preparation Component =====
function CategoryPreparation({ category, catId, categoryName, routeId, pdvName, brandName, promotorName, qualityConfig, minPhotos, onUnlocked }: {
  category: any; catId: string; categoryName: string; routeId: string; pdvName: string; brandName: string; promotorName?: string; qualityConfig?: PhotoQualityConfig; minPhotos: number; onUnlocked: () => void;
}) {
  const setPointType = usePromotorSetPointType();
  const setCategoryPhoto = usePromotorCategoryPhoto();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // category may be null/undefined if no merch_execution_categories entry exists yet
  const hasPointType = !!category?.point_type;
  const hasPhoto = !!category?.category_before_photo;
  const isUnlocked = !!category?.products_unlocked;
  const photoCount = photos.length + (hasPhoto ? 1 : 0);
  const min = Math.max(1, minPhotos || 1);

  const handleSetPointType = (type: string) => {
    logger.info(`Promotor tentando selecionar tipo de ponto: ${type}`, { routeId, catId, categoryName });
    setPointType.mutate({ routeId, catId, point_type: type }, {
      onSuccess: () => { 
        toast.success(`Ponto ${type === 'natural' ? 'Natural' : 'Extra'} selecionado`); 
        onUnlocked(); 
      },
      onError: (err: any) => {
        logger.error(`Erro ao selecionar tipo de ponto: ${type}`, { error: err.message, routeId, catId }, err);
        toast.error(`Erro ao selecionar ${type}: ${err.message}`);
      },
    });
  };

  const handleUploadPhoto = async () => {
    if (photos.length < min) return toast.error(`É necessário enviar pelo menos ${min} foto(s) ANTES.`);
    setIsSending(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      ).catch(() => null);

      setCategoryPhoto.mutate({
        routeId, catId, photo_url: photos[0], photos,
        latitude: pos?.coords.latitude, longitude: pos?.coords.longitude,
      }, {
        onSuccess: () => {
          toast.success(`${photos.length} foto(s) registrada(s)! Produtos liberados.`);
          setPhotos([]);
          onUnlocked();
        },
        onError: (err: any) => { toast.error(err.message); setIsSending(false); },
      });
    } catch {
      setIsSending(false);
    }
  };

  const handleAddPhoto = (url: string) => {
    setPhotos(prev => [...prev, url]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  if (isUnlocked) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        {/* Bloco 1: Identification */}
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-primary" />
          <div>
            <span className="font-bold">{categoryName}</span>
            <span className="text-muted-foreground ml-2">• {pdvName} • {brandName}</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${hasPointType ? 'bg-green-500/20 text-green-700' : 'bg-yellow-500/20 text-yellow-700'}`}>
            {hasPointType ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-bold">1</span>}
            Tipo de Ponto
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${(hasPhoto || photos.length > 0) ? 'bg-green-500/20 text-green-700' : hasPointType ? 'bg-yellow-500/20 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
            {(hasPhoto || photos.length > 0) ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-bold">2</span>}
            Foto{photoCount > 1 ? `s (${photoCount})` : ''}
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Lock className="h-3 w-3" />
            Produtos
          </div>
        </div>

        {/* Bloco 2: Point Type */}
        {!hasPointType && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Selecione o tipo de ponto:</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline" className="h-14 flex-col gap-1 border-2 hover:border-primary hover:bg-primary/10"
                onClick={() => handleSetPointType('natural')} disabled={setPointType.isPending}
              >
                <MapPin className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-medium">Ponto Natural</span>
              </Button>
              <Button
                variant="outline" className="h-14 flex-col gap-1 border-2 hover:border-primary hover:bg-primary/10"
                onClick={() => handleSetPointType('extra')} disabled={setPointType.isPending}
              >
                <Target className="h-5 w-5 text-orange-600" />
                <span className="text-xs font-medium">Ponto Extra</span>
              </Button>
            </div>
          </div>
        )}

        {/* Show selected point type */}
        {hasPointType && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">{category?.point_type === 'natural' ? '📍 Ponto Natural' : '🎯 Ponto Extra'}</Badge>
          </div>
        )}

        {/* Bloco 3: Photos (multiple) */}
        {hasPointType && !hasPhoto && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" /> Foto obrigatória da categoria (ANTES da execução)
            </Label>
            <p className="text-[10px] text-muted-foreground">Mínimo {min} foto(s). Você pode tirar fotos adicionais.</p>

            {/* Captured photos grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-20 rounded-lg border object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >✕</button>
                    <div className="absolute bottom-1 left-1 bg-background/80 rounded px-1 text-[9px] font-medium">
                      {i === 0 ? 'Principal' : `Adicional ${i}`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Camera capture for more photos */}
            <CameraCapture
              onCapture={handleAddPhoto}
              watermark={{ pdvName, brandName, promotorName, photoType: `Categoria (antes) ${photos.length + 1}` }}
              customTokenGetter={() => localStorage.getItem('promotor_token')}
              buttonLabel={photos.length === 0 ? 'Tirar foto da categoria' : 'Tirar foto adicional'}
              qualityConfig={qualityConfig}
            />

            {/* Submit button */}
            {photos.length > 0 && (
              <Button className="w-full" onClick={handleUploadPhoto} disabled={isSending || photos.length < min}>
                <ImagePlus className="h-4 w-4 mr-2" />
                {isSending
                  ? 'Enviando...'
                  : photos.length < min
                    ? `Faltam ${min - photos.length} foto(s) para liberar`
                    : `Registrar ${photos.length} foto(s) e liberar produtos`}
              </Button>
            )}
          </div>
        )}

        {/* Lock message */}
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>
            {!hasPointType
              ? 'Antes de iniciar, selecione se é ponto natural ou extra.'
              : photos.length === 0 && !hasPhoto
                ? 'É necessário tirar a foto da categoria antes de acessar os produtos.'
                : 'Registre a(s) foto(s) para liberar os produtos.'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Extra Point Photo Gate (no point type, only photo) =====
function ExtraPointPhotoGate({ catId, categoryName, routeId, pdvName, brandName, promotorName, qualityConfig, onPhotoTaken }: {
  catId: string; categoryName: string; routeId: string; pdvName: string; brandName: string; promotorName?: string; qualityConfig?: PhotoQualityConfig; onPhotoTaken: () => void;
}) {
  const setCategoryPhoto = usePromotorCategoryPhoto();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleUploadPhoto = async () => {
    if (photos.length === 0) return toast.error('É necessário tirar pelo menos 1 foto do ponto extra.');
    setIsSending(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      ).catch(() => null);
      setCategoryPhoto.mutate({
        routeId, catId, photo_url: photos[0],
        latitude: pos?.coords.latitude, longitude: pos?.coords.longitude,
      }, {
        onSuccess: () => { toast.success('Foto do ponto extra registrada! Produtos liberados.'); setPhotos([]); onPhotoTaken(); },
        onError: (err: any) => { toast.error(err.message); setIsSending(false); },
      });
    } catch { setIsSending(false); }
  };

  return (
    <Card className="border-orange-400/40 bg-orange-50/50">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-orange-600" />
          <div>
            <span className="font-bold">{categoryName}</span>
            <span className="text-muted-foreground ml-2">• {pdvName} • {brandName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Ponto Extra
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${photos.length > 0 ? 'bg-green-500/20 text-green-700' : 'bg-yellow-500/20 text-yellow-700'}`}>
            {photos.length > 0 ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-bold">1</span>}
            Foto{photos.length > 1 ? `s (${photos.length})` : ''}
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Lock className="h-3 w-3" /> Produtos
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" /> Foto do Ponto Extra (obrigatória)
          </Label>
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="w-20 h-20 rounded-lg object-cover border" />
                  <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <CameraCapture
            onCapture={(url: string) => setPhotos(prev => [...prev, url])}
            watermark={{ pdvName, brandName, photoType: 'Ponto Extra' }}
            customTokenGetter={() => localStorage.getItem('promotor_token')}
            buttonLabel={photos.length > 0 ? 'Tirar mais uma foto' : 'Tirar foto do ponto extra'}
            qualityConfig={qualityConfig}
          />
        </div>

        {photos.length > 0 && (
          <Button className="w-full" onClick={handleUploadPhoto} disabled={isSending || setCategoryPhoto.isPending}>
            <Camera className="h-4 w-4 mr-2" /> {isSending ? 'Enviando...' : 'Confirmar e Liberar Produtos'}
          </Button>
        )}

        <div className="flex items-center gap-2 p-2 rounded-md bg-orange-100/50 text-orange-800 text-[11px]">
          <Camera className="h-4 w-4 flex-shrink-0" />
          <span>Tire a foto do ponto extra antes de acessar os produtos.</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Category After Photo Gate (required to close/complete category) =====
function CategoryAfterPhotoGate({ catId, categoryName, routeId, pdvName, brandName, promotorName, qualityConfig, minPhotos, onCompleted }: {
  catId: string; categoryName: string; routeId: string; pdvName: string; brandName: string; promotorName?: string; qualityConfig?: PhotoQualityConfig; minPhotos: number; onCompleted: () => void;
}) {
  const setCategoryAfterPhoto = usePromotorCategoryAfterPhoto();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const min = Math.max(1, minPhotos || 1);

  const handleUpload = async () => {
    if (photos.length < min) return toast.error(`É necessário enviar pelo menos ${min} foto(s) DEPOIS.`);
    setIsSending(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      ).catch(() => null);
      setCategoryAfterPhoto.mutate({
        routeId, catId, photo_url: photos[0], photos,
        latitude: pos?.coords.latitude, longitude: pos?.coords.longitude,
      }, {
        onSuccess: () => { toast.success(`${photos.length} foto(s) DEPOIS registrada(s)! Categoria concluída.`); setPhotos([]); onCompleted(); },
        onError: (err: any) => { toast.error(err.message); setIsSending(false); },
      });
    } catch { setIsSending(false); }
  };

  return (
    <Card className="border-green-500/40 bg-green-50/50 mt-2">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Camera className="h-4 w-4 text-green-600" />
          <div>
            <span className="font-bold">{categoryName}</span>
            <Badge variant="secondary" className="ml-2 text-[9px] bg-green-100 text-green-700">Foto DEPOIS</Badge>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Tire pelo menos <b>{min}</b> foto(s) da categoria <b>DEPOIS</b> da execução para concluir.
        </p>

        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p} alt="" className="w-20 h-20 rounded-lg object-cover border" />
                <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                  onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}

        <CameraCapture
          onCapture={(url: string) => setPhotos(prev => [...prev, url])}
          watermark={{ pdvName, brandName, promotorName, photoType: `Categoria (depois)` }}
          customTokenGetter={() => localStorage.getItem('promotor_token')}
          buttonLabel={photos.length > 0 ? 'Tirar mais uma foto' : 'Tirar foto DEPOIS'}
          qualityConfig={qualityConfig}
        />

        {photos.length > 0 && (
          <Button className="w-full" onClick={handleUpload} disabled={isSending || setCategoryAfterPhoto.isPending || photos.length < min}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isSending
              ? 'Enviando...'
              : photos.length < min
                ? `Faltam ${min - photos.length} foto(s) DEPOIS`
                : `Registrar ${photos.length} foto(s) e concluir categoria`}
          </Button>
        )}

        <div className="flex items-center gap-2 p-2 rounded-md bg-green-100/50 text-green-800 text-[11px]">
          <Camera className="h-4 w-4 flex-shrink-0" />
          <span>Foto DEPOIS obrigatória para concluir esta categoria.</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PromotorRota() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: route, isLoading, refetch } = usePromotorRouteDetail(id);
  const checkin = usePromotorCheckin();
  const checkout = usePromotorCheckout();
  const updateExec = usePromotorUpdateExecution();
  const reportDamage = usePromotorReportDamage();
  const reportRupture = usePromotorReportRupture();
  const addValidity = usePromotorAddValidity();
  const reportDiscard = usePromotorReportDiscard();
  const pdvCheckout = usePromotorPdvCheckout();
  const registerExtraPoint = usePromotorRegisterExtraPoint();
  const [photoQualityConfig, setPhotoQualityConfig] = useState<PhotoQualityConfig | undefined>();
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);

  // Load photo quality config
  useEffect(() => {
    const url = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/merchandising/photo-quality-config`;
    const token = localStorage.getItem('promotor_token');
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => { if (!r.ok) throw new Error('not ok'); return r.json(); })
      .then(d => { if (d?.config) setPhotoQualityConfig(d.config); })
      .catch(() => { /* use defaults */ });
  }, []);

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [selectedExec, setSelectedExec] = useState<any>(null);
  const [actionForm, setActionForm] = useState<any>({});
  const [showCompleteRoute, setShowCompleteRoute] = useState(false);
  const [showPdvCheckout, setShowPdvCheckout] = useState(false);
  const [pdvCheckoutPhoto, setPdvCheckoutPhoto] = useState('');
  const [checkinPhotoUrl, setCheckinPhotoUrl] = useState('');
  const [routeCompletionResult, setRouteCompletionResult] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showExtraPointDialog, setShowExtraPointDialog] = useState<{ catId: string; categoryName: string } | null>(null);
  const [selectedExtraProducts, setSelectedExtraProducts] = useState<string[]>([]);
  const [showExtraPointCategoryPicker, setShowExtraPointCategoryPicker] = useState(false);
  const [extraGroupPhotos, setExtraGroupPhotos] = useState<Record<string, boolean>>({});
  const [showFaceVerify, setShowFaceVerify] = useState(false);
  const [faceVerifyAction, setFaceVerifyAction] = useState<'checkin' | 'checkout' | 'pdv_checkout' | null>(null);

  // Facial config
  const promotorToken = localStorage.getItem('promotor_token');
  const { data: facialConfig } = useQuery({
    queryKey: ['promotor-facial-config'],
    queryFn: async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (promotorToken) headers['Authorization'] = `Bearer ${promotorToken}`;
      const url = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/promotor/facial-config`;
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 300000,
  });
  const isFacialActiveCheckin = facialConfig?.enabled && 
    facialConfig?.use_for_checkin && 
    facialConfig?.has_enrollment && 
    facialConfig?.verification_enabled !== false;

  // Multi-brand support
  const isMultiBrand = route?.is_multi_brand && route?.route_brands?.length > 1;
  const routeBrands = route?.route_brands || [];
  const currentBrand = useMemo(() => routeBrands.find((rb: any) => rb.brand_id === activeBrandId), [routeBrands, activeBrandId]);


  useEffect(() => {
    if (route && !isMultiBrand && !activeBrandId) {
      setActiveBrandId(route.brand_id);
    }
  }, [route, isMultiBrand, activeBrandId]);

  // Timer to keep current time updated for min duration check
  useEffect(() => {
    if (route?.status === 'in_progress') {
      const timer = setInterval(() => setCurrentTime(new Date()), 10000);
      return () => clearInterval(timer);
    }
  }, [route?.status]);

  // Build category status map - filter by active brand if multi-brand
  const categoryStatusMap = useMemo(() => {
    const map: Record<string, any> = {};
    (route?.category_statuses || []).forEach((cs: any) => {
      // If multi-brand, only show categories for active brand
      if (isMultiBrand && activeBrandId && cs.route_brand_id) {
        const rb = routeBrands.find((b: any) => b.id === cs.route_brand_id);
        if (rb?.brand_id !== activeBrandId) return;
      }
      map[cs.category_id] = cs;
    });
    return map;
  }, [route?.category_statuses, isMultiBrand, activeBrandId, routeBrands]);

  const requireStockCount = useMemo(() => (isMultiBrand ? currentBrand?.require_stock_count : route?.require_stock_count) ?? false, [isMultiBrand, currentBrand, route]);
  const requireValidityCheck = useMemo(() => (isMultiBrand ? currentBrand?.require_validity_check : route?.require_validity_check) ?? false, [isMultiBrand, currentBrand, route]);
  const canQuickCheck = !requireStockCount && !requireValidityCheck;




  // Filter executions by active brand
  const filteredExecs = useMemo(() => {
    if (!route?.executions) return [];
    if (!isMultiBrand || !activeBrandId) return route.executions;
    return route.executions.filter((e: any) => {
      if (e.route_brand_id) {
        const rb = routeBrands.find((b: any) => b.id === e.route_brand_id);
        return rb?.brand_id === activeBrandId;
      }
      return e.brand_id === activeBrandId;
    });
  }, [route?.executions, isMultiBrand, activeBrandId, routeBrands]);

  const groupedExecs = useMemo(() => {
    const groups: Record<string, { catId: string; execs: any[]; isExtraGroup?: boolean }> = {};
    filteredExecs.forEach((e: any) => {
      const baseCat = e.category_name || 'Sem Categoria';
      if (e.exposure_point === 'extra') {
        const extraKey = `${baseCat} (Ponto Extra)`;
        if (!groups[extraKey]) groups[extraKey] = { catId: e.category_id, execs: [], isExtraGroup: true };
        groups[extraKey].execs.push(e);
      } else {
        if (!groups[baseCat]) groups[baseCat] = { catId: e.category_id, execs: [] };
        groups[baseCat].execs.push(e);
      }
    });
    return groups;
  }, [filteredExecs]);

  const handleCheckin = useCallback(async () => {
    if (!id) return;
    if (route?.require_checkin_photo && !checkinPhotoUrl) {
      toast.error('Esta rota exige foto obrigatória no check-in');
      return;
    }
    if (isFacialActiveCheckin && faceVerifyAction !== 'checkin') {
      setFaceVerifyAction('checkin');
      setShowFaceVerify(true);
      return;
    }
    setFaceVerifyAction(null);
    try {
      logger.info('[handleCheckin] Iniciando check-in da rota', { routeId: id, pdvName: route?.pdv_name });
      
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('GPS não suportado pelo seu navegador.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, 
          timeout: 10000,
          maximumAge: 0
        });
      }).catch(err => {
        logger.error('[handleCheckin] Erro de GPS no check-in', { err, routeId: id });
        if (err.code === 1) throw new Error('Permissão de GPS negada. Por favor, autorize o acesso à localização.');
        if (err.code === 2) throw new Error('Posição indisponível. Verifique se o GPS está ativado.');
        if (err.code === 3) throw new Error('Tempo limite do GPS esgotado. Tente novamente em um local mais aberto.');
        throw new Error('Erro ao obter localização: ' + (err.message || 'GPS indisponível.'));
      });

      logger.info('[handleCheckin] Localização obtida para check-in', { 
        routeId: id, 
        lat: pos.coords.latitude, 
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy 
      });

      checkin.mutate({
        id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        device: navigator.userAgent || 'Unknown Device',
        photo_url: checkinPhotoUrl || undefined,
        facial_verified: isFacialActiveCheckin || undefined,
        // Garante que o ID da rota seja enviado no corpo se necessário, embora usePromotorCheckin use na URL
        routeId: id,
      }, {
        onSuccess: () => {
          logger.info('[handleCheckin] Check-in realizado com sucesso', { routeId: id });
          toast.success('Check-in realizado!');
          refetch(); // Força atualização dos dados da rota
        },
        onError: (err: any) => {
          logger.error('[handleCheckin] Erro na API de check-in', { 
            error: err.message, 
            status: err.status,
            routeId: id 
          });
          toast.error('Erro no servidor ao fazer check-in: ' + (err.message || 'Erro desconhecido'));
        },
      });
    } catch (err: any) {
      logger.error('[handleCheckin] Erro fatal no check-in', { message: err.message, routeId: id }, err);
      toast.error(err.message || 'Não foi possível realizar o check-in');
    }
  }, [id, checkin, route?.require_checkin_photo, checkinPhotoUrl, isFacialActiveCheckin, faceVerifyAction, route?.pdv_name]);

  const handleCompleteRoute = useCallback(() => {
    if (!id) return;
    if (isFacialActiveCheckin && faceVerifyAction !== 'checkout') {
      setFaceVerifyAction('checkout');
      setShowFaceVerify(true);
      return;
    }
    setFaceVerifyAction(null);
    checkout.mutate({ id, notes: actionForm.notes }, {
      onSuccess: (data: any) => {
        toast.success('Rota finalizada!');
        setShowCompleteRoute(false);
        if (data.can_checkout_pdv) {
          setRouteCompletionResult(data);
          setShowPdvCheckout(true);
        } else {
          toast.info(data.pdv_checkout_message || `Ainda existem ${data.remaining_routes_at_pdv} rota(s) neste PDV.`);
          navigate('/promotor/home');
        }
      },
      onError: (err: any) => toast.error(err.message),
    });
  }, [id, checkout, actionForm, navigate, isFacialActiveCheckin, faceVerifyAction]);

  const handlePdvCheckout = useCallback(async () => {
    if (!route?.pdv_id) return;
    if (isFacialActiveCheckin && faceVerifyAction !== 'pdv_checkout') {
      setFaceVerifyAction('pdv_checkout');
      setShowFaceVerify(true);
      return;
    }
    setFaceVerifyAction(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      await pdvCheckout.checkout({
        pdv_id: route.pdv_id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        photo_url: pdvCheckoutPhoto || undefined,
        status_override: !pdvCheckoutPhoto ? 'awaiting_photo' : 'completed',
        notes: actionForm.pdv_notes,
      });
      toast.success('Checkout do PDV realizado!');
      setShowPdvCheckout(false);
      navigate('/promotor/home');
    } catch (err: any) {
      toast.error(err.message || 'Erro no checkout do PDV');
    }
  }, [route?.pdv_id, pdvCheckout, pdvCheckoutPhoto, actionForm, navigate]);

  const handleOpenProduct = useCallback((exec: any) => {
    const catStatus = categoryStatusMap[exec.category_id];
    const requireCategoryPhotos = route?.require_category_photos !== false;
    
    if (requireCategoryPhotos && !catStatus?.products_unlocked) {
      toast.error('Finalize a etapa de preparação da categoria antes de executar produtos.');
      return;
    }
    setSelectedExec(exec);
    setActionForm({ qty_store: exec.qty_store || 0, qty_stock: exec.qty_stock || 0 });
    setActiveAction(null);
  }, [categoryStatusMap]);

  if (isLoading) return <PromotorLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div></PromotorLayout>;
  if (!route) return <PromotorLayout><div className="text-center py-12 text-muted-foreground">Rota não encontrada</div></PromotorLayout>;

  const needsCheckin = route.status === 'scheduled' || route.status === 'confirmed';
  const isActive = route.status === 'in_progress';
  const isCompleted = route.status === 'completed';

  // Multi-brand: show brand selection screen after check-in
  const showBrandSelector = isMultiBrand && isActive && !activeBrandId;

  return (
    <PromotorLayout>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Route header card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="font-bold text-lg">{route.pdv_name}</h2>
                {isMultiBrand ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-primary/20 text-primary text-[10px]">🏷️ Multi-marca</Badge>
                    <span className="text-xs text-muted-foreground">{routeBrands.length} marcas</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{route.brand_name}</p>
                )}
                {!isMultiBrand && route.checklist_name && <p className="text-xs text-muted-foreground mt-1">Checklist: {route.checklist_name}</p>}
              </div>
              <Badge className={route.status === 'in_progress' ? 'bg-orange-500/20 text-orange-700' : route.status === 'completed' ? 'bg-green-500/20 text-green-700' : 'bg-blue-500/20 text-blue-700'}>
                {route.status === 'in_progress' ? 'Em Andamento' : route.status === 'completed' ? 'Concluída' : 'Agendada'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{route.pdv_address || route.pdv_city}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{route.scheduled_time?.slice(0, 5)}</span>
            </div>
            {isActive && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Progresso Geral</span>
                  <span className="font-mono font-bold">{Math.round(route.progress_pct || 0)}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${route.progress_pct || 0}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multi-brand progress overview (always visible when multi-brand & active) */}
        {isMultiBrand && isActive && (
          <div className="space-y-1.5">
            {routeBrands.map((rb: any) => {
              const isSelected = activeBrandId === rb.brand_id;
              return (
                <Card key={rb.brand_id}
                  className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/40'} ${rb.status === 'completed' ? 'bg-green-500/5' : ''}`}
                  onClick={() => setActiveBrandId(rb.brand_id)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rb.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : rb.status === 'in_progress' ? (
                          <Clock className="h-5 w-5 text-orange-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="text-sm font-semibold">{rb.brand_name}</div>
                          {rb.checklist_name && <div className="text-[10px] text-muted-foreground">{rb.checklist_name}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold">{Math.round(rb.progress_pct || 0)}%</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                      <div className={`h-full rounded-full transition-all ${rb.status === 'completed' ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${rb.progress_pct || 0}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Brand selector prompt */}
        {showBrandSelector && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <Store className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium mb-1">Selecione uma marca para iniciar</p>
              <p className="text-[10px] text-muted-foreground mb-3">
                Escolha por qual marca deseja começar. Você poderá alternar entre elas a qualquer momento.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Active brand indicator */}
        {isMultiBrand && activeBrandId && isActive && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium">{currentBrand?.brand_name || 'Marca'}</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveBrandId(null)}>
              Trocar marca
            </Button>
          </div>
        )}

        {/* Check-in photo requirement */}
        {needsCheckin && route.require_checkin_photo && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Camera className="h-4 w-4 text-primary" />
                Foto obrigatória para check-in
              </div>
              {checkinPhotoUrl ? (
                <div className="space-y-2">
                  <img src={checkinPhotoUrl} alt="Check-in" className="w-full rounded-lg border max-h-48 object-cover" />
                  <Button variant="outline" size="sm" onClick={() => setCheckinPhotoUrl('')}>Tirar outra foto</Button>
                </div>
              ) : (
                <CameraCapture
                  onCapture={setCheckinPhotoUrl}
                  watermark={{ pdvName: route.pdv_name, brandName: route.brand_name, photoType: 'Check-in' }}
                  customTokenGetter={() => localStorage.getItem('promotor_token')}
                  buttonLabel="Tirar foto de check-in"
                  qualityConfig={photoQualityConfig}
                />
              )}
            </CardContent>
          </Card>
        )}

        {needsCheckin && isFacialActiveCheckin && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg text-xs text-primary">
            <ScanFace className="h-4 w-4" />
            <span className="font-medium">Verificação facial obrigatória para check-in</span>
          </div>
        )}

        {needsCheckin && (
          <Button className="w-full h-14 text-lg" onClick={handleCheckin} disabled={checkin.isPending || (route.require_checkin_photo && !checkinPhotoUrl)}>
            {isFacialActiveCheckin ? <ScanFace className="h-5 w-5 mr-2" /> : <MapPin className="h-5 w-5 mr-2" />}
            {checkin.isPending ? 'Realizando check-in...' : route.require_checkin_photo ? 'Enviar foto e fazer check-in' : 'Fazer Check-in'}
          </Button>
        )}

        {isActive && filteredExecs.length === 0 && activeBrandId && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum produto foi carregado para esta {isMultiBrand ? 'marca' : 'rota'}.
            </CardContent>
          </Card>
        )}

        {/* Active route: categories with step-by-step flow */}
        {isActive && (!isMultiBrand || activeBrandId) && (
          <div className="space-y-4">
            {Object.entries(groupedExecs).map(([category, { catId, execs, isExtraGroup }]) => {
              const catStatus = categoryStatusMap[catId];
              // For extra groups: need photo but NOT point type
              const requireCategoryPhotos = route?.require_category_photos !== false;
              const extraPhotoKey = `extra_${catId}`;
              const hasExtraPhoto = extraGroupPhotos[extraPhotoKey];
              const isLocked = requireCategoryPhotos ? (isExtraGroup ? !hasExtraPhoto : !catStatus?.products_unlocked) : false;
              const doneCount = execs.filter((e: any) => e.status === 'completed').length;
              const allProductsDone = doneCount === execs.length && execs.length > 0;
              const hasAfterPhoto = !!catStatus?.category_after_photo || !!catStatus?.completed;
              // Show after photo gate when all products done but no after photo yet
              const needsAfterPhoto = requireCategoryPhotos && allProductsDone && !isLocked && !hasAfterPhoto;

              return (

                <div key={category}>
                  {/* Category preparation for normal groups */}
                  {isLocked && !isExtraGroup && (
                    <CategoryPreparation
                      category={catStatus}
                      catId={catId}
                      categoryName={category}
                      routeId={id!}
                      pdvName={route.pdv_name}
                      brandName={currentBrand?.brand_name || route.brand_name}
                      promotorName={route.promotor_name}
                      qualityConfig={photoQualityConfig}
                      minPhotos={Math.max(1, parseInt((route as any)?.min_category_photos_before, 10) || 1)}
                      onUnlocked={() => refetch()}
                    />
                  )}

                  {/* Extra group: only needs photo, no point type */}
                  {isExtraGroup && !hasExtraPhoto && (
                    <ExtraPointPhotoGate
                      catId={catId}
                      categoryName={category}
                      routeId={id!}
                      pdvName={route.pdv_name}
                      brandName={currentBrand?.brand_name || route.brand_name}
                      promotorName={route.promotor_name}
                      qualityConfig={photoQualityConfig}
                      onPhotoTaken={() => setExtraGroupPhotos(prev => ({ ...prev, [extraPhotoKey]: true }))}
                    />
                  )}

                  {/* Category header */}
                  <div className="flex items-center justify-between mb-2 mt-3">
                    <div className="flex items-center gap-2">
                      {hasAfterPhoto ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : isExtraGroup ? <Target className="h-4 w-4 text-orange-600" /> : (requireCategoryPhotos && isLocked) ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-green-600" />}
                      <h3 className="text-sm font-bold">{category}</h3>
                      {hasAfterPhoto && (
                        <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700">✅ Concluída</Badge>
                      )}
                      {isExtraGroup && !hasAfterPhoto ? (
                        <Badge variant="secondary" className="text-[9px] bg-orange-100 text-orange-700 border-orange-300">🎯 Extra</Badge>
                      ) : !hasAfterPhoto && catStatus?.point_type && (
                        <Badge variant="outline" className="text-[9px]">
                          {catStatus.point_type === 'natural' ? '📍 Natural' : '🎯 Extra'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canQuickCheck && !allProductsDone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                          onClick={async () => {
                            if (!window.confirm(`Deseja marcar todos os ${execs.length - doneCount} produto(s) desta categoria como concluídos?`)) return;
                            try {
                              for (const exec of execs) {
                                if (exec.status !== 'completed') {
                                  await updateExec.mutateAsync({
                                    id: exec.id,
                                    status: 'completed',
                                    checked: true,
                                    qty_store: 0,
                                    qty_stock: 0
                                  });
                                }
                              }
                              toast.success('Todos os produtos marcados como concluídos!');
                              refetch();
                            } catch (err: any) {
                              toast.error('Erro ao concluir produtos: ' + err.message);
                            }
                          }}
                          disabled={updateExec.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar todos
                        </Button>
                      )}
                      <Badge variant="outline" className="text-[10px]">{doneCount}/{execs.length}</Badge>
                    </div>
                  </div>

                  {/* Products list (locked or unlocked) */}
                  <div className={`space-y-1.5 ${isLocked ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                    {execs.map((exec: any) => (
                      <Card key={exec.id} className={`transition-colors hover:border-primary/40 ${exec.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : ''}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 cursor-pointer" onClick={() => {
                              if (canQuickCheck) {
                                updateExec.mutate({
                                  id: exec.id,
                                  status: exec.status === 'completed' ? 'pending' : 'completed',
                                  checked: exec.status !== 'completed',
                                  qty_store: 0,
                                  qty_stock: 0
                                }, {
                                  onSuccess: () => toast.success(exec.status === 'completed' ? 'Produto desmarcado' : 'Produto concluído!'),
                                  onError: (err: any) => toast.error(err.message)
                                });
                              } else {
                                handleOpenProduct(exec);
                              }
                            }}>
                              {EXEC_STATUS_ICON[exec.status] || EXEC_STATUS_ICON.pending}
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenProduct(exec)}>
                              <div className="text-sm font-medium truncate">{exec.product_name}</div>
                              {exec.exposure_point !== 'natural' && <Badge variant="secondary" className="text-[9px] mt-0.5">{exec.exposure_point}</Badge>}
                              {requireStockCount && (exec.qty_store > 0 || exec.qty_stock > 0) && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Loja: {exec.qty_store} | Estoque: {exec.qty_stock} | Total: {exec.qty_total}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleOpenProduct(exec)}>
                              {exec.has_rupture && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                              {exec.has_damage && <Archive className="h-3.5 w-3.5 text-orange-500" />}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* After Photo Gate - shown when all products done but category not yet completed */}
                  {needsAfterPhoto && (
                    <CategoryAfterPhotoGate
                      catId={catId}
                      categoryName={category}
                      routeId={id!}
                      pdvName={route.pdv_name}
                      brandName={currentBrand?.brand_name || route.brand_name}
                      promotorName={route.promotor_name}
                      qualityConfig={photoQualityConfig}
                      minPhotos={Math.max(1, parseInt((route as any)?.min_category_photos_after, 10) || 1)}
                      onCompleted={() => refetch()}
                    />
                  )}
                </div>
              );
            })}

            {/* Complete Route button */}
            {(() => {
              const totalExecs = filteredExecs.length;
              const completedExecs = filteredExecs.filter((e: any) => e.status === 'completed').length;
              const allProductsDone = totalExecs > 0 && completedExecs === totalExecs;
              const requireCategoryPhotos = route?.require_category_photos !== false;
              
              const categoryEntries = Object.entries(groupedExecs);
              const categoriesMissingAfterPhoto = requireCategoryPhotos ? categoryEntries.filter(([, { catId, execs }]) => {
                const catStatus = categoryStatusMap[catId];
                const catDone = execs.every((e: any) => e.status === 'completed');
                return catDone && !catStatus?.category_after_photo && !catStatus?.completed;
              }) : [];
              const allCategoriesCompleted = categoriesMissingAfterPhoto.length === 0;
              
              const minDuration = parseInt(route?.min_duration_minutes || "0", 10);
              const checkinAt = route?.checkin_at ? new Date(route.checkin_at) : null;
              const elapsedMinutes = checkinAt ? Math.floor((currentTime.getTime() - checkinAt.getTime()) / 60000) : 0;
              const hasMinDurationMet = minDuration === 0 || elapsedMinutes >= minDuration;
              
              const allDone = allProductsDone && allCategoriesCompleted && hasMinDurationMet;
              
              return (
                <>
                  <Button className="w-full h-12" onClick={() => {
                    if (!allProductsDone) {
                      toast.error(`Ainda faltam ${totalExecs - completedExecs} produto(s) para concluir. Todos devem estar 100% executados.`);
                      return;
                    }
                    if (!allCategoriesCompleted) {
                      toast.error(`${categoriesMissingAfterPhoto.length} categoria(s) ainda precisam da foto DEPOIS para serem concluídas.`);
                      return;
                    }
                    if (!hasMinDurationMet) {
                      toast.error(`Tempo mínimo de permanência não atingido. Faltam ${minDuration - elapsedMinutes} minuto(s).`);
                      return;
                    }
                    setShowCompleteRoute(true);
                  }} disabled={checkout.isPending} variant={allDone ? 'default' : 'secondary'}>
                    <Check className="h-5 w-5 mr-2" /> Concluir Rota ({completedExecs}/{totalExecs})
                  </Button>
                  {!allDone && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-center text-destructive">
                        ⚠️ {!allProductsDone 
                          ? 'Todos os produtos devem estar executados (100%) para concluir a rota.'
                          : !allCategoriesCompleted 
                            ? 'Tire a foto DEPOIS de todas as categorias para concluir a rota.'
                            : `Tempo mínimo: faltam ${minDuration - elapsedMinutes} min.`}
                      </p>
                      {allProductsDone && allCategoriesCompleted && !hasMinDurationMet && (
                        <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" /> Tempo mínimo de permanência: {minDuration} min
                        </p>
                      )}
                    </div>
                  )}
                    </>
                  );
                })()}



            {/* Extra Point button */}
            <Button variant="outline" className="w-full h-10 border-dashed border-orange-400/50 text-orange-600 hover:bg-orange-50"
              onClick={() => {
                const cats = Object.entries(groupedExecs).filter(([, v]) => !v.isExtraGroup);
                if (cats.length === 1) {
                  setShowExtraPointDialog({ catId: cats[0][1].catId, categoryName: cats[0][0] });
                  setSelectedExtraProducts([]);
                } else {
                  setShowExtraPointCategoryPicker(true);
                }
              }}>
              <Target className="h-4 w-4 mr-2" /> Registrar Ponto Extra
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              <Info className="h-3 w-3 inline mr-1" />
              {isMultiBrand
                ? 'Concluir a rota finaliza todas as marcas. O checkout da loja só será feito na última rota do PDV.'
                : 'Concluir a rota finaliza o checklist desta marca. O checkout da loja só será feito na última rota do PDV.'}
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-700">Rota concluída</p>
            <p className="text-xs text-muted-foreground">
              {route.checkin_at && `Check-in: ${new Date(route.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              {route.checkout_at && ` • Checkout: ${new Date(route.checkout_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
            {(!route.checkout_at) && (
              <Button className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold" onClick={() => setShowPdvCheckout(true)}>
                <Store className="h-4 w-4 mr-2" /> Fazer Checkout da Loja (Pendente)
              </Button>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/promotor/home')}>
              Voltar para Início
            </Button>
          </div>
        )}

        {/* Product Detail Modal */}
        <Dialog open={!!selectedExec && !activeAction} onOpenChange={() => setSelectedExec(null)}>
          <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                {EXEC_STATUS_ICON[selectedExec?.status] || EXEC_STATUS_ICON.pending}
                {selectedExec?.product_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={selectedExec?.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                  {selectedExec?.status === 'completed' ? 'Executado' : selectedExec?.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                </Badge>
                {selectedExec?.exposure_point && selectedExec.exposure_point !== 'natural' && (
                  <Badge variant="outline" className="text-[10px]">{selectedExec.exposure_point}</Badge>
                )}
              </div>

              {/* Counting */}
              {requireStockCount && (

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Store className="h-3.5 w-3.5" /> Contagem
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qtd Loja</Label>
                      <Input type="number" min="0" placeholder="0"
                        value={actionForm.qty_store ?? selectedExec?.qty_store ?? 0}
                        onChange={e => setActionForm({ ...actionForm, qty_store: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qtd Estoque</Label>
                      <Input type="number" min="0" placeholder="0"
                        value={actionForm.qty_stock ?? selectedExec?.qty_stock ?? 0}
                        onChange={e => setActionForm({ ...actionForm, qty_stock: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right">
                    Total: {(actionForm.qty_store ?? selectedExec?.qty_store ?? 0) + (actionForm.qty_stock ?? selectedExec?.qty_stock ?? 0)}
                  </div>
                </div>
              )}


              {/* Observation */}
              <div>
                <Label className="text-[10px] text-muted-foreground">Observação</Label>
                <Textarea rows={2} placeholder="Observação do produto..."
                  value={actionForm.product_observation ?? selectedExec?.observation ?? ''}
                  onChange={e => setActionForm({ ...actionForm, product_observation: e.target.value })} />
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Registrar ocorrência</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'validity', label: 'Validade', icon: CalendarIcon, color: 'text-blue-600', show: requireValidityCheck },
                    { key: 'rupture', label: 'Ruptura', icon: AlertTriangle, color: 'text-red-600', show: true },
                    { key: 'damage', label: 'Avaria', icon: Archive, color: 'text-orange-600', show: true },
                    { key: 'discard', label: 'Descarte', icon: Trash2, color: 'text-purple-600', show: true },
                  ].filter(a => a.show).map(a => (
                    <Button key={a.key} variant="outline" className="h-12 flex-col gap-0.5 text-[10px]"
                      onClick={() => setActiveAction(a.key as ActionType)}>
                      <a.icon className={`h-4 w-4 ${a.color}`} />
                      <span>{a.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedExec(null)}>Fechar</Button>
              <Button size="sm" onClick={() => {
                if (!selectedExec) return;
                updateExec.mutate({
                  id: selectedExec.id,
                  qty_store: actionForm.qty_store ?? selectedExec.qty_store ?? 0,
                  qty_stock: actionForm.qty_stock ?? selectedExec.qty_stock ?? 0,
                  observation: actionForm.product_observation ?? selectedExec.observation,
                  status: 'completed', checked: true,
                }, {
                  onSuccess: () => { toast.success('Produto executado!'); setSelectedExec(null); },
                  onError: (err: any) => toast.error(err.message),
                });
              }} disabled={updateExec.isPending}>
                <Check className="h-4 w-4 mr-1" />
                {updateExec.isPending ? 'Salvando...' : 'Salvar e Concluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Action detail dialog */}
        <Dialog open={!!activeAction} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {activeAction === 'validity' ? 'Registrar Validade' : activeAction === 'rupture' ? 'Registrar Ruptura' : activeAction === 'damage' ? 'Registrar Avaria' : 'Registrar Descarte'}
                {selectedExec && <span className="block text-xs font-normal text-muted-foreground mt-1">{selectedExec.product_name}</span>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {activeAction === 'validity' && (
                <>
                  <div><Label className="text-xs">Data de Validade</Label><Input type="date" value={actionForm.expiry_date || ''} onChange={e => setActionForm({ ...actionForm, expiry_date: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Qtd Loja</Label><Input type="number" placeholder="0" value={actionForm.val_qty_store ?? ''} onChange={e => setActionForm({ ...actionForm, val_qty_store: parseInt(e.target.value) || 0 })} /></div>
                    <div><Label className="text-xs">Qtd Estoque</Label><Input type="number" placeholder="0" value={actionForm.val_qty_stock ?? ''} onChange={e => setActionForm({ ...actionForm, val_qty_stock: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                </>
              )}
              {(activeAction === 'rupture' || activeAction === 'damage' || activeAction === 'discard') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Qtd Loja</Label><Input type="number" placeholder="0" value={actionForm.occ_qty_store ?? ''} onChange={e => setActionForm({ ...actionForm, occ_qty_store: parseInt(e.target.value) || 0 })} /></div>
                    <div><Label className="text-xs">Qtd Estoque</Label><Input type="number" placeholder="0" value={actionForm.occ_qty_stock ?? ''} onChange={e => setActionForm({ ...actionForm, occ_qty_stock: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                  <div><Label className="text-xs">Motivo</Label><Input placeholder="Motivo" value={actionForm.reason ?? ''} onChange={e => setActionForm({ ...actionForm, reason: e.target.value })} /></div>
                  <div><Label className="text-xs">Observação</Label><Textarea rows={2} placeholder="Observação" value={actionForm.observation ?? ''} onChange={e => setActionForm({ ...actionForm, observation: e.target.value, description: e.target.value })} /></div>
                  {activeAction === 'damage' && (
                    <div>
                      <Label className="text-xs">Local</Label>
                      <Select value={actionForm.location} onValueChange={v => setActionForm({ ...actionForm, location: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="store">Loja</SelectItem>
                          <SelectItem value="stock">Estoque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Cancelar</Button>
              <Button onClick={() => {
                if (!selectedExec || !activeAction) return;
                const execId = selectedExec.id;
                const onDone = () => { toast.success('Registrado com sucesso'); setActiveAction(null); };
                const onErr = (err: any) => toast.error(err.message);
                if (activeAction === 'validity') {
                  addValidity.mutate({ executionId: execId, expiry_date: actionForm.expiry_date, qty_store: actionForm.val_qty_store || 0, qty_stock: actionForm.val_qty_stock || 0 }, { onSuccess: onDone, onError: onErr });
                } else if (activeAction === 'rupture') {
                  reportRupture.mutate({ executionId: execId, qty_store: actionForm.occ_qty_store || 0, qty_stock: actionForm.occ_qty_stock || 0, reason: actionForm.reason, observation: actionForm.observation }, { onSuccess: onDone, onError: onErr });
                } else if (activeAction === 'damage') {
                  reportDamage.mutate({ executionId: execId, qty_store: actionForm.occ_qty_store || 0, qty_stock: actionForm.occ_qty_stock || 0, reason: actionForm.reason, observation: actionForm.observation, description: actionForm.observation, location: actionForm.location }, { onSuccess: onDone, onError: onErr });
                } else if (activeAction === 'discard') {
                  reportDiscard.mutate({ executionId: execId, qty_store: actionForm.occ_qty_store || 0, qty_stock: actionForm.occ_qty_stock || 0, reason: actionForm.reason, observation: actionForm.observation }, { onSuccess: onDone, onError: onErr });
                }
              }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete Route Dialog */}
        <Dialog open={showCompleteRoute} onOpenChange={setShowCompleteRoute}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Concluir Rota</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">
              Ao concluir esta rota, o checklist de <b>{currentBrand?.brand_name || route.brand_name}</b> será finalizado.
              Se houver mais rotas neste PDV, o checkout da loja será feito depois.
            </p>
            <div>
              <Label className="text-xs">Observação de encerramento</Label>
              <Textarea rows={3} placeholder="Observações finais..." onChange={e => setActionForm({ ...actionForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompleteRoute(false)}>Cancelar</Button>
              <Button onClick={handleCompleteRoute} disabled={checkout.isPending}>
                {checkout.isPending ? 'Concluindo...' : 'Confirmar Conclusão'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PDV Checkout Dialog */}
        <Dialog open={showPdvCheckout} onOpenChange={setShowPdvCheckout}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Checkout da Loja
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-green-700">✅ Última rota concluída!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta era a última rota neste PDV. Faça o checkout da loja para encerrar a visita.
                  </p>
                </CardContent>
              </Card>

              {route.require_checkout_photo && (
                <div className="space-y-2">
                  <Label className="text-xs">Foto final da loja (obrigatória)</Label>
                  {pdvCheckoutPhoto ? (
                    <div className="space-y-2">
                      <img src={pdvCheckoutPhoto} alt="Checkout" className="w-full rounded-lg border max-h-48 object-cover" />
                      <Button variant="outline" size="sm" onClick={() => setPdvCheckoutPhoto('')}>Tirar outra foto</Button>
                    </div>
                  ) : (
                    <CameraCapture
                      onCapture={setPdvCheckoutPhoto}
                      watermark={{ pdvName: route.pdv_name, brandName: route.brand_name, photoType: 'Checkout PDV' }}
                      customTokenGetter={() => localStorage.getItem('promotor_token')}
                      buttonLabel="Tirar foto de saída da loja"
                      qualityConfig={photoQualityConfig}
                    />
                  )}
                </div>
              )}

              <div>
                <Label className="text-xs">Observação</Label>
                <Textarea rows={2} placeholder="Observações sobre a visita..." onChange={e => setActionForm({ ...actionForm, pdv_notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowPdvCheckout(false); navigate('/promotor/home'); }}>
                Pular
              </Button>
              <Button onClick={handlePdvCheckout} disabled={route.require_checkout_photo && !pdvCheckoutPhoto}>
                Fazer Checkout
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extra Point Category Picker Dialog */}
        <Dialog open={showExtraPointCategoryPicker} onOpenChange={setShowExtraPointCategoryPicker}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-sm">Selecione a Categoria</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {Object.entries(groupedExecs).filter(([, v]) => !v.isExtraGroup).map(([category, { catId }]) => (
                <Button key={catId} variant="outline" className="w-full justify-start" onClick={() => {
                  setShowExtraPointCategoryPicker(false);
                  setShowExtraPointDialog({ catId, categoryName: category });
                  setSelectedExtraProducts([]);
                }}>
                  <Target className="h-4 w-4 mr-2 text-orange-600" /> {category}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Extra Point Product Selection Dialog */}
        <Dialog open={!!showExtraPointDialog} onOpenChange={() => setShowExtraPointDialog(null)}>
          <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-600" /> Ponto Extra
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Selecione os produtos de <b>{showExtraPointDialog?.categoryName}</b> que estão neste ponto extra.
              </p>
            </DialogHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {showExtraPointDialog && groupedExecs[showExtraPointDialog.categoryName]?.execs
                .filter((e: any) => e.exposure_point !== 'extra')
                .map((exec: any) => (
                  <label key={exec.id} className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-accent/50">
                    <Checkbox
                      checked={selectedExtraProducts.includes(exec.product_id)}
                      onCheckedChange={(checked) => {
                        setSelectedExtraProducts(prev =>
                          checked ? [...prev, exec.product_id] : prev.filter(id => id !== exec.product_id)
                        );
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{exec.product_name}</span>
                      {exec.sku && <span className="text-[10px] text-muted-foreground ml-2">SKU: {exec.sku}</span>}
                    </div>
                  </label>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExtraPointDialog(null)}>Cancelar</Button>
              <Button disabled={selectedExtraProducts.length === 0 || registerExtraPoint.isPending}
                onClick={() => {
                  if (!showExtraPointDialog) return;
                  registerExtraPoint.mutate({
                    routeId: id!,
                    catId: showExtraPointDialog.catId,
                    product_ids: selectedExtraProducts,
                  }, {
                    onSuccess: (data: any) => {
                      toast.success(`${data.count} produto(s) duplicado(s) para ponto extra!`);
                      setShowExtraPointDialog(null);
                      setSelectedExtraProducts([]);
                    },
                    onError: (err: any) => toast.error(err.message),
                  });
                }}>
                <Plus className="h-4 w-4 mr-1" />
                {registerExtraPoint.isPending ? 'Registrando...' : `Registrar ${selectedExtraProducts.length} produto(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Facial Verification Dialog */}
        <FaceVerifyDialog
          open={showFaceVerify}
          onOpenChange={(open) => { if (!open) { setShowFaceVerify(false); setFaceVerifyAction(null); } }}
          storedDescriptor={facialConfig?.descriptor || []}
          storedPhotoUrl={facialConfig?.photo_url}
          personName={route?.promotor_name}
          threshold={facialConfig?.min_confidence || 70}
          onResult={(result) => {
            setShowFaceVerify(false);
            if (result.match) {
              toast.success(`Identidade confirmada (${result.score.toFixed(1)}%)`);
              const action = faceVerifyAction;
              setTimeout(() => {
                if (action === 'checkin') handleCheckin();
                else if (action === 'checkout') handleCompleteRoute();
                else if (action === 'pdv_checkout') handlePdvCheckout();
              }, 300);
            } else {
              toast.error(`Identidade não confirmada (${result.score.toFixed(1)}%). Ação bloqueada.`);
              setFaceVerifyAction(null);
            }
          }}
        />
      </div>
    </PromotorLayout>
  );
}
