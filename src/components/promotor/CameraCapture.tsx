import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Camera, RotateCcw, Check, X, Loader2, AlertTriangle, Upload, WifiOff } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface WatermarkData {
  pdvName?: string;
  promotorName?: string;
  brandName?: string;
  photoType?: string;
  latitude?: number;
  longitude?: number;
}

interface CameraCaptureProps {
  onCapture: (url: string) => void;
  watermark?: WatermarkData;
  customTokenGetter?: () => string | null;
  buttonLabel?: string;
  buttonClassName?: string;
  disabled?: boolean;
  qualityConfig?: PhotoQualityConfig;
  allowManualUpload?: boolean;
}

export interface PhotoQualityConfig {
  blur_tolerance: number;       // 0-100, lower = stricter (default 30)
  min_brightness: number;       // 0-255 (default 40)
  max_brightness: number;       // 0-255 (default 220)
  min_resolution_w: number;     // min width px (default 640)
  min_resolution_h: number;     // min height px (default 480)
  compression_quality: number;  // 0-1 (default 0.7)
  max_file_size_kb: number;     // max compressed size (default 1024)
}

const DEFAULT_QUALITY_CONFIG: PhotoQualityConfig = {
  blur_tolerance: 30,
  min_brightness: 40,
  max_brightness: 220,
  min_resolution_w: 640,
  min_resolution_h: 480,
  compression_quality: 0.7,
  max_file_size_kb: 1024,
};

interface ValidationResult {
  valid: boolean;
  message?: string;
}

