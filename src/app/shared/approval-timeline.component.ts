import { Component, input } from '@angular/core';
import { ApprovalSummary, EmployeeRequest, RequestStatus } from '../modules/requests/models/request.model';

interface TimelineStep {
  label:    string;
  status:   'done' | 'active' | 'pending' | 'rejected' | 'cancelled';
  date:     string | null;
  actor:    string | null;
  comment:  string | null;
  decision: string | null;
}

function buildSteps(req: EmployeeRequest): TimelineStep[] {
  const approvals = req.approvals ?? [];
  const steps: TimelineStep[] = [];

  // Step 0 — Soumis
  steps.push({
    label: 'Soumis', date: req.createdAt,
    status: 'done', actor: `Profil #${req.employeeProfileId}`,
    comment: req.closureComment ?? null, decision: null,
  });

  // Step 1 — En traitement
  const l1 = approvals.find(a => a.level === 'L1');
  if (req.status === 'CANCELLED') {
    steps.push({ label: 'Annulé', date: req.updatedAt, status: 'cancelled', actor: null, comment: null, decision: null });
    return steps;
  }

  const isActive = (s: RequestStatus) => req.status === s;

  if (l1) {
    steps.push({
      label: 'Traitement L1', date: l1.decisionDate,
      status: l1.decision === 'APPROVED' ? 'done' : 'rejected',
      actor: `Officier #${l1.approverId}`,
      comment: l1.comment, decision: l1.decision,
    });
  } else {
    steps.push({
      label: 'En traitement', date: null,
      status: isActive('IN_REVIEW') ? 'active' : 'pending',
      actor: req.assignedOfficerId ? `Officier #${req.assignedOfficerId}` : null,
      comment: null, decision: null,
    });
  }

  // Step 2 — Validation L2 (only for L2 requests)
  const l2 = approvals.find(a => a.level === 'L2');
  if (l2 || req.status === 'PENDING_L2') {
    if (l2) {
      steps.push({
        label: 'Validation Finance (L2)', date: l2.decisionDate,
        status: l2.decision === 'APPROVED' ? 'done' : 'rejected',
        actor: `Officier #${l2.approverId}`,
        comment: l2.comment, decision: l2.decision,
      });
    } else {
      steps.push({
        label: 'Validation Finance (L2)', date: null,
        status: isActive('PENDING_L2') ? 'active' : 'pending',
        actor: null, comment: null, decision: null,
      });
    }
  }

  // Final step
  if (req.status === 'APPROVED') {
    steps.push({ label: 'Approuvé', date: req.resolutionDate, status: 'done', actor: null, comment: null, decision: 'APPROVED' });
  } else if (req.status === 'REJECTED') {
    steps.push({ label: 'Refusé', date: req.resolutionDate, status: 'rejected', actor: null, comment: req.closureComment, decision: 'REJECTED' });
  } else {
    steps.push({ label: 'Décision finale', date: null, status: 'pending', actor: null, comment: null, decision: null });
  }

  return steps;
}

@Component({
  selector: 'app-approval-timeline',
  standalone: true,
  template: `
    <ol class="approval-timeline" aria-label="Historique de la demande">
      @for (step of steps(); track $index; let last = $last) {
        <li class="step" [class]="'step--' + step.status">
          <div class="step-dot" [attr.aria-hidden]="true">
            @if (step.status === 'done') {
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            } @else if (step.status === 'rejected' || step.status === 'cancelled') {
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            } @else if (step.status === 'active') {
              <span class="pulse"></span>
            }
          </div>
          @if (!last) { <div class="step-line"></div> }
          <div class="step-content">
            <span class="step-label">{{ step.label }}</span>
            @if (step.date) {
              <span class="step-date">{{ fmtDate(step.date) }}</span>
            }
            @if (step.actor) {
              <span class="step-actor">{{ step.actor }}</span>
            }
            @if (step.comment) {
              <span class="step-comment">"{{ step.comment }}"</span>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: [`
    .approval-timeline { list-style: none; padding: 0; margin: 0; }
    .step {
      display: flex; gap: 14px; position: relative;
      padding-bottom: 20px;
      &:last-child { padding-bottom: 0; }
    }
    .step-dot {
      width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--color-border, #E0E7E9);
      background: var(--color-surface, #fff); z-index: 1;
      .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse .9s infinite; }
    }
    .step-line {
      position: absolute; left: 11px; top: 24px; bottom: 0;
      width: 2px; background: var(--color-border, #E0E7E9); z-index: 0;
    }
    .step-content { flex: 1; padding-top: 2px; display: flex; flex-direction: column; gap: 2px; }
    .step-label   { font-size: 13px; font-weight: 600; }
    .step-date    { font-size: 11px; color: var(--color-text-muted, #6B7280); }
    .step-actor   { font-size: 11px; color: var(--color-text-muted, #6B7280); }
    .step-comment { font-size: 12px; color: var(--color-text-muted, #6B7280); font-style: italic; }

    /* Status variants */
    .step--done      .step-dot { border-color: #16A34A; background: #16A34A; color: #fff; }
    .step--done      .step-label { color: #16A34A; }
    .step--rejected  .step-dot  { border-color: #DC2626; background: #DC2626; color: #fff; }
    .step--rejected  .step-label { color: #DC2626; }
    .step--cancelled .step-dot  { border-color: #94A3B8; background: #94A3B8; color: #fff; }
    .step--cancelled .step-label { color: #94A3B8; }
    .step--active    .step-dot  { border-color: var(--color-primary, #1C4E5C); color: var(--color-primary, #1C4E5C); }
    .step--active    .step-label { color: var(--color-primary, #1C4E5C); font-weight: 700; }
    .step--done      .step-line { background: #16A34A; }

    @keyframes pulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.4); opacity:.6; } }
  `],
})
export class ApprovalTimelineComponent {
  request = input.required<EmployeeRequest>();
  steps   = () => buildSteps(this.request());

  fmtDate(iso: string | null): string {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  }
}
