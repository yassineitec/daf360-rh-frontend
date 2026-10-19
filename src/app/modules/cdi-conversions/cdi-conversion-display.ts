import { BadgeVariant } from '@khalilrebhiitec/daf360';
import { CdiConversion, CdiConversionStatus, isAwaitingConversion } from './cdi-conversion.model';

/**
 * The status as people read it. An APPROVED request that RH has carried out is shown as
 * "converted" — same backend status, but no action left.
 */
export function cdiStatusKey(r: Pick<CdiConversion, 'status' | 'convertedContractId'>): string {
  if (r.status === 'APPROVED' && r.convertedContractId != null) return 'CDI_CONVERSION.STATUS.CONVERTED';
  return 'CDI_CONVERSION.STATUS.' + r.status;
}

export function cdiStatusVariant(r: Pick<CdiConversion, 'status' | 'convertedContractId'>): BadgeVariant {
  const variants: Record<CdiConversionStatus, BadgeVariant> = {
    SUBMITTED: 'warning',
    ESCALATED: 'danger',
    APPROVED:  'success',
    REJECTED:  'neutral',
    CANCELLED: 'neutral',
  };
  if (isAwaitingConversion(r as CdiConversion)) return 'info';
  return variants[r.status] ?? 'neutral';
}
