export interface RefDataItem {
  id: number;
  paysId?: number;
  code?: string;
  labelFr: string;
  labelEn: string;
  sortOrder?: number;
  isActive: boolean;
  swiftCode?: string;
  parentId?: number;
}

export interface CreateRefDataRequest {
  paysId?: number;
  code?: string;
  labelFr: string;
  labelEn?: string;
  sortOrder?: number;
  swiftCode?: string;
  parentId?: number;
}
