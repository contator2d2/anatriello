import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, RotateCcw, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "sonner";

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

  // Sample center region for analysis (50% of image)
  const sampleX = Math.floor(w * 0.25);
  const sampleY = Math.floor(h * 0.25);
  const sampleW = Math.floor(w * 0.5);
  const sampleH = Math.floor(h * 0.5);
  const imageData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
  const data = imageData.data;
  const pixelCount = sampleW * sampleH;

  // Brightness analysis
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  const avgBrightness = totalBrightness / pixelCount;

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
  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = y * sampleW + x;
      const laplacian =
        -grayData[idx - sampleW] -
        grayData[idx - 1] +
        4 * grayData[idx] -
        grayData[idx + 1] -
        grayData[idx + sampleW];
      laplacianVar += laplacian * laplacian;
    }
  }
  laplacianVar /= ((sampleW - 2) * (sampleH - 2));

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

function compressImage(
  canvas: HTMLCanvasElement,
  quality: number,
  maxSizeKb: number
): Blob | null {
  let q = quality;
  let blob: Blob | null = null;

  // Try progressive compression
  for (let attempt = 0; attempt < 5; attempt++) {
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    const binary = atob(dataUrl.split(",")[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    blob = new Blob([array], { type: "image/jpeg" });

    if (blob.size / 1024 <= maxSizeKb) break;
    q -= 0.1;
    if (q < 0.1) break;
  }

  return blob;
}

export function CameraCapture({
  onCapture,
  watermark = {},
  customTokenGetter,
  buttonLabel = "Tirar Foto",
  buttonClassName,
  disabled,
  qualityConfig,
}: CameraCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { uploadFile, isUploading } = useUpload(customTokenGetter);
  const config = { ...DEFAULT_QUALITY_CONFIG, ...qualityConfig };

  const startCamera = useCallback(async (facing: "environment" | "user") => {
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
        videoRef.current.play();
      }
    } catch {
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsOpen(false);
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  const handleOpen = () => {
    setCapturedImage(null);
    setValidationError(null);
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    }
    return () => {
      if (!isOpen) stopCamera();
    };
  }, [isOpen, facingMode]);

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

      // Compress
      const blob = compressImage(canvasRef.current, config.compression_quality, config.max_file_size_kb);
      if (!blob) {
        toast.error("Erro ao comprimir imagem");
        setIsProcessing(false);
        return;
      }

      // Upload
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file);
      if (url) {
        onCapture(url);
        toast.success("Foto aprovada e enviada!");
        handleClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto");
    } finally {
      setIsProcessing(false);
    }
  };

  const busy = isProcessing || isUploading;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={buttonClassName || "w-full h-14 flex-col gap-1 border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"}
        onClick={handleOpen}
        disabled={disabled}
      >
        <Camera className="h-5 w-5 text-primary" />
        <span className="text-xs font-medium">{buttonLabel}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-black">
          <canvas ref={canvasRef} className="hidden" />

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
    </>
  );
}
