import { useState, useEffect, useCallback } from 'react';
import { db, type PendingApiCall, type PendingUpload } from '@/lib/offline-db';
import { api, API_URL } from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [localFileUrls, setLocalFileUrls] = useState<Record<string, string>>({});

  // Helper to get actual blob URL from localId
  const getLocalFileUrl = useCallback(async (localId: string) => {
    if (localFileUrls[localId]) return localFileUrls[localId];
    
    const upload = await db.pending_uploads.where('localId').equals(localId).first();
    if (upload && upload.file) {
      const url = URL.createObjectURL(upload.file);
      setLocalFileUrls(prev => ({ ...prev, [localId]: url }));
      return url;
    }
    return null;
  }, [localFileUrls]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(localFileUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [localFileUrls]);

  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    const pendingUploads = await db.pending_uploads.where('status').equals('pending').toArray();
    const pendingCalls = await db.pending_api_calls.where('status').equals('pending').toArray();

    if (pendingUploads.length === 0 && pendingCalls.length === 0) return;

    setIsSyncing(true);
    logger.info('[OfflineSync] Iniciando sincronização', { 
      uploads: pendingUploads.length, 
      calls: pendingCalls.length 
    });

    // 1. Process Uploads first
    const uploadMap = new Map<string, string>(); // localId -> serverUrl

    for (const upload of pendingUploads) {
      try {
        await db.pending_uploads.update(upload.id!, { status: 'uploading' });
        
        const formData = new FormData();
        formData.append('file', upload.file, upload.fileName);

        const response = await fetch(`${API_URL}/api/uploads`, {
          method: 'POST',
          headers: upload.token ? { 'Authorization': `Bearer ${upload.token}` } : {},
          body: formData
        });

        if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
        
        const result = await response.json();
        let fileUrl = result.file.url;
        if (fileUrl.startsWith('/') && API_URL) {
          fileUrl = `${API_URL}${fileUrl}`;
        }

        uploadMap.set(upload.localId, fileUrl);
        await db.pending_uploads.delete(upload.id!);
        logger.info('[OfflineSync] Upload concluído', { localId: upload.localId, url: fileUrl });
      } catch (err: any) {
        logger.error('[OfflineSync] Erro no upload', { id: upload.id, error: err.message });
        await db.pending_uploads.update(upload.id!, { status: 'failed', error: err.message });
      }
    }

    // 2. Process API Calls
    for (const call of pendingCalls) {
      try {
        await db.pending_api_calls.update(call.id!, { status: 'processing' });

        let body = call.body;
        
        if (call.dependsOnUploadId && uploadMap.has(call.dependsOnUploadId)) {
          const realUrl = uploadMap.get(call.dependsOnUploadId);
          const replaceUrl = (obj: any): any => {
            if (typeof obj === 'string' && obj.startsWith('blob:')) return realUrl;
            if (Array.isArray(obj)) return obj.map(replaceUrl);
            if (obj !== null && typeof obj === 'object') {
              const newObj: any = {};
              for (const key in obj) {
                newObj[key] = obj[key] === call.dependsOnUploadId || (typeof obj[key] === 'string' && obj[key].startsWith('blob:')) 
                  ? realUrl 
                  : replaceUrl(obj[key]);
              }
              return newObj;
            }
            return obj;
          };
          body = replaceUrl(body);
        }

        await api(call.url, {
          method: call.method as any,
          body,
          headers: call.headers
        });

        await db.pending_api_calls.delete(call.id!);
        logger.info('[OfflineSync] Chamada API concluída', { url: call.url });
      } catch (err: any) {
        logger.error('[OfflineSync] Erro na chamada API', { id: call.id, error: err.message });
        await db.pending_api_calls.update(call.id!, { status: 'failed', error: err.message });
      }
    }

    setIsSyncing(false);
    toast.success('Sincronização offline concluída!', {
      description: `Processados ${pendingUploads.length} arquivos e ${pendingCalls.length} chamadas.`
    });
  }, [isOnline, isSyncing]);

  const queueUpload = useCallback(async (file: File, token: string | null): Promise<string> => {
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert file to base64 for persistent storage if it's small, 
    // or keep as Blob/File if Dexie handles it (it does in IndexedDB)
    await db.pending_uploads.add({
      file: file,
      fileName: file.name,
      fileType: file.type,
      timestamp: Date.now(),
      token,
      status: 'pending',
      localId
    });

    if (isOnline) {
      setTimeout(() => sync(), 100);
    }

    // IMPORTANT: Return the localId as the reference, NOT a transient blob URL
    // This allows the UI to know it's a pending file
    return `local-file://${localId}`;
  }, [isOnline, sync]);

  const queueApiCall = useCallback(async (config: Omit<PendingApiCall, 'status' | 'timestamp'>) => {
    await db.pending_api_calls.add({
      ...config,
      status: 'pending',
      timestamp: Date.now()
    });
    
    if (isOnline) {
      setTimeout(() => sync(), 100);
    } else {
      toast.info('Você está offline. A ação será sincronizada quando houver conexão.', {
        description: 'Sua atividade foi salva localmente.',
      });
    }
  }, [isOnline, sync]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      sync();
    }
  }, [isOnline, sync]);

  return { isOnline, isSyncing, queueUpload, queueApiCall, sync };
}
