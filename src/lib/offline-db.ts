import Dexie, { type Table } from 'dexie';

export interface PendingUpload {
  id?: number;
  file: Blob;
  fileName: string;
  fileType: string;
  timestamp: number;
  token: string | null;
  status: 'pending' | 'uploading' | 'failed';
  error?: string;
  // This is used to map the local temporary ID to the final server URL
  localId: string; 
}

export interface PendingApiCall {
  id?: number;
  url: string;
  method: string;
  body: any;
  headers: Record<string, string>;
  timestamp: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
  // If this API call depends on an upload, store the localId of that upload
  dependsOnUploadId?: string;
}

export class OfflineDatabase extends Dexie {
  pending_uploads!: Table<PendingUpload>;
  pending_api_calls!: Table<PendingApiCall>;

  constructor() {
    super('AyraOfflineDB');
    this.version(1).stores({
      pending_uploads: '++id, localId, status, timestamp',
      pending_api_calls: '++id, status, timestamp, dependsOnUploadId'
    });
  }
}

export const db = new OfflineDatabase();
