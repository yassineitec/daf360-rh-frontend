export interface ListType {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  description: string | null;
  isPerPays: boolean;
  isSystem: boolean;
}

export interface ListValue {
  id: number;
  listTypeId: number;
  paysId: number | null;
  valueCode: string;
  labelFr: string;
  labelEn: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  payrollContractCode: string | null;
  /** CONTRACT_TYPE only: lifecycle rules this type follows (CDI, CDD, CIVP, STAGE, FREELANCE, DETACHEMENT). */
  lifecycleNature: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateListValueRequest {
  listTypeId: number;
  paysId?: number | null;
  valueCode: string;
  labelFr: string;
  labelEn: string;
  sortOrder?: number;
  lifecycleNature?: string | null;
}

export interface UpdateListValueRequest {
  labelFr?: string;
  labelEn?: string;
  sortOrder?: number;
  isActive?: boolean;
  forceDeactivate?: boolean;
  payrollContractCode?: string | null;
  lifecycleNature?: string | null;
}