function analyzeImageQuality(
  canvas: HTMLCanvasElement,
  config: PhotoQualityConfig
): ValidationResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { valid: false, message: "Não foi possível validar a foto. Tente novamente." };

  const w = canvas.width;
  const h = canvas.height;

  // Resolution check
  if (w < config.min_resolution_w || h < config.min_resolution_h) {
    return { valid: false, message: `Resolução muito baixa (${w}x${h}). Mínimo: ${config.min_resolution_w}x${config.min_resolution_h}.` };
  }

  // Optimize: use an even smaller sample area for faster analysis
  const sampleW = Math.min(200, Math.floor(w * 0.2));
  const sampleH = Math.min(150, Math.floor(h * 0.2));
  const sampleX = Math.floor((w - sampleW) / 2);
  const sampleY = Math.floor((h - sampleH) / 2);
  
  const imageData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
  const data = imageData.data;
  const pixelCount = sampleW * sampleH;

  // Brightness analysis
  let totalBrightness = 0;
  // Step through pixels to speed up (every 4th pixel)
  for (let i = 0; i < data.length; i += 16) {
    totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  const avgBrightness = totalBrightness / (pixelCount / 4);

  if (avgBrightness < config.min_brightness) {
    return { valid: false, message: "A foto está muito escura. Melhore a iluminação." };
  }
  if (avgBrightness > config.max_brightness) {
    return { valid: false, message: "A foto está muito clara. Ajuste a posição da câmera." };
  }

  // Blur detection using Laplacian variance
  const grayData = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    grayData[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  let laplacianVar = 0;
  // Step through pixels to speed up
  const step = 2;
  let count = 0;
  for (let y = 1; y < sampleH - 1; y += step) {
    for (let x = 1; x < sampleW - 1; x += step) {
      const idx = y * sampleW + x;
      const laplacian =
        -grayData[idx - sampleW] -
        grayData[idx - 1] +
        4 * grayData[idx] -
        grayData[idx + 1] -
        grayData[idx + sampleW];
      laplacianVar += laplacian * laplacian;
      count++;
    }
  }
  laplacianVar /= count;

  if (laplacianVar < config.blur_tolerance) {
    return { valid: false, message: "A foto está borrada. Tire novamente." };
  }

  return { valid: true };
}

function applyWatermark(
  canvas: HTMLCanvasElement,
  watermark: WatermarkData
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const lines: string[] = [];
  if (watermark.pdvName) lines.push(`PDV: ${watermark.pdvName}`);
  if (watermark.brandName) lines.push(`Marca: ${watermark.brandName}`);
  if (watermark.promotorName) lines.push(`Promotor: ${watermark.promotorName}`);
  lines.push(`${dateStr} ${timeStr}`);
  if (watermark.photoType) lines.push(`Tipo: ${watermark.photoType}`);
  if (watermark.latitude && watermark.longitude) {
    lines.push(`GPS: ${watermark.latitude.toFixed(5)}, ${watermark.longitude.toFixed(5)}`);
  }

  const fontSize = Math.max(12, Math.floor(w * 0.025));
  const lineHeight = fontSize * 1.4;
  const padding = fontSize * 0.8;
  const boxHeight = lines.length * lineHeight + padding * 2;

  // Semi-transparent background at bottom
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, h - boxHeight, w, boxHeight);

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = "top";

  lines.forEach((line, i) => {
    ctx.fillText(line, padding, h - boxHeight + padding + i * lineHeight);
  });

  // Timestamp watermark top-right
  ctx.font = `${Math.floor(fontSize * 0.8)}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const ts = `${dateStr} ${timeStr}`;
  const tsWidth = ctx.measureText(ts).width;
  ctx.fillText(ts, w - tsWidth - padding, padding);
}

async function compressToWebP(
  canvas: HTMLCanvasElement,
  quality: number,
  maxSizeKb: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let q = quality;
    
    const attempt = (currentQuality: number, attemptsLeft: number) => {
      // Use WebP for better compression and faster uploads
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          
          if (blob.size / 1024 <= maxSizeKb || attemptsLeft <= 0) {
            resolve(blob);
          } else {
            attempt(currentQuality - 0.1, attemptsLeft - 1);
          }
        },
        "image/webp",
        currentQuality
      );
    };

    attempt(q, 5);
  });
}

export function CameraCapture({
  onCapture,
  watermark = {},
  customTokenGetter,
  buttonLabel = "Tirar Foto",
  buttonClassName,
  disabled,
  qualityConfig,
  allowManualUpload = true,
}: CameraCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { uploadFile, isUploading } = useUpload(customTokenGetter);
  const { isOnline, queueUpload } = useOfflineSync();
  const config = { ...DEFAULT_QUALITY_CONFIG, ...qualityConfig };

  const startCamera = useCallback(async (facing: "environment" | "user"): Promise<MediaStream | null> => {
    try {
      // Stop existing stream
      if (stream) stream.getTracks().forEach((t) => t.stop());

      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
      return s;
    } catch {
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsOpen(false);
      return null;
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  // Open dialog and request the camera SYNCHRONOUSLY within the user click,
  // so the browser keeps the permission gesture context and doesn't re-prompt
  // on every photo.
  const handleOpen = async () => {
    setCapturedImage(null);
    setValidationError(null);
    setIsOpen(true);
    // Fire getUserMedia in the same tick as the click handler
    await startCamera(facingMode);
  };

  // Re-attach the existing stream to the video element when the dialog mounts
  // (in case the <video> wasn't in the DOM when startCamera ran).
  useEffect(() => {
    if (isOpen && !capturedImage && stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, capturedImage, stream]);

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setValidationError(null);
    setIsOpen(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Validate quality
    const result = analyzeImageQuality(canvas, config);
    if (!result.valid) {
      setValidationError(result.message || "Foto inválida");
      setCapturedImage(null);
      return;
    }

    setValidationError(null);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.95));
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setValidationError(null);
    startCamera(facingMode);
  };

  const handleFlipCamera = () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
  };

  const handleAccept = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);

    try {
      // Get geolocation for watermark
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* silent */ }

      // Apply watermark
      const wmData: WatermarkData = { ...watermark, latitude: lat, longitude: lng };
      applyWatermark(canvasRef.current, wmData);

      // Compress (now using WebP for faster background uploads)
      const blob = await compressToWebP(canvasRef.current, config.compression_quality, config.max_file_size_kb);
      if (!blob) {
        toast.error("Erro ao comprimir imagem");
        setIsProcessing(false);
        return;
      }

      // Create file and always use queue for performance, even when online
      // This allows the user to continue immediately while sync happens in background
      const file = new File([blob], `photo_${Date.now()}.webp`, { type: "image/webp" });
      const token = (customTokenGetter ? customTokenGetter() : null) || localStorage.getItem('promotor_token') || localStorage.getItem('auth_token');
      
      const localUrl = await queueUpload(file, token);
      
      // Clean up previous blob URL if it was a local one
      // (This is just safety, most local URLs will be new here)
      
      onCapture(localUrl);
      
      if (!isOnline) {
        logger.info("Foto salva localmente para sincronização posterior.");
      }
      
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar foto");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione um arquivo de imagem.");
      return;
    }

    setIsProcessing(true);
    setValidationError(null);

    try {
      // Load image into canvas for validation and watermark
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      // Validate quality
      const result = analyzeImageQuality(canvas, config);
      if (!result.valid) {
        setValidationError(`A imagem do computador não passou na validação: ${result.message}`);
        toast.error(result.message || "A imagem não passou nos critérios de qualidade.");
        setIsProcessing(false);
        return;
      }

      // If valid, show it as captured image
      setCapturedImage(canvas.toDataURL("image/jpeg", 0.95));
      setIsManualOpen(false);
      setIsOpen(true); // Open the preview dialog
    } catch (err) {
      toast.error("Erro ao processar imagem do computador.");
    } finally {
      setIsProcessing(false);
    }
  };

  const busy = isProcessing || isUploading;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "flex-1 h-14 flex-col gap-1 border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5",
            buttonClassName
          )}
          onClick={handleOpen}
          disabled={disabled}
        >
          <Camera className="h-5 w-5 text-primary" />
          <span className="text-xs font-medium">{buttonLabel}</span>
        </Button>

        {allowManualUpload && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="w-14 h-14 border-2 border-dashed border-muted-foreground/40 hover:border-primary hover:bg-primary/5"
            onClick={() => setIsManualOpen(true)}
            disabled={disabled}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Manual Upload Dialog */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Foto do Computador</DialogTitle>
            <DialogDescription>
              A foto passará pelos mesmos critérios de validação (brilho, nitidez e resolução) da câmera.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input 
              type="file" 
              accept="image/*" 
              onChange={handleManualFile}
              disabled={isProcessing}
            />
            {validationError && (
              <div className="p-3 bg-destructive/10 text-destructive text-xs flex items-center gap-2 rounded-md">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground italic">
              * A marca d'água será aplicada automaticamente após a validação.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-black">
          {/* Live camera view */}
          {!capturedImage && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[3/4] object-cover"
              />

              {/* Validation error overlay */}
              {validationError && (
                <div className="absolute inset-x-0 top-0 p-3 bg-destructive/90 text-white text-sm flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Camera controls */}
              <div className="absolute inset-x-0 bottom-0 p-4 flex items-center justify-center gap-6 bg-gradient-to-t from-black/70 to-transparent">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 text-white hover:bg-white/20"
                  onClick={handleClose}
                >
                  <X className="h-5 w-5" />
                </Button>

                <button
                  onClick={handleCapture}
                  className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-all active:scale-90"
                />

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 text-white hover:bg-white/20"
                  onClick={handleFlipCamera}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview captured image */}
          {capturedImage && (
            <div className="relative">
              <img src={capturedImage} alt="Preview" className="w-full aspect-[3/4] object-cover" />

              <div className="absolute inset-x-0 bottom-0 p-4 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent">
                <Button
                  variant="ghost"
                  className="h-12 px-6 text-white hover:bg-white/20 gap-2"
                  onClick={handleRetake}
                  disabled={busy}
                >
                  <RotateCcw className="h-4 w-4" />
                  Nova Foto
                </Button>

                <Button
                  className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={handleAccept}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {busy ? "Processando..." : "Aprovar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
