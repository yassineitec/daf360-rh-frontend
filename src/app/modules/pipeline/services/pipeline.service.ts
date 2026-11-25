import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { paysHttpParam } from '../../../core/header-pays';

export interface PipelineStats {
  totalCandidats: number;
  enEntretien: number;
  scoreMoyen: number;
  recrutementsClos: number;
  delaiMoyenJours: number;
  urgents: number;
}

export interface KanbanCandidate {
  id: number;
  fullName: string;
  initials?: string;
  photoUrl?: string;
  gender?: string;
  poste: string;
  fitScore: number;
  badge: string;
  badgeType: 'urgent' | 'top' | 'new' | 'in_progress' | 'offer' | 'hired' | 'rejected';
  experience?: string;
  location?: string;
  skills: string[];
  note?: string;
  nextEvent?: string;
  salary?: string;
  isUrgent: boolean;
  stage: string;
  stageLabel?: string;
  applicationDate?: string;
  email?: string;
  status?: string;
  contractType?: string;
  /** Workflow progress (%) for the current phase: IT provisioning (OFFRE) or HR onboarding. */
  progressPercent?: number | null;
  // ── Entretien column ──
  interviewLocation?: string;
  // ── Offre column ──
  askedSalary?: string;
  proposedSalary?: string;
  offerExpiry?: string;
  /** Current offer round's status: DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED. */
  offerStatus?: string;
  /**
   * The vacancy this candidature answers. Null = spontaneous application, which the card
   * renders as such rather than leaving blank.
   */
  demandId?: number | null;
  demandTitle?: string | null;
  /** Préavis négocié on the offer, in calendar days; null when not discussed. */
  offerNoticePeriodDays?: number | null;
  /**
   * The applied grade's default préavis — what the offer form starts from, so a derogation
   * is visible as one. Null when the grade has no default configured.
   */
  gradeNoticePeriodDays?: number | null;
  /** Raw parts of `nextEvent` (French-formatted server-side) — the card relabels them per language. */
  nextInterviewAt?: string | null;
  nextInterviewType?: string | null;
  nextInterviewTypeEn?: string | null;
  // ── Recruitment step (same facts as the candidate page's rail) ──
  /** Live interviews (CANCELLED excluded). */
  interviewsTotal?: number;
  /** Of those, with a PV filed (DONE). */
  interviewsFiled?: number;
  /** Of those, validated by RH (result set). */
  interviewsValidated?: number;
  /** Who proposed the current offer round: RH | DAF | CANDIDATE. */
  offerProposedBy?: string | null;
  offerRound?: number | null;
  /** The IT file's status (PENDING | IN_PROGRESS | EMAIL_CREATED | COMPLETED); null = none. */
  itStatus?: string | null;
  /**
   * Every post of the demand is filled (V137): this candidature can no longer be hired and is
   * archived on this day (yyyy-MM-dd, its creation date + 30 days). Null while a post is open.
   */
  archiveDueDate?: string | null;
}

/** An archived candidature with why it was archived (V137) — the board's « Archivés » column. */
export interface ArchivedCandidate {
  id: number;
  fullName: string;
  gender?: string | null;
  position?: string | null;
  demandId?: number | null;
  demandTitle?: string | null;
  /** POSITION_FILLED | DEMAND_CLOSED | MANUAL, null for a candidature archived before V137. */
  archiveReason?: 'POSITION_FILLED' | 'DEMAND_CLOSED' | 'MANUAL' | null;
  archiveNote?: string | null;
  /** The status it had when archived (PENDING, OFFER_SENT, HIRED…). */
  archivedFromStatus?: string | null;
  /** ISO local date-time. */
  archivedAt?: string | null;
  archivedByName?: string | null;
  rejectionReason?: string | null;
  email?: string | null;
}

export interface KanbanColumn {
  stage: string;
  stageLabel: string;
  count: number;
  candidates: KanbanCandidate[];
}

export interface CandidatesPage {
  content: KanbanCandidate[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface CandidateParams {
  page?: number;
  size?: number;
  stage?: string;
  search?: string;
  /** Drapeaux de la navbar (`179,64`). */
  paysId?: string;
}

export interface PipelineActivity {
  id: number;
  candidateId: number;
  candidateName: string;
  action: string;
  actionLabel: string;
  stage: string;
  timestamp: string;
  performedBy: string;
}

export interface PipelineObjective {
  month: string;
  monthLabel: string;
  target: number;
  actual: number;
}

@Injectable({ providedIn: 'root' })
export class PipelineService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/pipeline`;

  /** `pays` : drapeaux de la navbar (`179,64`) — voir core/header-pays.ts ; absent = tout le périmètre. */
  getStats(pays?: string): Observable<PipelineStats> {
    return this.http.get<PipelineStats>(`${this.base}/stats`, { params: paysHttpParam(pays) });
  }

  getKanban(pays?: string): Observable<KanbanColumn[]> {
    return this.http.get<KanbanColumn[]>(`${this.base}/kanban`, { params: paysHttpParam(pays) });
  }

  /** Every archived candidature of the caller's entity, newest first, with its reason (V137). */
  getArchived(): Observable<ArchivedCandidate[]> {
    return this.http.get<ArchivedCandidate[]>(`${this.base}/archived`);
  }

  getCandidates(params: CandidateParams = {}): Observable<CandidatesPage> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page);
    if (params.size  !== undefined) httpParams = httpParams.set('size',  params.size);
    if (params.stage)  httpParams = httpParams.set('stage',  params.stage);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.paysId) httpParams = httpParams.set('paysId', params.paysId);
    return this.http.get<CandidatesPage>(`${this.base}/candidates`, { params: httpParams });
  }

  moveToStage(id: number, stage: string): Observable<KanbanCandidate> {
    return this.http.put<KanbanCandidate>(`${this.base}/candidates/${id}/stage`, stage);
  }

  getActivity(pays?: string): Observable<PipelineActivity[]> {
    return this.http.get<PipelineActivity[]>(`${this.base}/activity`, { params: paysHttpParam(pays) });
  }

  getObjectives(pays?: string): Observable<PipelineObjective[]> {
    return this.http.get<PipelineObjective[]>(`${this.base}/objectives`, { params: paysHttpParam(pays) });
  }
}
