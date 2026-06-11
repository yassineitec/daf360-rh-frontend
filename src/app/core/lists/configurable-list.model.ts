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
}

export interface UpdateListValueRequest {
  labelFr?: string;
  labelEn?: string;
  sortOrder?: number;
  isActive?: boolean;
  forceDeactivate?: boolean;
}
