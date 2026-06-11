export type TypeDocument = 'CONTRAT_INITIAL' | 'AVENANT';

export interface TypeContratDto {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  isActive: boolean;
}

export interface ContractHistoryDto {
  id: number;
  idCollaborateur: number;
  idTypeContrat: number;
  typeContratCode: string;
  typeContratLabelFr: string;
  typeDocument: TypeDocument;
  dateEffet: string;   // ISO date
  dateFin: string | null;
  salaireNet: number | null;
  motif: string | null;
  commentaire: string | null;
  createdBy: number | null;
  dateCreation: string;
  isActive: boolean;   // computed by backend: dateFin IS NULL or dateFin >= today
}

export interface CreateContractRequest {
  idTypeContrat: number;
  typeDocument: TypeDocument;
  dateEffet: string;
  dateFin?: string;
  salaireNet?: number;
  motif?: string;
  commentaire?: string;
}
