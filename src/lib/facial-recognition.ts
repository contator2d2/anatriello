/**
 * Facial Recognition by Geometric Landmarks
 * 
 * Uses face-api.js to extract 68 facial landmarks and compute
 * a 128-dimension face descriptor (geometric vector).
 * Comparison is done via euclidean distance — runs 100% in the browser.
 */
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

let modelsLoaded = false;
let modelsLoadingPromise: Promise<void> | null = null;
let activeFaceBackend: string | null = null;

type FaceApiTensorflowBackend = {
  getBackend?: () => string;
  ready?: () => Promise<void>;
  setBackend?: (backend: string) => Promise<boolean> | boolean;
};

function getFaceTensorflowBackend(): FaceApiTensorflowBackend | undefined {
  return (faceapi as typeof faceapi & { tf?: FaceApiTensorflowBackend }).tf;
}

async function ensureFaceBackend(preferredBackends: string[] = ['webgl', 'cpu']): Promise<string> {
  const tf = getFaceTensorflowBackend();
  if (!tf) {
    activeFaceBackend = 'unknown';
    return activeFaceBackend;
  }

  const currentBackend = tf.getBackend?.();
  if (currentBackend) {
    await tf.ready?.();
    activeFaceBackend = currentBackend;
    return currentBackend;
  }

  let lastError: unknown;

  for (const backend of preferredBackends) {
    try {
      const changed = await tf.setBackend?.(backend);
      if (changed === false) continue;

      await tf.ready?.();
      activeFaceBackend = tf.getBackend?.() || backend;
      return activeFaceBackend;
    } catch (error) {
      lastError = error;
    }
  }

  const fallbackBackend = tf.getBackend?.();
  if (fallbackBackend) {
    activeFaceBackend = fallbackBackend;
    return fallbackBackend;
  }

  throw lastError instanceof Error ? lastError : new Error('Nenhum backend facial disponível no navegador.');
}

async function switchFaceBackend(backend: string): Promise<boolean> {
  const tf = getFaceTensorflowBackend();
  if (!tf?.setBackend) return false;

  try {
    const changed = await tf.setBackend(backend);
    if (changed === false) return false;

    await tf.ready?.();
    activeFaceBackend = tf.getBackend?.() || backend;
    return true;
  } catch {
    return false;
  }
}

async function runFaceDetection(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionResult | null> {
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  const landmarks = detection.landmarks.positions.map(p => [p.x, p.y]);
  const descriptor = Array.from(detection.descriptor);
  const box = detection.detection.box;

  return {
    descriptor,
    landmarks,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    confidence: detection.detection.score * 100,
  };
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    await ensureFaceBackend();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  try {
    await modelsLoadingPromise;
  } catch (error) {
    modelsLoadingPromise = null;
    throw error;
  }
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface FaceDetectionResult {
  descriptor: number[];          // 128-dim face descriptor
  landmarks: number[][];         // 68 landmark points [x,y]
  box: { x: number; y: number; width: number; height: number };
  confidence: number;
}

/**
 * Detect face from an HTMLVideoElement or HTMLImageElement and extract descriptor
 */
export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionResult | null> {
  await loadFaceModels();

  try {
    return await runFaceDetection(input);
  } catch (error) {
    const switchedToCpu = activeFaceBackend !== 'cpu' && await switchFaceBackend('cpu');
    if (!switchedToCpu) throw error;

    return runFaceDetection(input);
  }
}

/**
 * Compare two face descriptors using euclidean distance
 * Returns a similarity score 0-100 (100 = identical)
 */
export function compareFaces(descriptor1: number[], descriptor2: number[]): number {
  if (descriptor1.length !== descriptor2.length) return 0;

  const distance = faceapi.euclideanDistance(
    new Float32Array(descriptor1),
    new Float32Array(descriptor2)
  );

  // face-api.js distance: 0 = identical, ~0.6+ = different person
  // Convert to 0-100 score where 100 = identical
  const score = Math.max(0, Math.min(100, (1 - distance / 0.8) * 100));
  return Math.round(score * 100) / 100;
}

/**
 * Check if two faces match based on a threshold
 */
export function facesMatch(descriptor1: number[], descriptor2: number[], threshold = 70): boolean {
  return compareFaces(descriptor1, descriptor2) >= threshold;
}

/**
 * Extract geometric measurements from landmarks for auditing
 */
export function extractGeometricProfile(landmarks: number[][]): Record<string, number> {
  if (landmarks.length < 68) return {};

  const dist = (a: number[], b: number[]) => 
    Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));

  // Key measurements (ratios to normalize for distance)
  const eyeLeft = landmarks[36];
  const eyeRight = landmarks[45];
  const noseTip = landmarks[30];
  const mouthLeft = landmarks[48];
  const mouthRight = landmarks[54];
  const chinBottom = landmarks[8];
  const foreheadApprox = landmarks[27]; // between eyes top

  const interEyeDistance = dist(eyeLeft, eyeRight);

  return {
    eye_distance: interEyeDistance,
    nose_to_chin_ratio: dist(noseTip, chinBottom) / interEyeDistance,
    mouth_width_ratio: dist(mouthLeft, mouthRight) / interEyeDistance,
    face_height_ratio: dist(foreheadApprox, chinBottom) / interEyeDistance,
    nose_to_mouth_ratio: dist(noseTip, landmarks[62]) / interEyeDistance,
    left_eye_to_nose_ratio: dist(eyeLeft, noseTip) / interEyeDistance,
    right_eye_to_nose_ratio: dist(eyeRight, noseTip) / interEyeDistance,
  };
}

/**
 * Draw face landmarks on a canvas (for visual feedback)
 */
export function drawLandmarks(
  canvas: HTMLCanvasElement,
  landmarks: number[][],
  box: FaceDetectionResult['box']
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw bounding box
  ctx.strokeStyle = 'hsl(142, 76%, 36%)';
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  // Draw landmark points
  ctx.fillStyle = 'hsl(142, 76%, 36%)';
  landmarks.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Capture a frame from video as an image data URL
 */
export function captureVideoFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}
