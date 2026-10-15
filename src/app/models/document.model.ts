export type DocumentCategory = 'DISCHARGE_SUMMARY' | 'CONSENT' | 'PRESCRIPTION' | 'LAB_RESULT' | 'IMAGING' | 'REFERRAL' | 'OTHER';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['DISCHARGE_SUMMARY', 'CONSENT', 'PRESCRIPTION', 'LAB_RESULT', 'IMAGING', 'REFERRAL', 'OTHER'];

export type DocumentContentType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface PatientDocument {
  id: number; patientId: number; title: string; category: DocumentCategory;
  contentType: DocumentContentType; sizeBytes: number;
  originalFilename: string; sha256: string; uploadedAt: string; uploadedByName: string | null;
}

export interface DocumentDeleteRequest { reason: string }
