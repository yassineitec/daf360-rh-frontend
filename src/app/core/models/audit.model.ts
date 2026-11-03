export interface AuditLog {
  id: number;
  source: 'EVENT_LOG' | 'GENERIC';
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
  timestamp: string;
}
