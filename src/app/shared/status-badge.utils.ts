import { TranslateService } from '@ngx-translate/core';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'neutral' | 'teal';

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  // Leave types
  CONGE:          { label: 'Congé',          variant: 'success'   },
  MALADIE:        { label: 'Maladie',         variant: 'danger'    },
  MATERNITE:      { label: 'Maternité',       variant: 'info'      },
  PATERNITE:      { label: 'Paternité',       variant: 'secondary' },
  EXCEPTIONNEL:   { label: 'Exceptionnel',    variant: 'primary'   },
  DEUIL_AUTRE:    { label: 'Deuil/Autre',     variant: 'neutral'   },
  // Leave / teletravail state
  EN_ATTENTE:     { label: 'En attente',      variant: 'warning'   },
  VALIDE:         { label: 'Validé',          variant: 'success'   },
  REFUSE:         { label: 'Refusé',          variant: 'danger'    },
  ARCHIVE:        { label: 'Archivé',         variant: 'neutral'   },
  // Employee lifecycle
  PRE_ONBOARDING: { label: 'Pré-onboarding',  variant: 'neutral'   },
  ACTIVE:         { label: 'Actif',           variant: 'success'   },
  ON_LEAVE:       { label: 'En congé',        variant: 'warning'   },
  ON_MISSION:     { label: 'En mission',      variant: 'info'      },
  OFFBOARDING:    { label: 'Offboarding',     variant: 'warning'   },
  TERMINATED:     { label: 'Terminé',         variant: 'danger'    },
  ARCHIVED:       { label: 'Archivé',         variant: 'neutral'   },
  // Request status
  SUBMITTED:      { label: 'Soumis',          variant: 'info'      },
  IN_REVIEW:      { label: 'En traitement',   variant: 'warning'   },
  APPROVED:       { label: 'Approuvé',        variant: 'success'   },
  REJECTED:       { label: 'Rejeté',          variant: 'danger'    },
  CANCELLED:      { label: 'Annulé',          variant: 'neutral'   },
  PENDING_L2:     { label: 'Attente L2',      variant: 'warning'   },
  // Payroll
  DRAFT:          { label: 'Brouillon',       variant: 'neutral'   },
  VALIDATED:      { label: 'Validé',          variant: 'info'      },
  PUBLISHED:      { label: 'Publié',          variant: 'success'   },
  LOCKED:         { label: 'Verrouillé',      variant: 'success'   },
  // Candidate
  PENDING:        { label: 'En attente',      variant: 'neutral'   },
  ACCEPTED:       { label: 'Accepté',         variant: 'success'   },
  OFFER_SENT:     { label: 'Offre envoyée',   variant: 'warning'   },
  IT_IN_PROGRESS: { label: 'IT en cours',     variant: 'info'      },
  EMAIL_RECEIVED: { label: 'Email reçu',      variant: 'teal'      },
  HR_IN_PROGRESS: { label: 'RH en cours',     variant: 'warning'   },
  HIRED:          { label: 'Embauché',        variant: 'success'   },
  // IT Provisioning
  IN_PROGRESS:    { label: 'En cours',        variant: 'info'      },
  EMAIL_CREATED:  { label: 'Email créé',      variant: 'teal'      },
  COMPLETED:      { label: 'Complété',        variant: 'success'   },
};

/**
 * Badge for a status code. Pass the TranslateService to get the label in the UI language
 * (STATUS_BADGE.* keys); without it the label is the French one above, as before.
 * An unknown code renders as itself.
 */
export function statusBadge(
  status: string, translate?: TranslateService,
): { label: string; options: { variant: BadgeVariant } } {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'neutral' as BadgeVariant };
  const label = translate && STATUS_MAP[status]
    ? translate.instant('STATUS_BADGE.' + status)
    : cfg.label;
  return { label, options: { variant: cfg.variant } };
}
