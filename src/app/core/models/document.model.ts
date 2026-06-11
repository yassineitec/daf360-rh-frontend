export type DocumentType =
  | 'CONTRACT' | 'ID_CARD' | 'DIPLOMA' | 'MEDICAL_CERTIFICATE'
  | 'RESIDENCE_PERMIT' | 'RIB' | 'RESIGNATION' | 'OTHER';

export interface HrDocument {
  id: number;
  employeeId: number;
  documentType: DocumentType;
  fileName: string;
  version: number;
  confidential: boolean;
  createdAt: string;
  createdBy: string;
}
