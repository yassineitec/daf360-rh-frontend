import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';
import { BadgeOptions } from '@khalilrebhiitec/daf360';

import { CandidateService } from '../candidates/candidate.service';
import { CandidateHistoryItem } from '../candidates/candidate.model';
import { candidateAvatar } from '../candidates/candidate-display';
import { HistoryTableComponent } from '../../shared/history/history-table.component';
import { HistoryEntry, HistoryLabels } from '../../shared/history/history.model';

/** Badge colour of each outcome; an unknown code is neutral. */
const STATUS_VARIANT: Record<string, BadgeOptions['variant']> = {
  PENDING: 'neutral', ACCEPTED: 'success', OFFER_SENT: 'warning', OFFER_DRAFT: 'warning',
  HR_IN_PROGRESS: 'info', IT_IN_PROGRESS: 'info', EMAIL_RECEIVED: 'teal', HIRED: 'success',
  REJECTED: 'danger', ARCHIVED: 'neutral',
  PLANNED: 'info', PV_FILED: 'teal', PASS: 'success', FAIL: 'danger', CANCELLED: 'neutral',
  FINANCE_PENDING: 'warning', FINANCE_APPROVED: 'success', FINANCE_REJECTED: 'danger',
  IT_EMAIL_CREATED: 'teal', IT_COMPLETED: 'success', PROFILE_CREATED: 'success', DRAFT_SAVED: 'info',
};

const CATEGORY_VARIANT: Record<string, BadgeOptions['variant']> = {
  CANDIDATE: 'primary', INTERVIEW: 'info', OFFER: 'warning', FINANCE: 'secondary', ONBOARDING: 'teal',
};

/** Detail keys never shown: technical, or rendered through another key. */
const HIDDEN_DETAILS = new Set(['interviewTypeEn', 'sequence']);

/** The candidate lines in the shared history shape. */
function toEntry(h: CandidateHistoryItem): HistoryEntry {
  return {
    id: h.id, timestamp: h.timestamp, category: h.category, action: h.action,
    actorId: h.performedByUserId, actorName: h.performedByName,
    status: h.status, comment: h.comment, details: h.details,
    subjectId: h.candidateId, subjectName: h.candidateName, subjectSubtitle: h.candidatePosition,
    subjectGender: h.candidateGender,
  };
}

/**
 * /rh/candidates/historique — « Historique » tab of the Candidats page: every action on every
 * candidature of the user's entities, with who took it. The table is the shared
 * `rh-history-table`; this tab brings the candidate labels (actions, statuses, details) it
 * needs. The page around it — title, « Nouveau candidat », KPIs, tab strip — is
 * CandidatesPageComponent's, drawn once for every tab.
 */
@Component({
  selector: 'rh-candidates-history',
  standalone: true,
  imports: [HistoryTableComponent],
  // A tab of CandidatesPageComponent: it joins the page's own flex column.
  host: { style: 'display: contents' },
  template: `
    <rh-history-table
      [source]="source"
      [labels]="labels"
      [avatar]="avatar"
      (open)="open($event)" />
  `,
})
export class CandidatesHistoryComponent {
  private readonly svc         = inject(CandidateService);
  private readonly translate   = inject(TranslateService);
  private readonly router      = inject(Router);

  readonly source = (from: string | null, to: string | null): Observable<HistoryEntry[]> =>
    this.svc.getGlobalHistory(from, to).pipe(map(list => (list ?? []).map(toEntry)));

  readonly avatar = (e: HistoryEntry) => candidateAvatar(e.subjectGender);

  open(e: HistoryEntry): void {
    this.router.navigate(['/rh/candidates', e.subjectId]);
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  /** Translation if there is one, else the fallback (a missing key comes back as itself). */
  private tr(key: string, fallback: string, params?: Record<string, unknown>): string {
    const v = this.translate.instant(key, params);
    return v && v !== key ? v : fallback;
  }

  private locale(): string {
    return this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
  }

  readonly labels: HistoryLabels = {
    subject:  () => this.translate.instant('CANDIDATES.HISTORY.COL_CANDIDATE'),
    subtitle: () => this.translate.instant('CANDIDATES.HISTORY.COL_POSITION'),
    action:   e => this.tr('CANDIDATES.HISTORY.ACTION.' + e.action, e.action),
    category: c => this.tr('CANDIDATES.HISTORY.CATEGORY.' + c, c),
    status:   c => this.tr('CANDIDATES.HISTORY.STATUS.' + c, this.tr('CANDIDATES.STATUS.' + c, c)),
    categoryVariant: c => CATEGORY_VARIANT[c] ?? 'neutral',
    statusVariant:   c => STATUS_VARIANT[c] ?? 'neutral',
    detail:   e => this.detailText(e),
  };

  /** The facts of the action, then what the actor typed — one readable line. */
  private detailText(h: HistoryEntry): string {
    const parts: string[] = [];
    const d = h.details ?? {};
    const en = this.translate.currentLang() === 'en';
    for (const [k, v] of Object.entries(d)) {
      if (HIDDEN_DETAILS.has(k) || !v) continue;
      switch (k) {
        case 'interviewType':
          parts.push((en && d['interviewTypeEn']) || v);
          break;
        case 'scheduledAt': {
          const date = new Date(v);
          const value = isNaN(date.getTime()) ? v : date.toLocaleString(this.locale(),
            { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.scheduledAt', v, { value }));
          break;
        }
        case 'opinion':
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.opinion', v,
            { value: this.tr('CANDIDATES.HISTORY.OPINION.' + v, v) }));
          break;
        case 'proposedBy':
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.proposedBy', v,
            { value: this.tr('CANDIDATES.HISTORY.PROPOSED_BY.' + v, v) }));
          break;
        case 'proposedSalary':
        case 'counterSalary': {
          const n = Number(v);
          const value = isNaN(n) ? v : n.toLocaleString(this.locale());
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.' + k, k + ' : ' + value, { value }));
          break;
        }
        default:
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.' + k, k + ' : ' + v, { value: v }));
      }
    }
    if (h.comment) parts.push('« ' + h.comment + ' »');
    return parts.join(' · ');
  }
}
