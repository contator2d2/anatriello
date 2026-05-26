import { useState, useCallback } from 'react';
import { API_URL, getAuthToken } from '@/lib/api';
import { logger } from '@/lib/logger';

interface UploadResult {
  success: boolean;
  file: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
  };
}

export function useUpload(customTokenGetter?: () => string | null) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(`Arquivo muito grande (${sizeMB}MB). Máximo permitido: 100MB.`);
    }

    setIsUploading(true);
    setProgress(0);

    logger.info('[useUpload] Iniciando upload de arquivo', { 
      name: file.name, 
      type: file.type, 
      size: file.size,
      apiUrl: API_URL 
    });

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = customTokenGetter ? customTokenGetter() : getAuthToken();
      console.log('[useUpload] Auth token present:', !!token);
      
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
          console.log('[useUpload] Progress:', percentComplete + '%');
        }
      });

      xhr.addEventListener('load', () => {
        setIsUploading(false);
        logger.info('[useUpload] Upload concluído (status XHR)', { status: xhr.status });
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result: UploadResult = JSON.parse(xhr.responseText);
            setProgress(100);
            // Build full URL: if the returned url is relative, prepend API_URL
            let fileUrl = result.file.url;
            if (fileUrl.startsWith('/') && API_URL) {
              fileUrl = `${API_URL}${fileUrl}`;
            }
            console.log('[useUpload] Success, URL:', fileUrl);
            resolve(fileUrl);
          } catch (e: any) {
            logger.error('[useUpload] Erro ao processar resposta JSON', { error: e.message });
            reject(new Error('Erro ao processar resposta'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            logger.warn('[useUpload] Servidor retornou erro no upload', { error, status: xhr.status });
            reject(new Error(error.error || 'Erro ao fazer upload'));
          } catch {
            logger.error('[useUpload] Resposta de erro não-JSON', { status: xhr.status, text: xhr.responseText.substring(0, 200) });
            reject(new Error(`Erro ao fazer upload (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener('error', (e) => {
        setIsUploading(false);
        setProgress(0);
        logger.error('[useUpload] Erro de rede/conexão no upload', { event: e });
        reject(new Error('Erro de conexão'));
      });

      xhr.addEventListener('abort', () => {
        setIsUploading(false);
        setProgress(0);
        console.log('[useUpload] Upload aborted');
        reject(new Error('Upload cancelado'));
      });

      const uploadUrl = `${API_URL}/api/uploads`;
      console.log('[useUpload] POST to:', uploadUrl);
      xhr.open('POST', uploadUrl);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  }, [customTokenGetter]);

  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  return {
    uploadFile,
    isUploading,
    progress,
    resetProgress,
  };
}
