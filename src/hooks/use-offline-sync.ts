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

  const queueUpload = useCallback(async (file: File, token: string | null): Promise<string> => {
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.pending_uploads.add({
      file: file,
      fileName: file.name,
      fileType: file.type,
      timestamp: Date.now(),
      token,
      status: 'pending',
      localId
    });

    // Return a temporary local URL so the UI can show the photo immediately
    return URL.createObjectURL(file);
  }, []);

  const queueApiCall = useCallback(async (config: Omit<PendingApiCall, 'status' | 'timestamp'>) => {
    await db.pending_api_calls.add({
      ...config,
      status: 'pending',
      timestamp: Date.now()
    });
    
    toast.info('Você está offline. A ação será sincronizada quando houver conexão.', {
      description: 'Sua atividade foi salva localmente.',
    });
  }, []);

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

        // We use a raw fetch here to reuse the upload logic or we could import useUpload's logic
        // But since we are in a hook, we'll do a direct fetch for simplicity in background
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
        
        // If this call depends on an upload, replace the temporary URL with the real one
        if (call.dependsOnUploadId && uploadMap.has(call.dependsOnUploadId)) {
          const realUrl = uploadMap.get(call.dependsOnUploadId);
          // Recursively find and replace the localId in the body
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
    toast.success('Sincronização offline concluída com sucesso!', {
      description: `Processados ${pendingUploads.length} arquivos e ${pendingCalls.length} chamadas.`
    });
  }, [isOnline, isSyncing]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      sync();
    }
  }, [isOnline, sync]);

  return { isOnline, isSyncing, queueUpload, queueApiCall, sync };
}
