import { apiClient, unwrap } from './client';
import { listQueryParams, mapDocument, toPaginatedResponse } from './mappers';
import type { Document, PaginatedResponse } from '@/types';

export interface ListDocumentsParams {
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  page?: number;
  pageSize?: number;
}

interface BackendDocumentsPage {
  documents: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}

export interface UploadDocumentPayload {
  files: File[];
  patientId: string;
  appointmentId?: string;
  documentType?: string;
}

export interface UploadDocumentsResult {
  documents: Document[];
  failed: { fileName: string; message: string }[];
}

export const documentsApi = {
  list: async (params?: ListDocumentsParams): Promise<PaginatedResponse<Document>> => {
    const res = await apiClient.get('/api/documents', {
      params: listQueryParams(params as Record<string, string | number | undefined>),
    });
    const data = unwrap(res) as BackendDocumentsPage;
    return toPaginatedResponse(
      (data.documents ?? []).map(mapDocument),
      data.total ?? 0,
      data.page ?? 1,
      data.limit ?? 20
    );
  },

  get: async (id: string): Promise<Document> => {
    const res = await apiClient.get(`/api/documents/${id}`);
    return mapDocument(unwrap(res) as Record<string, unknown>);
  },

  /** Authenticated binary stream for in-app preview (PDF / images). */
  fetchPreviewBlob: async (documentId: string): Promise<Blob> => {
    const res = await apiClient.get(`/api/documents/${documentId}/preview`, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  upload: async (payload: UploadDocumentPayload): Promise<UploadDocumentsResult> => {
    const formData = new FormData();
    for (const file of payload.files) {
      formData.append('files', file);
    }
    formData.append('patientId', payload.patientId);
    if (payload.appointmentId) formData.append('appointmentId', payload.appointmentId);
    if (payload.documentType) formData.append('documentType', payload.documentType);

    const res = await apiClient.post('/api/documents/upload', formData);
    const data = unwrap(res) as {
      documents: Record<string, unknown>[];
      failed: { fileName: string; message: string }[];
    };
    return {
      documents: (data.documents ?? []).map(mapDocument),
      failed: data.failed ?? [],
    };
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/documents/${id}`);
  },

  reprocess: async (id: string): Promise<void> => {
    await apiClient.post(`/api/documents/${id}/reprocess`);
  },
};

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (params?: ListDocumentsParams) => [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};
