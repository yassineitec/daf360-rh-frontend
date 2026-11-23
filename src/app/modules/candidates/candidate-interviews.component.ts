import { Component, Input, OnInit, computed, inject, input, output, signal } from '@angular/core';
import {
  AvatarComponent,
  AvatarData,
  AvatarGroupComponent,
  BadgeOptions,
  ButtonComponent,
  FormFieldComponent,
  MultiDatePickerComponent,
  SelectComponent,
  SelectOption,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { UserStore } from '../../core/user.store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { dateToIso } from '../../shared/date-picker.utils';
import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { InterviewService } from './interview.service';
import {
  CandidateInterview,
  CreateInterviewRequest,
  InterviewOpinion,
  InterviewReport,
  InterviewResult,
  InterviewType,
  interviewTypeLabel,
  UpdateInterviewRequest,
  UserPickerItem,
} from './interview.model';

/** Only cancelling is manual now (V132): DONE comes from a PV, PASS / FAIL from RH. */
type UpdateAction = 'CANCELLED';

const OPINIONS: InterviewOpinion[] = ['FAVORABLE', 'RESERVED', 'UNFAVORABLE'];

const pad2 = (n: number): string => String(n).padStart(2, '0');

@Component({
  selector: 'app-candidate-interviews',
  standalone: true,
  imports: [
    AvatarComponent,
    AvatarGroupComponent,
    ButtonComponent,
    SectionCardComponent,
    SelectComponent,
    FormFieldComponent,
    MultiDatePickerComponent,
    StatusBadgeComponent,
    TranslatePipe,
  ],
  template: `
    <!-- rh-section-card, not a bespoke daf-card: /rh/candidates/:id and
         /rh/profiles/:id share one section shell, so no panel can drift on
         padding, heading size or icon placement (UI-PLAYBOOK §10f). -->
    <rh-section-card
      [title]="'CANDIDATES.INTERVIEWS.TITLE' | translate"
      icon="record_voice_over">

      <div sectionAction class="flex items-center gap-2">
        @if (interviews().length) {
          <daf-badge [label]="interviews().length + ''" [options]="{ variant: 'teal', size: 'sm' }" />
        }
        @if (canManage() && !showForm()) {
          <daf-button [label]="'CANDIDATES.INTERVIEWS.SCHEDULE' | translate" variant="teal"
            [options]="{ iconStart: 'add', size: 'sm' }"
            (onClick)="openForm()" />
        }
      </div>

      <!-- Error banner -->
      @if (error()) {
        <div class="flex items-center justify-between p-3 mb-3 rounded-lg text-[12px]"
             style="background:var(--color-error-container);color:var(--color-danger);border:1px solid var(--color-outline-variant)">
          <span>{{ error() }}</span>
          <button type="button" class="ml-2 font-bold text-[14px] leading-none"
                  (click)="error.set(null)">×</button>
        </div>
      }

      <!-- Schedule form -->
      @if (showForm()) {
        <div class="p-4 mb-4 rounded-xl" style="background:var(--color-surface-container-low);border:1px solid var(--color-outline-variant)">
          <p class="text-[12px] font-semibold text-on-surface mb-3">
            {{ (editingId() ? 'CANDIDATES.INTERVIEWS.EDIT_TITLE' : 'CANDIDATES.INTERVIEWS.SCHEDULE_TITLE') | translate }}
          </p>

          @if (typesLoading()) {
            <div class="flex items-center gap-2 py-2 text-[12px] text-outline">
              <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              {{ 'CANDIDATES.INTERVIEWS.LOADING_TYPES' | translate }}
            </div>
          } @else if (!activeTypes().length) {
            <p class="text-[12px] text-outline py-2">
              {{ 'CANDIDATES.INTERVIEWS.NO_TYPES' | translate }}
            </p>
          } @else {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <daf-select
                [selected]="typeSelected()"
                [options]="typeOptions()"
                [config]="{ label: ('CANDIDATES.INTERVIEWS.TYPE' | translate), required: true, placeholder: ('CANDIDATES.COMMON.SELECT_PLACEHOLDER' | translate), fullWidth: true, searchable: true }"
                (selectedChange)="onTypeChange($event)" />

              <daf-multi-date-picker
                [value]="formDate()"
                [config]="{ label: ('CANDIDATES.INTERVIEWS.DATE' | translate), placeholder: ('CANDIDATES.COMMON.SELECT' | translate), required: true, selectionMode: 'single' }"
                (valueChange)="onDateChange($event)" />

              <daf-form-field
                [value]="formTime()"
                [options]="{ label: ('CANDIDATES.INTERVIEWS.TIME' | translate), type: 'time', fullWidth: true }"
                (valueChange)="formTime.set($any($event) ?? '')" />

              <daf-form-field
                [value]="formLocation()"
                [options]="{ label: ('CANDIDATES.INTERVIEWS.LOCATION' | translate), placeholder: ('CANDIDATES.INTERVIEWS.LOCATION_PLACEHOLDER' | translate), maxLength: 255, fullWidth: true }"
                (valueChange)="formLocation.set($any($event) ?? '')" />

              <div class="sm:col-span-2">
                <daf-form-field
                  [value]="formNotes()"
                  [options]="{ label: ('CANDIDATES.INTERVIEWS.NOTES_OPTIONAL' | translate), placeholder: ('CANDIDATES.COMMON.COMMENT_PLACEHOLDER' | translate), maxLength: 1000, fullWidth: true }"
                  (valueChange)="formNotes.set($any($event) ?? '')" />
              </div>

              <!-- Panel: several interviewers can sit on the same interview. The
                   first one picked stays the lead (calendar owner, list column). -->
              <div class="sm:col-span-2">
                @if (usersLoading()) {
                  <p class="text-[12px] text-outline py-1">{{ 'CANDIDATES.COMMON.LOADING' | translate }}</p>
                } @else {
                  <daf-select
                    [selected]="interviewerSelected()"
                    [options]="interviewerOptions()"
                    [config]="{ label: ('CANDIDATES.INTERVIEWS.INTERVIEWERS' | translate), placeholder: ('CANDIDATES.INTERVIEWS.INTERVIEWERS_PLACEHOLDER' | translate), fullWidth: true, searchable: true, multiple: true }"
                    (selectedChange)="onInterviewersChange($event)" />
                  @if (formInterviewerIds().length) {
                    <div class="flex flex-wrap gap-1.5 mt-2">
                      @for (u of selectedInterviewers(); track u.id) {
                        <span class="inline-flex items-center gap-1 pl-0.5 pr-1 py-0.5 rounded-full text-[11px]"
                              style="background:var(--color-tertiary-container);color:var(--color-tertiary)">
                          <!-- Même primitive que la liste : on reconnaît la même personne
                               d'un écran à l'autre par la même pastille. -->
                          <daf-avatar [data]="{ name: u.fullName }" size="xs" [showTooltip]="false" />
                          {{ u.fullName }}
                          <button type="button" class="material-symbols-outlined text-[13px] leading-none"
                                  [attr.aria-label]="'CANDIDATES.COMMON.REMOVE' | translate"
                                  (click)="removeInterviewer(u.id)">close</button>
                        </span>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          }

          @if (formError()) {
            <p class="text-[12px] mt-2" style="color:var(--color-danger)">{{ formError() }}</p>
          }
          <div class="flex justify-end gap-2 mt-3">
            <daf-button [label]="'CANDIDATES.COMMON.CANCEL' | translate" variant="ghost" [options]="{ size: 'sm' }"
              (onClick)="cancelForm()" />
            <daf-button
              [label]="(editingId() ? 'CANDIDATES.COMMON.SAVE' : 'CANDIDATES.INTERVIEWS.SCHEDULE') | translate"
              variant="teal"
              [options]="{ size: 'sm', loading: formLoading(), disabled: formLoading() || !activeTypes().length }"
              (onClick)="submitForm()" />
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
                     style="bottom:-12px;background:var(--color-outline-variant)"></div>
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
                   [style.border-color]="cardBorder()"
                   [style.background]="cardBg(iv.status)">

                <div class="flex items-start justify-between gap-2 flex-wrap">

                  <!-- Info left -->
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[13px] font-semibold text-on-surface">
                        #{{ iv.sequenceNumber }} — {{ typeLabel(iv) }}
                      </span>
                      <daf-badge [label]="statusLabel(iv.status)" [options]="statusBadgeOptions(iv.status)" />
                      @if (iv.status === 'DONE' && !iv.result) {
                        <daf-badge [label]="'CANDIDATES.INTERVIEWS.PV.TO_VALIDATE' | translate"
                                   [options]="{ variant: 'warning', size: 'sm' }" />
                      }
                      @if (iv.result) {
                        <daf-badge [label]="(iv.result === 'PASS' ? 'CANDIDATES.INTERVIEWS.RESULT_PASS' : 'CANDIDATES.INTERVIEWS.RESULT_FAIL') | translate"
                                   [options]="resultBadgeOptions(iv.result)" />
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
                      @if (iv.graphJoinUrl) {
                        <a [href]="iv.graphJoinUrl" target="_blank" rel="noopener"
                           class="flex items-center gap-1 text-primary hover:underline">
                          <span class="material-symbols-outlined text-[13px]">videocam</span>
                          {{ 'CANDIDATES.INTERVIEWS.JOIN_TEAMS' | translate }}
                        </a>
                      }
                      <!-- Le panel en pastilles : daf-avatar-group empile les intervieweurs
                           et son panneau au survol les nomme TOUS, y compris ceux repliés
                           dans le « +N » — ce qu'une simple liste « Alice, Bob, … » ne fait
                           pas sans faire déborder la ligne.
                           (Pas d'accent grave dans ce commentaire : le gabarit est un
                           littéral encadré par des accents graves, l'un d'eux le
                           refermerait ici.) -->
                      @if (interviewerAvatars(iv).length) {
                        <span class="flex items-center gap-1.5">
                          <daf-avatar-group
                            [members]="interviewerAvatars(iv)"
                            size="xs"
                            [max]="3" />
                        </span>
                      }
                    </div>
                    @if (iv.interviewerNotes) {
                      <p class="text-[12px] text-outline mt-1.5 leading-snug">
                        {{ iv.interviewerNotes }}
                      </p>
                    }
                  </div>

                  <!-- Actions. Edit stays available until the interview is DONE —
                       a finished interview is a record and the backend rejects edits. -->
                  @if (canManage() && iv.status !== 'DONE' && updatingId() !== iv.id) {
                    <div class="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                      <button type="button"
                              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border
                                     border-outline-variant inline-flex items-center gap-1"
                              style="color:var(--color-on-surface-variant);background:var(--color-surface-container-low)"
                              (click)="openEdit(iv)">
                        <span class="material-symbols-outlined text-[13px]">edit</span>
                        {{ 'CANDIDATES.COMMON.EDIT' | translate }}
                      </button>
                    </div>
                  }
                </div>

                <!-- Cancelling is the only manual transition left (V132): DONE comes from
                     the first PV, PASS / FAIL from the RH validation below. -->
                @if (canManage() && iv.status === 'PLANNED' && updatingId() !== iv.id) {
                  <div class="flex items-center gap-1.5 flex-wrap justify-end mt-2">
                    <button type="button"
                            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border
                                   border-outline-variant"
                            style="color:var(--color-on-surface-variant);background:var(--color-surface-container-low)"
                            (click)="openUpdate(iv, 'CANCELLED')">
                      {{ 'CANDIDATES.COMMON.CANCEL' | translate }}
                    </button>
                  </div>
                }

                <!-- Inline update confirm -->
                @if (updatingId() === iv.id) {
                  <div class="mt-3 pt-3 border-t border-outline-variant">
                    <daf-form-field
                      [value]="updateNotes()"
                      [options]="{ label: ('CANDIDATES.INTERVIEWS.NOTES_OPTIONAL' | translate), placeholder: ('CANDIDATES.COMMON.COMMENT_PLACEHOLDER' | translate), maxLength: 1000, fullWidth: true }"
                      (valueChange)="updateNotes.set($any($event) ?? '')" />
                    @if (updateError()) {
                      <p class="text-[12px] mt-1.5" style="color:var(--color-danger)">{{ updateError() }}</p>
                    }
                    <div class="flex gap-2 mt-2">
                      <daf-button [label]="'CANDIDATES.COMMON.CANCEL' | translate" variant="ghost" [options]="{ size: 'sm' }"
                        (onClick)="cancelUpdate()" />
                      <daf-button [label]="updateActionLabel()" variant="teal"
                        [options]="{ size: 'sm', loading: updateLoading(), disabled: updateLoading() }"
                        (onClick)="submitUpdate(iv)" />
                    </div>
                  </div>
                }

                <!-- ── PV & RH validation (V132) ──
                     Each panel member writes their own PV once the interview has started;
                     RH reads them all and decides PASS / FAIL, which is what moves the
                     candidature on. A panel member reads only their own PV. -->
                @if (iv.status !== 'CANCELLED') {
                  <div class="mt-3 pt-3 border-t border-outline-variant flex flex-col gap-3">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <span class="flex items-center gap-1.5 text-[12px] font-semibold text-on-surface">
                        <span class="material-symbols-outlined text-[15px] text-outline">description</span>
                        {{ 'CANDIDATES.INTERVIEWS.PV.TITLE' | translate }}
                        <span class="font-normal text-outline">
                          {{ 'CANDIDATES.INTERVIEWS.PV.COUNT' | translate: { n: iv.reportCount, total: panelSize(iv) } }}
                        </span>
                      </span>
                      @if (iv.canWriteReport && reportFormId() !== iv.id) {
                        <daf-button
                          [label]="(myReport(iv) ? 'CANDIDATES.INTERVIEWS.PV.EDIT' : 'CANDIDATES.INTERVIEWS.PV.WRITE') | translate"
                          variant="teal"
                          [options]="{ size: 'sm', iconStart: 'edit_note' }"
                          (onClick)="openReport(iv)" />
                      }
                    </div>

                    @if (isOnPanel(iv) && iv.status === 'PLANNED' && !iv.canWriteReport) {
                      <p class="flex items-center gap-1.5 text-[12px] text-outline">
                        <span class="material-symbols-outlined text-[14px]">schedule</span>
                        {{ 'CANDIDATES.INTERVIEWS.PV.OPENS_AT_START' | translate }}
                      </p>
                    }

                    <!-- The interviewer's form -->
                    @if (reportFormId() === iv.id) {
                      <div class="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
                        <daf-form-field
                          [value]="reportSummary()"
                          [options]="{ label: ('CANDIDATES.INTERVIEWS.PV.SUMMARY' | translate), type: 'textarea', rows: 6, required: true, maxLength: 4000, fullWidth: true, placeholder: ('CANDIDATES.INTERVIEWS.PV.SUMMARY_PLACEHOLDER' | translate) }"
                          (valueChange)="reportSummary.set($any($event) ?? '')" />
                        <daf-select
                          [selected]="reportOpinion() ? [reportOpinion()!] : []"
                          [options]="opinionOptions()"
                          [config]="{ label: ('CANDIDATES.INTERVIEWS.PV.OPINION' | translate), required: true, placeholder: ('CANDIDATES.COMMON.SELECT_PLACEHOLDER' | translate), fullWidth: true }"
                          (selectedChange)="reportOpinion.set($any($event[0]) || null)" />
                        @if (reportError()) {
                          <p class="text-[12px] text-danger">{{ reportError() }}</p>
                        }
                        <div class="flex justify-end gap-2">
                          <daf-button [label]="'CANDIDATES.COMMON.CANCEL' | translate" variant="ghost"
                            [options]="{ size: 'sm' }" (onClick)="closeReport()" />
                          <daf-button [label]="'CANDIDATES.INTERVIEWS.PV.SUBMIT' | translate" variant="teal"
                            [options]="{ size: 'sm', iconStart: 'send', loading: reportSaving(), disabled: reportSaving() }"
                            (onClick)="submitReport(iv)" />
                        </div>
                      </div>
                    }

                    <!-- The PVs this user may read -->
                    @for (r of iv.reports; track r.id) {
                      <div class="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                        <div class="flex flex-wrap items-center gap-2">
                          <daf-avatar [data]="{ name: r.authorName || ('#' + r.authorUserId) }" size="xs" [showTooltip]="false" />
                          <span class="text-[12px] font-semibold text-on-surface">{{ r.authorName || ('#' + r.authorUserId) }}</span>
                          <daf-badge [label]="opinionLabel(r.opinion)" [options]="opinionBadge(r.opinion)" />
                          <span class="ml-auto text-[11px] text-outline">{{ formatStamp(r.updatedAt || r.submittedAt) }}</span>
                        </div>
                        <p class="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-on-surface">{{ r.summary }}</p>
                      </div>
                    }

                    @if (iv.status === 'DONE' && !iv.result && !iv.canValidate) {
                      <p class="flex items-center gap-1.5 text-[12px] text-outline">
                        <span class="material-symbols-outlined text-[14px]">hourglass_top</span>
                        {{ 'CANDIDATES.INTERVIEWS.PV.AWAITING_VALIDATION' | translate }}
                      </p>
                    }

                    <!-- RH decision -->
                    @if (iv.canValidate) {
                      <div class="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3">
                        <p class="text-[12px] font-semibold text-on-surface">{{ 'CANDIDATES.INTERVIEWS.VALIDATE.TITLE' | translate }}</p>
                        <p class="text-[12px] text-outline">{{ 'CANDIDATES.INTERVIEWS.VALIDATE.HINT' | translate }}</p>
                        @if (iv.reportCount < panelSize(iv)) {
                          <p class="flex items-center gap-1.5 text-[12px] text-warning">
                            <span class="material-symbols-outlined text-[14px]">warning</span>
                            {{ 'CANDIDATES.INTERVIEWS.VALIDATE.MISSING_PV' | translate: { n: panelSize(iv) - iv.reportCount } }}
                          </p>
                        }
                        <daf-form-field
                          [value]="validationComment(iv.id)"
                          [options]="{ label: ('CANDIDATES.INTERVIEWS.VALIDATE.COMMENT' | translate), type: 'textarea', rows: 2, maxLength: 1000, fullWidth: true }"
                          (valueChange)="setValidationComment(iv.id, $any($event) ?? '')" />
                        @if (validationError() && validationErrorFor() === iv.id) {
                          <p class="text-[12px] text-danger">{{ validationError() }}</p>
                        }
                        <div class="flex flex-wrap justify-end gap-2">
                          <daf-button [label]="'CANDIDATES.INTERVIEWS.VALIDATE.FAIL' | translate" variant="danger"
                            [options]="{ size: 'sm', iconStart: 'close', disabled: validatingId() === iv.id }"
                            (onClick)="validate(iv, 'FAIL')" />
                          <daf-button [label]="'CANDIDATES.INTERVIEWS.VALIDATE.PASS' | translate" variant="teal"
                            [options]="{ size: 'sm', iconStart: 'check', loading: validatingId() === iv.id, disabled: validatingId() === iv.id }"
                            (onClick)="validate(iv, 'PASS')" />
                        </div>
                      </div>
                    }

                    <!-- Decided -->
                    @if (iv.result) {
                      <p class="text-[12px] text-outline">
                        {{ 'CANDIDATES.INTERVIEWS.VALIDATE.DONE_BY' | translate: { name: iv.validatedByName || '—', date: formatStamp(iv.validatedAt) } }}
                        @if (iv.validationComment) {
                          <span class="block mt-1 text-on-surface">« {{ iv.validationComment }} »</span>
                        }
                      </p>
                    }
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
          <p class="text-[13px] text-outline">{{ 'CANDIDATES.INTERVIEWS.EMPTY' | translate }}</p>
        </div>
      }
    </rh-section-card>
  `
})
export class CandidateInterviewsComponent implements OnInit {
  @Input() candidateId!: number;
  @Input() paysId!: number;
  /** A PV or a validation changed what the page's « Étape actuelle » card reads. */
  readonly changed = output<void>();

  private svc = inject(InterviewService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);

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

  // ── Create / edit form ──────────────────────────────────────────────────────
  // One form serves both: `editingId` null = scheduling a new interview.
  showForm     = signal(false);
  editingId    = signal<number | null>(null);
  formLoading  = signal(false);
  formError    = signal<string | null>(null);
  formTypeId         = signal(0);
  formDate           = signal<Date | null>(null);
  formTime           = signal('');
  formLocation       = signal('');
  formNotes          = signal('');
  formInterviewerIds = signal<number[]>([]);

  users        = signal<UserPickerItem[]>([]);
  usersLoading = signal(false);

  readonly typeOptions = computed<SelectOption[]>(() => {
    const lang = this.translate.currentLang();
    return this.activeTypes().map(t => ({ value: String(t.id), label: interviewTypeLabel(t.name, t.nameEn, lang) }));
  });

  typeLabel(iv: CandidateInterview): string {
    return interviewTypeLabel(iv.interviewTypeName, iv.interviewTypeNameEn, this.translate.currentLang());
  }

  readonly interviewerOptions = computed<SelectOption[]>(() =>
    this.users().map(u => ({ value: String(u.id), label: u.fullName })),
  );

  /**
   * Chips under the picker. Falls back to the id when the user list hasn't loaded
   * yet — an edited interview can reference someone before /users answers.
   */
  readonly selectedInterviewers = computed<UserPickerItem[]>(() => {
    const byId = new Map<number, UserPickerItem>(this.users().map(u => [u.id, u]));
    return this.formInterviewerIds().map(id => byId.get(id) ?? { id, fullName: `#${id}` });
  });

  typeSelected(): string[] {
    return this.formTypeId() ? [String(this.formTypeId())] : [];
  }

  interviewerSelected(): string[] {
    return this.formInterviewerIds().map(String);
  }

  // ── Update inline ────────────────────────────────────────────────────────────
  updatingId    = signal<number | null>(null);
  updateAction  = signal<UpdateAction | null>(null);
  updateLoading = signal(false);
  updateError   = signal<string | null>(null);
  updateNotes   = signal('');

  readonly updateActionLabel = computed(() => {
    this.translate.currentLang();
    return this.translate.instant(this.updateAction() === 'CANCELLED'
      ? 'CANDIDATES.INTERVIEWS.CONFIRM_CANCEL' : 'CANDIDATES.INTERVIEWS.CONFIRM');
  });

  // ── PV (V132) ────────────────────────────────────────────────────────────────
  /** The interview whose PV form is open — one at a time. */
  readonly reportFormId  = signal<number | null>(null);
  readonly reportSummary = signal('');
  readonly reportOpinion = signal<InterviewOpinion | null>(null);
  readonly reportSaving  = signal(false);
  readonly reportError   = signal<string | null>(null);

  private readonly me = computed(() => this.userStore.currentUser()?.userId ?? null);

  readonly opinionOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return OPINIONS.map(o => ({ value: o, label: this.opinionLabel(o) }));
  });

  /** Panel size, never 0 — an interview with no panel still expects one PV. */
  panelSize(iv: CandidateInterview): number {
    return Math.max(iv.interviewers?.length ?? 0, 1);
  }

  isOnPanel(iv: CandidateInterview): boolean {
    const me = this.me();
    return me != null && (iv.interviewers ?? []).some(u => u.id === me);
  }

  myReport(iv: CandidateInterview): InterviewReport | null {
    const me = this.me();
    return (iv.reports ?? []).find(r => r.authorUserId === me) ?? null;
  }

  openReport(iv: CandidateInterview): void {
    const mine = this.myReport(iv);
    this.reportSummary.set(mine?.summary ?? '');
    this.reportOpinion.set(mine?.opinion ?? null);
    this.reportError.set(null);
    this.reportFormId.set(iv.id);
  }

  closeReport(): void { this.reportFormId.set(null); }

  submitReport(iv: CandidateInterview): void {
    const summary = this.reportSummary().trim();
    const opinion = this.reportOpinion();
    if (summary.length < 20) { this.reportError.set(this.translate.instant('CANDIDATES.INTERVIEWS.PV.ERR_SUMMARY')); return; }
    if (!opinion)            { this.reportError.set(this.translate.instant('CANDIDATES.INTERVIEWS.PV.ERR_OPINION')); return; }
    this.reportSaving.set(true);
    this.reportError.set(null);
    this.svc.submitReport(this.candidateId, iv.id, { summary, opinion }).subscribe({
      next: updated => {
        this.reportSaving.set(false);
        this.reportFormId.set(null);
        this.replace(updated);
        this.changed.emit();
      },
      error: err => {
        this.reportSaving.set(false);
        this.reportError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.PV.ERR_SAVE'));
      },
    });
  }

  opinionLabel(o: InterviewOpinion): string {
    return this.translate.instant('CANDIDATES.INTERVIEWS.PV.OPINION_' + o);
  }

  opinionBadge(o: InterviewOpinion): BadgeOptions {
    return { variant: o === 'FAVORABLE' ? 'success' : o === 'RESERVED' ? 'warning' : 'danger', size: 'sm' };
  }

  // ── RH validation (V132) ─────────────────────────────────────────────────────
  private readonly comments = signal<Record<number, string>>({});
  readonly validatingId    = signal<number | null>(null);
  readonly validationError = signal<string | null>(null);

  validationComment(id: number): string { return this.comments()[id] ?? ''; }

  setValidationComment(id: number, value: string): void {
    this.comments.update(c => ({ ...c, [id]: value }));
  }

  validate(iv: CandidateInterview, decision: InterviewResult): void {
    const comment = this.validationComment(iv.id).trim();
    if (decision === 'FAIL' && !comment) {
      this.validationErrorFor.set(iv.id);
      this.validationError.set(this.translate.instant('CANDIDATES.INTERVIEWS.VALIDATE.ERR_FAIL_COMMENT'));
      return;
    }
    this.validatingId.set(iv.id);
    this.validationError.set(null);
    this.validationErrorFor.set(null);
    this.svc.validateInterview(this.candidateId, iv.id, { decision, comment: comment || undefined }).subscribe({
      next: updated => {
        this.validatingId.set(null);
        this.replace(updated);
        this.changed.emit();
      },
      error: err => {
        this.validatingId.set(null);
        this.validationErrorFor.set(iv.id);
        this.validationError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.VALIDATE.ERR'));
      },
    });
  }

  /** Which interview the validation error belongs to. */
  readonly validationErrorFor = signal<number | null>(null);

  private replace(updated: CandidateInterview): void {
    this.interviews.update(list => list.map(x => x.id === updated.id ? updated : x));
  }

  formatStamp(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // A real instant (not a typed slot), so the browser's own zone is right here.
    return d.toLocaleString(this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  ngOnInit(): void { this.loadInterviews(); }

  private loadInterviews(): void {
    this.loading.set(true);
    this.svc.listByCandidate(this.candidateId).subscribe({
      next:  iv => { this.interviews.set(iv); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_LOAD')); this.loading.set(false); },
    });
  }

  onTypeChange(values: string[]): void {
    this.formTypeId.set(values[0] ? +values[0] : 0);
  }

  onInterviewersChange(values: string[]): void {
    this.formInterviewerIds.set(values.map(v => +v).filter(id => !!id));
  }

  removeInterviewer(id: number): void {
    this.formInterviewerIds.update(ids => ids.filter(x => x !== id));
  }

  onDateChange(value: Date | Date[] | null): void {
    this.formDate.set(Array.isArray(value) ? (value[0] ?? null) : value);
  }

  openForm(): void {
    this.editingId.set(null);
    this.formTypeId.set(0); this.formDate.set(null); this.formTime.set('');
    this.formLocation.set(''); this.formNotes.set(''); this.formInterviewerIds.set([]);
    this.formError.set(null); this.showForm.set(true);
    this.loadFormLookups();
  }

  openEdit(iv: CandidateInterview): void {
    this.cancelUpdate();
    this.editingId.set(iv.id);
    this.formTypeId.set(iv.interviewTypeId);
    // Scheduling stamps the typed wall clock as UTC (`...T09:00:00+00:00`), so read
    // it back in UTC — otherwise re-saving an untouched interview would shift it by
    // the browser's offset. formatDate() renders in UTC for the same reason.
    const at = new Date(iv.scheduledAt);
    const valid = !isNaN(at.getTime());
    this.formDate.set(valid ? new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) : null);
    this.formTime.set(valid ? pad2(at.getUTCHours()) + ':' + pad2(at.getUTCMinutes()) : '');
    this.formLocation.set(iv.location ?? '');
    this.formNotes.set(iv.interviewerNotes ?? '');
    this.formInterviewerIds.set((iv.interviewers ?? []).map(u => u.id));
    this.formError.set(null); this.showForm.set(true);
    this.loadFormLookups();
  }

  /** Types + assignable users, fetched once and reused by every open of the form. */
  private loadFormLookups(): void {
    if (!this.activeTypes().length) {
      this.typesLoading.set(true);
      this.svc.getActiveTypes(this.paysId).subscribe({
        next:  t  => { this.activeTypes.set(t); this.typesLoading.set(false); },
        error: () => { this.error.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_LOAD_TYPES')); this.typesLoading.set(false); },
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

  cancelForm(): void { this.showForm.set(false); this.editingId.set(null); }

  submitForm(): void {
    if (!this.formTypeId()) { this.formError.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_SELECT_TYPE')); return; }
    const dateIso = dateToIso(this.formDate());
    if (!dateIso) { this.formError.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_DATE_REQUIRED')); return; }
    const scheduledAt = `${dateIso}T${this.formTime() || '09:00'}:00+00:00`;
    this.formLoading.set(true); this.formError.set(null);

    const editingId = this.editingId();
    if (editingId !== null) {
      // Empty strings are sent on purpose: they clear a location/note that was set.
      const dto: UpdateInterviewRequest = {
        interviewTypeId: this.formTypeId(),
        scheduledAt,
        location: this.formLocation().trim(),
        interviewerNotes: this.formNotes().trim(),
        interviewerUserIds: this.formInterviewerIds(),
      };
      this.svc.updateInterview(this.candidateId, editingId, dto).subscribe({
        next:  () => { this.formLoading.set(false); this.cancelForm(); this.loadInterviews(); },
        error: err => { this.formLoading.set(false); this.formError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.ERR_UPDATE')); },
      });
      return;
    }

    const dto: CreateInterviewRequest = {
      interviewTypeId: this.formTypeId(),
      scheduledAt,
      location: this.formLocation().trim() || undefined,
      interviewerNotes: this.formNotes().trim() || undefined,
      interviewerUserIds: this.formInterviewerIds(),
    };
    this.svc.createInterview(this.candidateId, dto).subscribe({
      next:  () => { this.formLoading.set(false); this.cancelForm(); this.loadInterviews(); },
      error: err => { this.formLoading.set(false); this.formError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.ERR_SCHEDULE')); },
    });
  }

  openUpdate(iv: CandidateInterview, action: UpdateAction): void {
    this.cancelForm();
    this.updatingId.set(iv.id); this.updateAction.set(action);
    this.updateNotes.set(''); this.updateError.set(null);
  }

  cancelUpdate(): void { this.updatingId.set(null); this.updateAction.set(null); }

  submitUpdate(iv: CandidateInterview): void {
    const action = this.updateAction();
    if (!action) return;
    this.updateLoading.set(true); this.updateError.set(null);
    const notes = this.updateNotes().trim() || undefined;
    const dto: UpdateInterviewRequest = action === 'CANCELLED'
      ? { status: 'CANCELLED', interviewerNotes: notes }
      : { status: 'DONE', result: action === 'DONE_PASS' ? 'PASS' : 'FAIL', interviewerNotes: notes };
    this.svc.updateInterview(this.candidateId, iv.id, dto).subscribe({
      next: updated => {
        this.interviews.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.updateLoading.set(false); this.updatingId.set(null); this.updateAction.set(null);
      },
      error: err => { this.updateLoading.set(false); this.updateError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.ERR_UPDATE')); },
    });
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // UTC on purpose: the slot is stored as the wall clock that was typed, stamped
    // +00:00. Rendering it in the browser zone would show a different hour than the
    // scheduling/edit form.
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });
  }

  /**
   * Les panels en données d'avatar, calculés UNE fois par chargement et indexés par
   * entretien.
   *
   * Appelée deux fois par ligne depuis le gabarit (le `@if` puis `[members]`), la version
   * précédente reconstruisait un tableau à chaque appel et à chaque cycle de détection :
   * `members` est une entrée signal, une nouvelle identité la fait paraître modifiée en
   * permanence et refait tourner les calculs internes du groupe pour rien. La méthode
   * appelée depuis le gabarit ne fait plus qu'une lecture de Map.
   */
  private readonly avatarsByInterview = computed<Map<number, AvatarData[]>>(() => {
    const byId = new Map<number, AvatarData[]>();
    for (const iv of this.interviews()) byId.set(iv.id, this.buildAvatars(iv));
    return byId;
  });

  interviewerAvatars(iv: CandidateInterview): AvatarData[] {
    return this.avatarsByInterview().get(iv.id) ?? [];
  }

  /**
   * Le service garantit désormais que `interviewers` contient au moins le lead ; la
   * retombée sur `interviewerName` reste par prudence pour une réponse servie par une
   * version antérieure du backend.
   *
   * Un nom absent (utilisateur supprimé du référentiel) devient « #id » plutôt qu'une
   * pastille vide : `deriveInitials` rendrait « ? », ce qui se lit comme un bug d'affichage
   * là où « #42 » se lit comme une donnée manquante.
   */
  private buildAvatars(iv: CandidateInterview): AvatarData[] {
    const panel = iv.interviewers ?? [];
    if (panel.length) {
      return panel.map(u => ({ name: u.fullName?.trim() || `#${u.id}` }));
    }
    if (iv.interviewerUserId != null) {
      return [{ name: iv.interviewerName?.trim() || `#${iv.interviewerUserId}` }];
    }
    return [];
  }

  statusLabel(s: string): string {
    const key = s === 'PLANNED' ? 'CANDIDATES.INTERVIEWS.STATUS_PLANNED'
      : s === 'DONE' ? 'CANDIDATES.INTERVIEWS.STATUS_DONE'
      : 'CANDIDATES.INTERVIEWS.STATUS_CANCELLED';
    return this.translate.instant(key);
  }

  statusBadgeOptions(s: string): BadgeOptions {
    return {
      variant: s === 'PLANNED' ? 'teal' : s === 'DONE' ? 'success' : 'neutral',
      size: 'sm',
    };
  }

  resultBadgeOptions(result: string): BadgeOptions {
    return { variant: result === 'PASS' ? 'success' : 'danger', size: 'sm' };
  }

  dotBg(s: string): string {
    return s === 'PLANNED' ? 'var(--color-tertiary-container)' : s === 'DONE' ? 'var(--color-tertiary-container)' : 'var(--color-surface-container-low)';
  }

  dotColor(s: string): string {
    return s === 'PLANNED' ? 'var(--color-teal)' : s === 'DONE' ? 'var(--color-tertiary)' : 'var(--color-on-surface-variant)';
  }

  dotIcon(s: string): string {
    return s === 'PLANNED' ? 'event' : s === 'DONE' ? 'check_circle' : 'cancel';
  }

  /** Même bordure pour tous les états : seul le fond distingue un entretien annulé. */
  cardBorder(): string {
    return 'var(--color-outline-variant)';
  }

  cardBg(s: string): string {
    return s === 'CANCELLED' ? 'var(--color-surface-container-low)' : 'var(--color-surface)';
  }
}
