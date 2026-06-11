import { Component, computed, input } from '@angular/core';

interface StatusConfig { color: string; label: string; }

const STATUS_MAP: Record<string, StatusConfig> = {
  // Leave types
  CONGE:          { color: '#059669', label: 'Congé' },
  MALADIE:        { color: '#DC2626', label: 'Maladie' },
  MATERNITE:      { color: '#DB2777', label: 'Maternité' },
  PATERNITE:      { color: '#7C3AED', label: 'Paternité' },
  EXCEPTIONNEL:   { color: '#6366F1', label: 'Exceptionnel' },
  DEUIL_AUTRE:    { color: '#64748B', label: 'Deuil/Autre' },
  // Leave / teletravail state
  EN_ATTENTE:     { color: '#D97706', label: 'En attente' },
  VALIDE:         { color: '#16A34A', label: 'Validé' },
  REFUSE:         { color: '#DC2626', label: 'Refusé' },
  ARCHIVE:        { color: '#94A3B8', label: 'Archivé' },
  // Employee lifecycle
  PRE_ONBOARDING: { color: '#94A3B8', label: 'Pré-onboarding' },
  ACTIVE:         { color: '#16A34A', label: 'Actif' },
  ON_LEAVE:       { color: '#F59E0B', label: 'En congé' },
  ON_MISSION:     { color: '#3B82F6', label: 'En mission' },
  OFFBOARDING:    { color: '#EA580C', label: 'Offboarding' },
  TERMINATED:     { color: '#EF4444', label: 'Terminé' },
  ARCHIVED:       { color: '#6B7280', label: 'Archivé' },
  // Request status
  SUBMITTED:      { color: '#3B82F6', label: 'Soumis' },
  IN_REVIEW:      { color: '#F59E0B', label: 'En traitement' },
  APPROVED:       { color: '#16A34A', label: 'Approuvé' },
  REJECTED:       { color: '#DC2626', label: 'Rejeté' },
  CANCELLED:      { color: '#9CA3AF', label: 'Annulé' },
  PENDING_L2:     { color: '#EA580C', label: 'Attente L2' },
  // Payroll
  DRAFT:          { color: '#94A3B8', label: 'Brouillon' },
  VALIDATED:      { color: '#3B82F6', label: 'Validé' },
  PUBLISHED:      { color: '#16A34A', label: 'Publié' },
  LOCKED:         { color: '#16A34A', label: 'Verrouillé' },
  // Candidate recruitment statuses
  PENDING:        { color: '#95a5a6', label: 'En attente' },
  ACCEPTED:       { color: '#27ae60', label: 'Accepté' },
  IT_IN_PROGRESS: { color: '#3498db', label: 'IT en cours' },
  EMAIL_RECEIVED: { color: '#1a6b7c', label: 'Email reçu' },
  HR_IN_PROGRESS: { color: '#f39c12', label: 'RH en cours' },
  HIRED:          { color: '#1e8449', label: 'Embauché' },
  // IT Provisioning statuses
  IN_PROGRESS:    { color: '#3498db', label: 'En cours' },
  EMAIL_CREATED:  { color: '#1a6b7c', label: 'Email créé' },
  COMPLETED:      { color: '#27ae60', label: 'Complété' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="badge"
      [style.color]="cfg().color"
      [style.background]="cfg().color + '1a'"
    >{{ cfg().label }}</span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .5px;
      text-transform: uppercase;
      white-space: nowrap;
    }
  `],
})
export class StatusBadgeComponent {
  status = input.required<string>();

  cfg = computed((): StatusConfig => {
    const s = this.status();
    return STATUS_MAP[s] ?? { color: '#64748B', label: s };
  });
}
