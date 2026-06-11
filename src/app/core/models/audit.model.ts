export interface AuditLog {
  id: number;
  actorId: string;
  action: string;
  entity: string;
  entityId: number | null;
  beforeValue: string | null;
  afterValue: string | null;
  ip: string | null;
  createdAt: string;
}
