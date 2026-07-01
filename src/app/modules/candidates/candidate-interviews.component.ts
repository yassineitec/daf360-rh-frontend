import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserStore } from '../../core/user.store';
import { InterviewService } from './interview.service';
import {
  CandidateInterview,
  CreateInterviewRequest,
  InterviewType,
  UpdateInterviewRequest,
  UserPickerItem,
} from './interview.model';

type UpdateAction = 'DONE_PASS' | 'DONE_FAIL' | 'CANCELLED';

@Component({
  selector: 'app-candidate-interviews',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-xl border border-outline-variant p-5">

      <!-- Section header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2" style="color:#50717b">
          <span class="material-symbols-outlined text-[18px]">record_voice_over</span>
          <h3 class="text-[12px] font-semibold uppercase tracking-wider">Entretiens</h3>
          @if (interviews().length) {
            <span class="px-1.5 py-0.5 rounded-full text-[11px] font-bold"
                  style="background:rgba(28,78,92,0.1);color:#1C4E5C">
              {{ interviews().length }}
            </span>
          }
        </div>
        @if (canManage() && !showForm()) {
          <button type="button"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
                  style="background:#1C4E5C"
                  (click)="openForm()">
            <span class="material-symbols-outlined text-[14px]">add</span>
            Planifier
          </button>
        }
      </div>

      <!-- Error banner -->
      @if (error()) {
        <div class="flex items-center justify-between p-3 mb-3 rounded-lg text-[12px]"
             style="background:#FEF2F2;color:#BA1A1A;border:1px solid #FECACA">
          <span>{{ error() }}</span>
          <button type="button" class="ml-2 font-bold text-[14px] leading-none"
                  (click)="error.set(null)">×</button>
        </div>
      }

      <!-- Schedule form -->
      @if (showForm()) {
        <div class="p-4 mb-4 rounded-xl" style="background:#f0f6f8;border:1px solid #d4e3e8">
          <p class="text-[12px] font-semibold text-on-surface mb-3">Planifier un entretien</p>

          @if (typesLoading()) {
            <div class="flex items-center gap-2 py-2 text-[12px] text-outline">
              <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Chargement des types...
            </div>
          } @else if (!activeTypes().length) {
            <p class="text-[12px] text-outline py-2">
              Aucun type d'entretien actif disponible. Configurez-en dans l'Administration.
            </p>
          } @else {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="text-[11px] font-semibold text-outline uppercase tracking-wide block mb-1">
                  Type *
                </label>
                <select class="w-full px-3 py-2 border border-outline-variant rounded-lg text-[13px]
                               text-on-surface bg-white"
                        [(ngModel)]="formTypeId">
                  <option [ngValue]="0" disabled>— Sélectionner —</option>
                  @for (t of activeTypes(); track t.id) {
                    <option [ngValue]="t.id">{{ t.name }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="text-[11px] font-semibold text-outline uppercase tracking-wide block mb-1">
                  Date &amp; Heure *
                </label>
                <input type="datetime-local"
                       class="w-full px-3 py-2 border border-outline-variant rounded-lg text-[13px]
                              text-on-surface bg-white"
                       [(ngModel)]="formScheduledAt" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-outline uppercase tracking-wide block mb-1">
                  Lieu
                </label>
                <input type="text"
                       class="w-full px-3 py-2 border border-outline-variant rounded-lg text-[13px]
                              text-on-surface bg-white"
                       [(ngModel)]="formLocation"
                       placeholder="Ex : Salle A, Zoom…" maxlength="255" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-outline uppercase tracking-wide block mb-1">
                  Notes (optionnel)
                </label>
                <input type="text"
                       class="w-full px-3 py-2 border border-outline-variant rounded-lg text-[13px]
                              text-on-surface bg-white"
                       [(ngModel)]="formNotes"
                       placeholder="Commentaire…" maxlength="1000" />
              </div>
              <div class="sm:col-span-2">
                <label class="text-[11px] font-semibold text-outline uppercase tracking-wide block mb-1">
                  Interviewer (optionnel)
                </label>
                @if (usersLoading()) {
                  <p class="text-[12px] text-outline py-1">Chargement…</p>
                } @else {
                  <select class="w-full px-3 py-2 border border-outline-variant rounded-lg text-[13px]
                                 text-on-surface bg-white"
                          [(ngModel)]="formInterviewerId">
                    <option [ngValue]="0">— Aucun —</option>
                    @for (u of users(); track u.id) {
                      <option [ngValue]="u.id">{{ u.fullName }}</option>
                    }
                  </select>
                }
              </div>
            </div>
          }

          @if (formError()) {
            <p class="text-[12px] mt-2" style="color:#BA1A1A">{{ formError() }}</p>
          }
          <div class="flex justify-end gap-2 mt-3">
            <button type="button"
                    class="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-outline-variant
                           bg-white text-outline"
                    (click)="cancelForm()">Annuler</button>
            <button type="button"
                    class="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
                    style="background:#1C4E5C"
                    [disabled]="formLoading() || !activeTypes().length"
                    (click)="submitCreate()">
              {{ formLoading() ? 'Enregistrement...' : 'Planifier' }}
            </button>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex justify-center py-6">
          <span class="material-symbols-outlined text-[28px] text-outline animate-spin">
            progress_activity
          </span>
        </div>
      }

      <!-- Timeline -->
      @else if (interviews().length) {
        <div class="space-y-3">
          @for (iv of interviews(); track iv.id; let last = $last) {
            <div class="relative pl-7">
              <!-- Connector line -->
              @if (!last) {
                <div class="absolute left-2.5 top-5 w-px"
                     style="bottom:-12px;background:#E0E7E9"></div>
              }
              <!-- Step dot -->
              <div class="absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center"
                   [style.background]="dotBg(iv.status)"
                   [style.color]="dotColor(iv.status)">
                <span class="material-symbols-outlined text-[11px]"
                      style="font-variation-settings:'FILL' 1">
                  {{ dotIcon(iv.status) }}
                </span>
              </div>

              <!-- Interview card -->
              <div class="border rounded-xl p-3.5"
                   [style.border-color]="cardBorder(iv.status)"
                   [style.background]="cardBg(iv.status)">

                <div class="flex items-start justify-between gap-2 flex-wrap">

                  <!-- Info left -->
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[13px] font-semibold text-on-surface">
                        #{{ iv.sequenceNumber }} — {{ iv.interviewTypeName }}
                      </span>
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            [style.background]="statusBadgeBg(iv.status)"
                            [style.color]="statusBadgeColor(iv.status)">
                        {{ statusLabel(iv.status) }}
                      </span>
                      @if (iv.result) {
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold"
                              [style.background]="iv.result === 'PASS'
                                ? 'rgba(34,197,94,0.12)' : 'rgba(186,26,26,0.1)'"
                              [style.color]="iv.result === 'PASS' ? '#16a34a' : '#BA1A1A'">
                          {{ iv.result === 'PASS' ? '✓ Validé' : '✗ Non validé' }}
                        </span>
                      }
                    </div>
                    <div class="flex items-center gap-3 mt-1 text-[12px] text-outline flex-wrap">
                      <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[13px]">schedule</span>
                        {{ formatDate(iv.scheduledAt) }}
                      </span>
                      @if (iv.location) {
                        <span class="flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px]">location_on</span>
                          {{ iv.location }}
                        </span>
                      }
                      @if (iv.interviewerName) {
                        <span class="flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px]">person</span>
                          {{ iv.interviewerName }}
                        </span>
                      }
                    </div>
                    @if (iv.interviewerNotes) {
                      <p class="text-[12px] text-outline mt-1.5 leading-snug">
                        {{ iv.interviewerNotes }}
                      </p>
                    }
                  </div>

                  <!-- Action buttons (PLANNED only) -->
                  @if (canManage() && iv.status === 'PLANNED' && updatingId() !== iv.id) {
                    <div class="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                      <button type="button"
                              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                              style="border-color:#22c55e;color:#16a34a;background:rgba(34,197,94,0.06)"
                              (click)="openUpdate(iv, 'DONE_PASS')">
                        Réussi
                      </button>
                      <button type="button"
                              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                              style="border-color:#f97316;color:#c2410c;background:rgba(249,115,22,0.06)"
                              (click)="openUpdate(iv, 'DONE_FAIL')">
                        Échoué
                      </button>
                      <button type="button"
                              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border
                                     border-outline-variant"
                              style="color:#6B7280;background:rgba(0,0,0,0.02)"
                              (click)="openUpdate(iv, 'CANCELLED')">
                        Annuler
                      </button>
                    </div>
                  }
                </div>

                <!-- Inline update confirm -->
                @if (updatingId() === iv.id) {
                  <div class="mt-3 pt-3 border-t border-outline-variant">
                    <div class="flex items-end gap-3 flex-wrap">
                      <div class="flex-1" style="min-width:180px">
                        <label class="text-[11px] font-semibold text-outline uppercase
                                      tracking-wide block mb-1">Notes (optionnel)</label>
                        <input type="text"
                               class="w-full px-2.5 py-1.5 border border-outline-variant
                                      rounded-lg text-[13px] bg-white"
                               [(ngModel)]="updateNotes"
                               placeholder="Commentaire…" maxlength="1000" />
                      </div>
                    </div>
                    @if (updateError()) {
                      <p class="text-[12px] mt-1.5" style="color:#BA1A1A">{{ updateError() }}</p>
                    }
                    <div class="flex gap-2 mt-2">
                      <button type="button"
                              class="px-3 py-1.5 rounded-lg text-[12px] font-medium border
                                     border-outline-variant bg-white text-outline"
                              (click)="cancelUpdate()">Annuler</button>
                      <button type="button"
                              class="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
                              [style.background]="updateBtnColor()"
                              [disabled]="updateLoading()"
                              (click)="submitUpdate(iv)">
                        {{ updateLoading() ? 'En cours...' : updateActionLabel() }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Empty state -->
      @else if (!loading()) {
        <div class="flex flex-col items-center justify-center py-8 gap-2">
          <span class="material-symbols-outlined text-[32px] text-outline">event_upcoming</span>
          <p class="text-[13px] text-outline">Aucun entretien planifié pour ce candidat.</p>
        </div>
      }
    </div>
  `,
})
export class CandidateInterviewsComponent implements OnInit {
  @Input() candidateId!: number;
  @Input() paysId!: number;

  private svc = inject(InterviewService);
  private userStore = inject(UserStore);

  interviews   = signal<CandidateInterview[]>([]);
  activeTypes  = signal<InterviewType[]>([]);
  loading      = signal(true);
  typesLoading = signal(false);
  error        = signal<string | null>(null);

  canManage = computed(() =>
    this.userStore.hasPermission('RH_MANAGE_INTERVIEWS') ||
    this.userStore.hasPermission('RH_ADMIN_INTERVIEW_TYPES') ||
    this.userStore.isAdmin(),
  );

  // ── Create form ─────────────────────────────────────────────────────────────
  showForm     = signal(false);
  formLoading  = signal(false);
  formError    = signal<string | null>(null);
  formTypeId       = 0;
  formScheduledAt  = '';
  formLocation     = '';
  formNotes        = '';
  formInterviewerId = 0;

  users        = signal<UserPickerItem[]>([]);
  usersLoading = signal(false);

  // ── Update inline ────────────────────────────────────────────────────────────
  updatingId    = signal<number | null>(null);
  updateAction  = signal<UpdateAction | null>(null);
  updateLoading = signal(false);
  updateError   = signal<string | null>(null);
  updateNotes   = '';

  readonly updateActionLabel = computed(() => {
    const a = this.updateAction();
    if (a === 'DONE_PASS') return 'Confirmer — Réussi';
    if (a === 'DONE_FAIL') return 'Confirmer — Échoué';
    if (a === 'CANCELLED') return "Confirmer l'annulation";
    return 'Confirmer';
  });

  readonly updateBtnColor = computed(() => {
    const a = this.updateAction();
    if (a === 'DONE_PASS') return '#16a34a';
    if (a === 'DONE_FAIL') return '#c2410c';
    return '#6B7280';
  });

  ngOnInit(): void { this.loadInterviews(); }

  private loadInterviews(): void {
    this.loading.set(true);
    this.svc.listByCandidate(this.candidateId).subscribe({
      next:  iv => { this.interviews.set(iv); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les entretiens.'); this.loading.set(false); },
    });
  }

  openForm(): void {
    this.formTypeId = 0; this.formScheduledAt = '';
    this.formLocation = ''; this.formNotes = ''; this.formInterviewerId = 0;
    this.formError.set(null); this.showForm.set(true);
    if (!this.activeTypes().length) {
      this.typesLoading.set(true);
      this.svc.getActiveTypes(this.paysId).subscribe({
        next:  t  => { this.activeTypes.set(t); this.typesLoading.set(false); },
        error: () => { this.error.set('Impossible de charger les types disponibles.'); this.typesLoading.set(false); },
      });
    }
    if (!this.users().length) {
      this.usersLoading.set(true);
      this.svc.getInterviewUsers(this.paysId).subscribe({
        next:  u  => { this.users.set(u); this.usersLoading.set(false); },
        error: () => { this.usersLoading.set(false); },
      });
    }
  }

  cancelForm(): void { this.showForm.set(false); }

  submitCreate(): void {
    if (!this.formTypeId) { this.formError.set("Sélectionnez un type d'entretien."); return; }
    if (!this.formScheduledAt) { this.formError.set("La date et l'heure sont obligatoires."); return; }
    this.formLoading.set(true); this.formError.set(null);
    const dto: CreateInterviewRequest = {
      interviewTypeId: this.formTypeId,
      scheduledAt: this.formScheduledAt + ':00+00:00',
      location: this.formLocation.trim() || undefined,
      interviewerNotes: this.formNotes.trim() || undefined,
      interviewerUserId: this.formInterviewerId || undefined,
    };
    this.svc.createInterview(this.candidateId, dto).subscribe({
      next:  () => { this.formLoading.set(false); this.showForm.set(false); this.loadInterviews(); },
      error: err => { this.formLoading.set(false); this.formError.set(err?.error?.detail ?? 'Erreur lors de la planification.'); },
    });
  }

  openUpdate(iv: CandidateInterview, action: UpdateAction): void {
    this.updatingId.set(iv.id); this.updateAction.set(action);
    this.updateNotes = ''; this.updateError.set(null);
  }

  cancelUpdate(): void { this.updatingId.set(null); this.updateAction.set(null); }

  submitUpdate(iv: CandidateInterview): void {
    const action = this.updateAction();
    if (!action) return;
    this.updateLoading.set(true); this.updateError.set(null);
    const dto: UpdateInterviewRequest = action === 'CANCELLED'
      ? { status: 'CANCELLED', interviewerNotes: this.updateNotes.trim() || undefined }
      : { status: 'DONE', result: action === 'DONE_PASS' ? 'PASS' : 'FAIL',
          interviewerNotes: this.updateNotes.trim() || undefined };
    this.svc.updateInterview(this.candidateId, iv.id, dto).subscribe({
      next: updated => {
        this.interviews.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.updateLoading.set(false); this.updatingId.set(null); this.updateAction.set(null);
      },
      error: err => { this.updateLoading.set(false); this.updateError.set(err?.error?.detail ?? 'Erreur lors de la mise à jour.'); },
    });
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  statusLabel(s: string): string {
    return s === 'PLANNED' ? 'Planifié' : s === 'DONE' ? 'Terminé' : 'Annulé';
  }

  statusBadgeBg(s: string): string {
    return s === 'PLANNED' ? 'rgba(28,78,92,0.1)' : s === 'DONE' ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.05)';
  }

  statusBadgeColor(s: string): string {
    return s === 'PLANNED' ? '#1C4E5C' : s === 'DONE' ? '#16a34a' : '#9CA3AF';
  }

  dotBg(s: string): string {
    return s === 'PLANNED' ? '#E0F2F7' : s === 'DONE' ? 'rgba(34,197,94,0.15)' : '#F3F4F6';
  }

  dotColor(s: string): string {
    return s === 'PLANNED' ? '#1C4E5C' : s === 'DONE' ? '#16a34a' : '#9CA3AF';
  }

  dotIcon(s: string): string {
    return s === 'PLANNED' ? 'event' : s === 'DONE' ? 'check_circle' : 'cancel';
  }

  cardBorder(s: string): string { return s === 'CANCELLED' ? '#E5E7EB' : '#E0E7E9'; }

  cardBg(s: string): string { return s === 'CANCELLED' ? '#FAFAFA' : '#ffffff'; }
}
