import {
  Component, DestroyRef, Input, OnInit, TemplateRef, computed, inject, output, signal, viewChild,
} from '@angular/core';
import {
  AccordionCardComponent,
  AccordionCardOptions,
  AccordionState,
  ActionMenuComponent,
  ActionMenuItem,
  AvatarComponent,
  AvatarData,
  AvatarGroupComponent,
  BadgeOptions,
  ButtonComponent,
  FormFieldComponent,
  ModalButton,
  ModalConfig,
  ModalRef,
  ModalService,
  MultiDatePickerComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  StatusBadgeComponent,
  TimePickerComponent,
  TimePickerValue,
} from '@khalilrebhiitec/daf360';
import { UserStore } from '../../core/user.store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { dateToIso } from '../../shared/date-picker.utils';
import { employeeAvatar } from '../../shared/utils/avatar.utils';
import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { ProfileFieldComponent } from '../../shared/detail/profile-field.component';
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


const pad2 = (n: number): string => String(n).padStart(2, '0');

/** What one interview card renders from — built once per load, read by the template. */
interface InterviewView {
  card: AccordionCardOptions;
  menu: ActionMenuItem[];
  avatars: AvatarData[];
  /** Panel synthesis of the questionnaire (V135) — empty under two readable PVs. */
  synthesis: SynthesisRow[];
}

/** One questionnaire question across the panel: a rating average, or choice counts. */
interface SynthesisRow {
  key: string;
  label: string;
  average: number | null;
  max: number | null;
  pct: number;
  choices: { label: string; count: number }[];
}


/**
 * Onglet « Entretiens » de /rh/candidates/:id.
 *
 * One daf-accordion-card per interview: its state (pending / active / done / blocked /
 * locked) carries the whole lifecycle, PLANNED, then PV to validate, then PASS / FAIL,
 * or CANCELLED, in a single stripe + pill, instead of a hand-drawn timeline with up to
 * three stacked badges. Row commands (edit, cancel) live in a daf-action-menu in the
 * header; the scheduling form, the PV form and the cancel confirmation open in lib
 * modals (ModalService), so the list never reflows under the user while they type.
 * Only the RH decision stays inline: it is read against the PVs directly above it.
 */
@Component({
  selector: 'app-candidate-interviews',
  standalone: true,
  imports: [
    AccordionCardComponent,
    ActionMenuComponent,
    AvatarComponent,
    AvatarGroupComponent,
    ButtonComponent,
    FormFieldComponent,
    MultiDatePickerComponent,
    ProfileFieldComponent,
    SectionCardComponent,
    SelectComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    TimePickerComponent,
    TranslatePipe,
  ],
  template: `
    <rh-section-card
      [title]="'CANDIDATES.INTERVIEWS.TITLE' | translate"
      icon="record_voice_over"
      [hoverLift]="true">

      <!-- Static root: a sectionAction nested in a control-flow block would land in the body. -->
      <div sectionAction class="flex items-center gap-2">
        @if (interviews().length) {
          <daf-badge [label]="interviews().length + ''" [options]="{ variant: 'teal', size: 'sm' }" />
        }
        @if (canManage()) {
          <daf-button [label]="'CANDIDATES.INTERVIEWS.SCHEDULE' | translate" variant="teal"
            [options]="{ iconStart: 'add', size: 'sm' }"
            (onClick)="openForm()" />
        }
      </div>

      @if (error()) {
        <div class="mb-4 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-[12px] text-danger">
          <span class="material-symbols-outlined text-[16px]">error</span>
          <span class="min-w-0 flex-1">{{ error() }}</span>
          <button type="button" class="material-symbols-outlined text-[16px] leading-none"
                  [attr.aria-label]="'COMMON.close' | translate"
                  (click)="error.set(null)">close</button>
        </div>
      }

      @if (loading()) {
        <div class="flex flex-col gap-3">
          <daf-skeleton height="68px" radius="xl" />
          <daf-skeleton height="68px" radius="xl" />
        </div>
      } @else if (interviews().length) {
        <div class="flex flex-col gap-3">
          @for (iv of interviews(); track iv.id) {
            @let v = view(iv);
            <daf-accordion-card
              [options]="v.card"
              [open]="isOpen(iv.id)"
              (openChange)="setOpen(iv.id, $event)">

              <!-- Static root, same rule as sectionAction. -->
              <div headerAction class="flex items-center gap-2">
                @if (v.avatars.length) {
                  <span class="hidden sm:inline-flex">
                    <daf-avatar-group [members]="v.avatars" size="xs" [max]="3" />
                  </span>
                }
                @if (v.menu.length) {
                  <daf-action-menu
                    [items]="v.menu"
                    [config]="{ label: ('CANDIDATES.INTERVIEWS.ACTIONS_ARIA' | translate) }"
                    (itemClick)="onMenu(iv, $event)" />
                }
              </div>

              <div class="flex flex-col gap-6">

                <!-- Details -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <rh-profile-field [label]="'CANDIDATES.INTERVIEWS.WHEN' | translate"
                                    [value]="formatDate(iv.scheduledAt)" />
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      {{ 'CANDIDATES.INTERVIEWS.LOCATION' | translate }}
                    </span>
                    <span class="wrap-break-word text-[13px] text-on-surface">{{ iv.location || '—' }}</span>
                    @if (iv.graphJoinUrl) {
                      <a [href]="iv.graphJoinUrl" target="_blank" rel="noopener"
                         class="mt-1 inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                        <span class="material-symbols-outlined text-[15px]">videocam</span>
                        {{ 'CANDIDATES.INTERVIEWS.JOIN_TEAMS' | translate }}
                      </a>
                    }
                  </div>
                  <div class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      {{ 'CANDIDATES.INTERVIEWS.PANEL' | translate }}
                    </span>
                    @if (v.avatars.length) {
                      <div class="flex flex-col gap-1.5">
                        @for (m of v.avatars; track $index) {
                          <span class="flex min-w-0 items-center gap-2 text-[13px] text-on-surface">
                            <daf-avatar [data]="m" size="xs" [showTooltip]="false" />
                            <span class="truncate">{{ m.name }}</span>
                          </span>
                        }
                      </div>
                    } @else {
                      <span class="text-[13px] text-on-surface">—</span>
                    }
                  </div>
                  @if (iv.interviewerNotes) {
                    <div class="sm:col-span-3">
                      <rh-profile-field [label]="'CANDIDATES.INTERVIEWS.NOTES' | translate"
                                        [value]="iv.interviewerNotes" />
                    </div>
                  }
                </div>

                <!-- PV & RH validation (V132). Each panel member files their own PV once
                     the interview has started; RH reads them all and decides PASS / FAIL,
                     which is what moves the candidature on. -->
                @if (iv.status !== 'CANCELLED') {
                  <div class="flex flex-col gap-3 border-t border-outline-variant/30 pt-5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <h4 class="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                        <span class="material-symbols-outlined text-[16px]">description</span>
                        {{ 'CANDIDATES.INTERVIEWS.PV.TITLE' | translate }}
                        <daf-badge
                          [label]="'CANDIDATES.INTERVIEWS.PV.COUNT' | translate: { n: iv.reportCount, total: panelSize(iv) }"
                          [options]="{ variant: iv.reportCount >= panelSize(iv) ? 'success' : 'neutral', size: 'sm' }" />
                      </h4>
                    </div>

                    <!-- PVs are written from self-service (« Entretiens »), never from here:
                         an interviewer on this panel is pointed there. -->
                    @if (isOnPanel(iv) && !iv.result) {
                      <p class="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                        <span class="material-symbols-outlined text-[15px]">info</span>
                        {{ 'CANDIDATES.INTERVIEWS.PV.WRITE_FROM_SELF_SERVICE' | translate }}
                      </p>
                    }

                    <!-- PVs side by side: auto-fit columns of at least 20rem — one PV takes
                         the full width, a panel of 2–3 reads across instead of down. -->
                    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-3">
                    @for (r of iv.reports; track r.id) {
                      <div class="flex h-full flex-col rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                        <div class="flex flex-wrap items-center gap-2">
                          <daf-avatar [data]="authorAvatar(iv, r)" size="sm" [showTooltip]="false" />
                          <div class="min-w-0">
                            <p class="truncate text-[13px] font-bold text-on-surface">{{ authorName(r) }}</p>
                            <p class="text-[10px] font-medium text-on-surface-variant/60">{{ formatStamp(r.updatedAt || r.submittedAt) }}</p>
                          </div>
                          <span class="ml-auto">
                            <daf-badge [label]="opinionLabel(r.opinion)" [options]="opinionBadge(r.opinion)" />
                          </span>
                        </div>
                        <p class="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-on-surface">{{ r.summary }}</p>

                        <!-- Questionnaire answers (V135), as the interviewer was asked them. -->
                        @if (r.answers.length) {
                          <!-- Answers as tiles, two per row; free text spans the row. -->
                          <dl class="mt-3 grid grid-cols-1 gap-2 border-t border-outline-variant/20 pt-3 sm:grid-cols-2">
                            @for (a of r.answers; track $index) {
                              <div [class]="a.responseType === 'TEXT'
                                     ? 'flex min-w-0 flex-col gap-1 rounded-lg bg-surface-container-low p-2.5 sm:col-span-2'
                                     : 'flex min-w-0 flex-col gap-1 rounded-lg bg-surface-container-low p-2.5'">
                                <dt class="line-clamp-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant"
                                    [title]="questionLabel(a.label, a.labelEn)">{{ questionLabel(a.label, a.labelEn) }}</dt>
                                <dd class="text-[13px] text-on-surface">
                                  @switch (a.responseType) {
                                    @case ('RATING') {
                                      <span class="flex items-center gap-2">
                                        <span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container">
                                          <span class="block h-full rounded-full bg-tertiary" [style.width.%]="ratingPct(a.number, a.ratingMin, a.ratingMax)"></span>
                                        </span>
                                        <span class="shrink-0 font-semibold">{{ a.number }} / {{ a.ratingMax }}</span>
                                      </span>
                                    }
                                    @case ('TEXT') {
                                      <span class="whitespace-pre-line">{{ a.text }}</span>
                                    }
                                    @default {
                                      <span class="flex flex-wrap gap-1">
                                        @for (o of a.options; track o) {
                                          <daf-badge [label]="o" [options]="{ variant: 'neutral', size: 'sm' }" />
                                        }
                                      </span>
                                    }
                                  }
                                </dd>
                              </div>
                            }
                          </dl>
                        }
                      </div>
                    } @empty {
                      @if (iv.status === 'DONE') {
                        <p class="col-span-full rounded-xl border border-dashed border-outline-variant/40 p-4 text-center text-[12px] text-on-surface-variant">
                          {{ 'CANDIDATES.INTERVIEWS.PV.NONE' | translate }}
                        </p>
                      }
                    }
                    </div>

                    <!-- Panel synthesis (V135): the answers of every readable PV side by side —
                         average of each rating, how often each choice was picked. -->
                    @if (v.synthesis.length) {
                      <div class="rounded-xl border border-primary/15 bg-primary/5 p-4">
                        <p class="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-on-surface">
                          <span class="material-symbols-outlined text-[16px] text-primary">insights</span>
                          {{ 'CANDIDATES.INTERVIEWS.PV.SYNTHESIS' | translate: { n: iv.reports.length } }}
                        </p>
                        <div class="flex flex-col gap-2.5">
                          @for (s of v.synthesis; track s.key) {
                            <div class="grid grid-cols-1 items-center gap-1 sm:grid-cols-[1fr_auto] sm:gap-4">
                              <span class="text-[12px] text-on-surface">{{ s.label }}</span>
                              @if (s.average !== null) {
                                <span class="flex items-center gap-2">
                                  <span class="h-1.5 w-28 overflow-hidden rounded-full bg-surface-container">
                                    <span class="block h-full rounded-full bg-primary" [style.width.%]="s.pct"></span>
                                  </span>
                                  <span class="text-[12px] font-bold text-on-surface">{{ s.average }} / {{ s.max }}</span>
                                </span>
                              } @else {
                                <span class="flex flex-wrap gap-1">
                                  @for (c of s.choices; track c.label) {
                                    <daf-badge [label]="c.label + ' × ' + c.count" [options]="{ variant: 'neutral', size: 'sm' }" />
                                  }
                                </span>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }

                    @if (iv.status === 'DONE' && !iv.result && !iv.canValidate) {
                      <p class="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                        <span class="material-symbols-outlined text-[15px]">hourglass_top</span>
                        {{ 'CANDIDATES.INTERVIEWS.PV.AWAITING_VALIDATION' | translate }}
                      </p>
                    }

                    <!-- RH decision -->
                    @if (iv.canValidate) {
                      <div class="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
                        <div>
                          <p class="flex items-center gap-1.5 text-[13px] font-bold text-on-surface">
                            <span class="material-symbols-outlined text-[16px] text-warning">gavel</span>
                            {{ 'CANDIDATES.INTERVIEWS.VALIDATE.TITLE' | translate }}
                          </p>
                          <p class="mt-1 text-[12px] text-on-surface-variant">{{ 'CANDIDATES.INTERVIEWS.VALIDATE.HINT' | translate }}</p>
                        </div>
                        @if (iv.reportCount < panelSize(iv)) {
                          <p class="flex items-center gap-1.5 text-[12px] font-semibold text-warning">
                            <span class="material-symbols-outlined text-[15px]">warning</span>
                            {{ 'CANDIDATES.INTERVIEWS.VALIDATE.MISSING_PV' | translate: { n: panelSize(iv) - iv.reportCount } }}
                          </p>
                        }
                        <daf-form-field
                          [value]="validationComment(iv.id)"
                          [options]="{ label: ('CANDIDATES.INTERVIEWS.VALIDATE.COMMENT' | translate), type: 'textarea', rows: 2, maxLength: 1000, fullWidth: true }"
                          (valueChange)="setValidationComment(iv.id, $any($event) ?? '')" />
                        @if (validationError() && validationErrorFor() === iv.id) {
                          <p class="flex items-center gap-1.5 text-[12px] text-danger">
                            <span class="material-symbols-outlined text-[15px]">error</span>
                            {{ validationError() }}
                          </p>
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
                      <div class="flex items-start gap-3 rounded-xl border p-4"
                           [class]="iv.result === 'PASS' ? 'border-tertiary/25 bg-tertiary/5' : 'border-danger/25 bg-danger/5'">
                        <span class="material-symbols-outlined text-[20px]"
                              [class]="iv.result === 'PASS' ? 'text-tertiary' : 'text-danger'">
                          {{ iv.result === 'PASS' ? 'verified' : 'block' }}
                        </span>
                        <div class="min-w-0">
                          <p class="text-[13px] font-bold text-on-surface">
                            {{ (iv.result === 'PASS' ? 'CANDIDATES.INTERVIEWS.PASS' : 'CANDIDATES.INTERVIEWS.FAIL') | translate }}
                          </p>
                          <p class="text-[12px] text-on-surface-variant">
                            {{ 'CANDIDATES.INTERVIEWS.VALIDATE.DONE_BY' | translate: { name: iv.validatedByName || '—', date: formatStamp(iv.validatedAt) } }}
                          </p>
                          @if (iv.validationComment) {
                            <p class="mt-1.5 whitespace-pre-line text-[13px] italic text-on-surface">« {{ iv.validationComment }} »</p>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </daf-accordion-card>
          }
        </div>
      } @else {
        <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant/40 px-4 py-10 text-center">
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <span class="material-symbols-outlined text-[24px]">event_upcoming</span>
          </span>
          <p class="text-[13px] text-on-surface-variant">{{ 'CANDIDATES.INTERVIEWS.EMPTY' | translate }}</p>
          @if (canManage()) {
            <daf-button [label]="'CANDIDATES.INTERVIEWS.SCHEDULE_TITLE' | translate" variant="teal"
              [options]="{ iconStart: 'add', size: 'sm' }"
              (onClick)="openForm()" />
          }
        </div>
      }
    </rh-section-card>

    <!-- ── Modal bodies (rendered by ModalService in <body>) ── -->

    <ng-template #formTpl>
      @if (typesLoading()) {
        <div class="flex flex-col gap-3">
          <daf-skeleton height="44px" radius="lg" />
          <daf-skeleton height="44px" radius="lg" />
          <daf-skeleton height="44px" radius="lg" />
        </div>
      } @else if (!activeTypes().length) {
        <p class="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 p-3 text-[12px] text-on-surface">
          <span class="material-symbols-outlined text-[16px] text-warning">info</span>
          {{ 'CANDIDATES.INTERVIEWS.NO_TYPES' | translate }}
        </p>
      } @else {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <daf-select
              [selected]="typeSelected()"
              [options]="typeOptions()"
              [config]="{ label: ('CANDIDATES.INTERVIEWS.TYPE' | translate), required: true, placeholder: ('CANDIDATES.COMMON.SELECT_PLACEHOLDER' | translate), fullWidth: true, searchable: true }"
              (selectedChange)="onTypeChange($event)" />
          </div>

          <daf-multi-date-picker
            [value]="formDate()"
            [config]="{ label: ('CANDIDATES.INTERVIEWS.DATE' | translate), placeholder: ('CANDIDATES.COMMON.SELECT' | translate), required: true, selectionMode: 'single' }"
            (valueChange)="onDateChange($event)" />

          <daf-time-picker
            [value]="formTime()"
            [config]="{ label: ('CANDIDATES.INTERVIEWS.TIME' | translate), placeholder: '09:00', display: 'time', minuteStep: 5, fullWidth: true }"
            (valueChange)="formTime.set($event)" />

          <div class="sm:col-span-2">
            <daf-form-field
              [value]="formLocation()"
              [options]="{ label: ('CANDIDATES.INTERVIEWS.LOCATION' | translate), placeholder: ('CANDIDATES.INTERVIEWS.LOCATION_PLACEHOLDER' | translate), maxLength: 255, fullWidth: true, prefixIcon: 'location_on' }"
              (valueChange)="formLocation.set($any($event) ?? '')" />
          </div>

          <!-- Panel: several interviewers can sit on the same interview. The first one
               picked stays the lead (calendar owner, list column). -->
          <div class="sm:col-span-2">
            @if (usersLoading()) {
              <daf-skeleton height="44px" radius="lg" />
            } @else {
              <daf-select
                [selected]="interviewerSelected()"
                [options]="interviewerOptions()"
                [config]="{ label: ('CANDIDATES.INTERVIEWS.INTERVIEWERS' | translate), placeholder: ('CANDIDATES.INTERVIEWS.INTERVIEWERS_PLACEHOLDER' | translate), fullWidth: true, searchable: true, multiple: true }"
                (selectedChange)="onInterviewersChange($event)" />
              @if (formInterviewerIds().length) {
                <div class="mt-2 flex flex-wrap gap-1.5">
                  @for (u of selectedInterviewers(); track u.id) {
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container py-0.5 pl-0.5 pr-1.5 text-[11px] font-semibold text-on-tertiary-container">
                      <daf-avatar [data]="u.avatar" size="xs" [showTooltip]="false" />
                      {{ u.fullName }}
                      <button type="button" class="material-symbols-outlined text-[14px] leading-none"
                              [attr.aria-label]="'CANDIDATES.COMMON.REMOVE' | translate"
                              (click)="removeInterviewer(u.id)">close</button>
                    </span>
                  }
                </div>
              }
            }
          </div>

          <div class="sm:col-span-2">
            <daf-form-field
              [value]="formNotes()"
              [options]="{ label: ('CANDIDATES.INTERVIEWS.NOTES_OPTIONAL' | translate), placeholder: ('CANDIDATES.COMMON.COMMENT_PLACEHOLDER' | translate), type: 'textarea', rows: 3, maxLength: 1000, fullWidth: true }"
              (valueChange)="formNotes.set($any($event) ?? '')" />
          </div>
        </div>
      }
      @if (formError()) {
        <p class="mt-3 flex items-center gap-1.5 text-[12px] text-danger">
          <span class="material-symbols-outlined text-[15px]">error</span>
          {{ formError() }}
        </p>
      }
    </ng-template>

    <ng-template #cancelTpl>
      <div class="flex flex-col gap-4">
        <p class="text-[13px] text-on-surface-variant">{{ 'CANDIDATES.INTERVIEWS.CANCEL_HINT' | translate }}</p>
        <daf-form-field
          [value]="updateNotes()"
          [options]="{ label: ('CANDIDATES.INTERVIEWS.NOTES_OPTIONAL' | translate), placeholder: ('CANDIDATES.COMMON.COMMENT_PLACEHOLDER' | translate), type: 'textarea', rows: 3, maxLength: 1000, fullWidth: true }"
          (valueChange)="updateNotes.set($any($event) ?? '')" />
        @if (updateError()) {
          <p class="flex items-center gap-1.5 text-[12px] text-danger">
            <span class="material-symbols-outlined text-[15px]">error</span>
            {{ updateError() }}
          </p>
        }
      </div>
    </ng-template>
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
  private modals = inject(ModalService);

  private readonly formTpl   = viewChild.required<TemplateRef<unknown>>('formTpl');
  private readonly cancelTpl = viewChild.required<TemplateRef<unknown>>('cancelTpl');
  /** The one modal this tab has open, if any — closed when the tab is left. */
  private modalRef: ModalRef | null = null;

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

  constructor() {
    // The modal lives in <body>: leaving the tab must not leave it behind.
    inject(DestroyRef).onDestroy(() => this.modalRef?.close());
  }

  // ── Open / closed cards ──────────────────────────────────────────────────────
  private readonly openIds = signal<ReadonlySet<number>>(new Set());

  isOpen(id: number): boolean { return this.openIds().has(id); }

  setOpen(id: number, open: boolean): void {
    this.openIds.update(s => {
      const next = new Set(s);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
  }

  /**
   * Opens what the current user has to act on (a PV to file, a decision to take); when
   * nothing is pending, the latest interview that is still live. Cards the user already
   * opened stay open across a reload.
   */
  private seedOpen(list: CandidateInterview[]): void {
    const pending = list.filter(iv => iv.canValidate);
    const pick = pending.length
      ? pending
      : [...list].filter(iv => iv.status !== 'CANCELLED')
          .sort((a, b) => b.sequenceNumber - a.sequenceNumber)
          .slice(0, 1);
    this.openIds.update(s => new Set([...s, ...pick.map(iv => iv.id)]));
  }

  // ── Create / edit form ──────────────────────────────────────────────────────
  // One form serves both: `editingId` null = scheduling a new interview.
  editingId    = signal<number | null>(null);
  formLoading  = signal(false);
  formError    = signal<string | null>(null);
  formTypeId         = signal(0);
  formDate           = signal<Date | null>(null);
  formTime           = signal<TimePickerValue | null>(null);
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

  /** The panel of the interview being edited — known before /users answers. */
  private readonly editPanel = signal<UserPickerItem[]>([]);

  /**
   * Chips under the picker, each with its photo. Looks the person up in the picker list,
   * then in the edited interview's panel (an edit can open before /users answers, and a
   * panel member may since have left the pays), and only then falls back to the id.
   */
  readonly selectedInterviewers = computed<(UserPickerItem & { avatar: AvatarData })[]>(() => {
    const byId = new Map<number, UserPickerItem>(this.editPanel().map(u => [u.id, u]));
    this.users().forEach(u => byId.set(u.id, u));
    return this.formInterviewerIds().map(id => {
      const u = byId.get(id) ?? { id, fullName: `#${id}` };
      return { ...u, avatar: this.avatarOf(u) };
    });
  });

  /**
   * One rule for every face on this tab: real photo (128px variant), then the gendered
   * placeholder, then initials — daf-avatar also drops to initials if the image fails.
   */
  private avatarOf(u: UserPickerItem): AvatarData {
    return {
      name: u.fullName?.trim() || `#${u.id}`,
      avatarUrl: employeeAvatar(u.profileId, u.photoUrl, u.gender),
    };
  }

  /** A PV author is (almost always) on the panel, which is where the photo fields are. */
  authorAvatar(iv: CandidateInterview, r: InterviewReport): AvatarData {
    const member = (iv.interviewers ?? []).find(u => u.id === r.authorUserId);
    return member ? this.avatarOf({ ...member, fullName: member.fullName || this.authorName(r) })
                  : { name: this.authorName(r) };
  }

  typeSelected(): string[] {
    return this.formTypeId() ? [String(this.formTypeId())] : [];
  }

  interviewerSelected(): string[] {
    return this.formInterviewerIds().map(String);
  }

  // ── Cancel (the only manual transition left since V132) ─────────────────────
  updateLoading = signal(false);
  updateError   = signal<string | null>(null);
  updateNotes   = signal('');

  // ── PV (V132) — read-only here ──────────────────────────────────────────────
  // PVs are written from the shell's self-service (« Entretiens » tab), never from this
  // tab: the RH page only reads them and validates the interview.
  private readonly me = computed(() => this.userStore.currentUser()?.userId ?? null);

  /** Panel size, never 0 — an interview with no panel still expects one PV. */
  panelSize(iv: CandidateInterview): number {
    return Math.max(iv.interviewers?.length ?? 0, 1);
  }

  isOnPanel(iv: CandidateInterview): boolean {
    const me = this.me();
    return me != null && (iv.interviewers ?? []).some(u => u.id === me);
  }

  authorName(r: InterviewReport): string {
    return r.authorName || ('#' + r.authorUserId);
  }

  /** French label, or the English one when the UI is in English and one was typed. */
  questionLabel(label: string, labelEn: string | null): string {
    return this.translate.currentLang() === 'en' && labelEn ? labelEn : label;
  }

  ratingPct(value: number | null, min: number | null, max: number | null): number {
    if (value == null || max == null) return 0;
    const lo = min ?? 0;
    return max > lo ? Math.max(0, Math.min(100, ((value - lo) / (max - lo)) * 100)) : 0;
  }

  opinionLabel(o: InterviewOpinion): string {
    return this.translate.instant('CANDIDATES.INTERVIEWS.PV.OPINION_' + o);
  }

  opinionBadge(o: InterviewOpinion): BadgeOptions {
    return { variant: o === 'FAVORABLE' ? 'success' : o === 'RESERVED' ? 'warning' : 'danger', size: 'sm', dot: true };
  }

  // ── RH validation (V132) ─────────────────────────────────────────────────────
  private readonly comments = signal<Record<number, string>>({});
  readonly validatingId    = signal<number | null>(null);
  readonly validationError = signal<string | null>(null);
  /** Which interview the validation error belongs to. */
  readonly validationErrorFor = signal<number | null>(null);

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
      next:  iv => { this.interviews.set(iv); this.seedOpen(iv); this.loading.set(false); },
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
    this.formTypeId.set(0); this.formDate.set(null); this.formTime.set(null);
    this.formLocation.set(''); this.formNotes.set(''); this.formInterviewerIds.set([]);
    this.editPanel.set([]);
    this.formError.set(null);
    this.loadFormLookups();
    this.openFormModal();
  }

  openEdit(iv: CandidateInterview): void {
    this.editingId.set(iv.id);
    this.formTypeId.set(iv.interviewTypeId);
    // Scheduling stamps the typed wall clock as UTC (...T09:00:00+00:00), so read it
    // back in UTC — otherwise re-saving an untouched interview would shift it by the
    // browser's offset. formatDate() renders in UTC for the same reason.
    const at = new Date(iv.scheduledAt);
    const valid = !isNaN(at.getTime());
    this.formDate.set(valid ? new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) : null);
    this.formTime.set(valid ? { hours: at.getUTCHours(), minutes: at.getUTCMinutes(), seconds: 0 } : null);
    this.formLocation.set(iv.location ?? '');
    this.formNotes.set(iv.interviewerNotes ?? '');
    this.formInterviewerIds.set((iv.interviewers ?? []).map(u => u.id));
    this.editPanel.set(iv.interviewers ?? []);
    this.formError.set(null);
    this.loadFormLookups();
    this.openFormModal(iv);
  }

  private openFormModal(iv?: CandidateInterview): void {
    const self = this;
    const editing = !!iv;
    const submit: ModalButton = {
      get label()    { return self.translate.instant(editing ? 'CANDIDATES.COMMON.SAVE' : 'CANDIDATES.INTERVIEWS.SCHEDULE'); },
      get disabled() { return self.formLoading() || self.typesLoading() || !self.activeTypes().length; },
      variant: 'primary',
      icon:    editing ? 'save' : 'event_available',
      action:  () => this.submitForm(),
    };
    this.openModal({
      title:    this.translate.instant(editing ? 'CANDIDATES.INTERVIEWS.EDIT_TITLE' : 'CANDIDATES.INTERVIEWS.SCHEDULE_TITLE'),
      subtitle: iv ? `#${iv.sequenceNumber} · ${this.typeLabel(iv)}` : undefined,
      icon:     'event',
      body:     this.formTpl(),
      size:     'lg',
      buttons:  [this.cancelButton(), submit],
    });
  }

  /** Types + assignable users, fetched once and reused by every open of the form. */
  private loadFormLookups(): void {
    if (!this.activeTypes().length) {
      this.typesLoading.set(true);
      this.svc.getActiveTypes(this.paysId).subscribe({
        next:  t  => { this.activeTypes.set(t); this.typesLoading.set(false); },
        error: () => { this.formError.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_LOAD_TYPES')); this.typesLoading.set(false); },
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

  submitForm(): void {
    if (!this.formTypeId()) { this.formError.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_SELECT_TYPE')); return; }
    const dateIso = dateToIso(this.formDate());
    if (!dateIso) { this.formError.set(this.translate.instant('CANDIDATES.INTERVIEWS.ERR_DATE_REQUIRED')); return; }
    const t = this.formTime();
    const time = t ? pad2(t.hours) + ':' + pad2(t.minutes) : '09:00';
    const scheduledAt = `${dateIso}T${time}:00+00:00`;
    this.formLoading.set(true); this.formError.set(null);

    const done = () => { this.formLoading.set(false); this.modalRef?.close(); this.loadInterviews(); };

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
        next:  done,
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
      next:  done,
      error: err => { this.formLoading.set(false); this.formError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.ERR_SCHEDULE')); },
    });
  }

  // ── Header menu ──────────────────────────────────────────────────────────────

  onMenu(iv: CandidateInterview, item: ActionMenuItem): void {
    if (item.id === 'edit') this.openEdit(iv);
    else if (item.id === 'cancel') this.openCancel(iv);
  }

  private openCancel(iv: CandidateInterview): void {
    this.updateNotes.set('');
    this.updateError.set(null);
    const self = this;
    const confirm: ModalButton = {
      get label()    { return self.translate.instant('CANDIDATES.INTERVIEWS.CONFIRM_CANCEL'); },
      get disabled() { return self.updateLoading(); },
      variant: 'primary',
      icon:    'event_busy',
      action:  () => this.submitCancel(iv),
    };
    this.openModal({
      title:    this.translate.instant('CANDIDATES.INTERVIEWS.CANCEL_TITLE'),
      subtitle: `#${iv.sequenceNumber} · ${this.typeLabel(iv)} · ${this.formatDate(iv.scheduledAt)}`,
      icon:     'event_busy',
      body:     this.cancelTpl(),
      size:     'md',
      buttons:  [
        { label: this.translate.instant('CANDIDATES.INTERVIEWS.KEEP'), variant: 'secondary', action: r => r.close() },
        confirm,
      ],
    });
  }

  private submitCancel(iv: CandidateInterview): void {
    this.updateLoading.set(true); this.updateError.set(null);
    const dto: UpdateInterviewRequest = { status: 'CANCELLED', interviewerNotes: this.updateNotes().trim() || undefined };
    this.svc.updateInterview(this.candidateId, iv.id, dto).subscribe({
      next: updated => {
        this.updateLoading.set(false);
        this.modalRef?.close();
        this.replace(updated);
      },
      error: err => { this.updateLoading.set(false); this.updateError.set(err?.error?.detail ?? this.translate.instant('CANDIDATES.INTERVIEWS.ERR_UPDATE')); },
    });
  }

  // ── Modal plumbing ───────────────────────────────────────────────────────────

  private cancelButton(): ModalButton {
    return { label: this.translate.instant('CANDIDATES.COMMON.CANCEL'), variant: 'secondary', action: r => r.close() };
  }

  /** One modal at a time; ✕, backdrop and buttons all end in _destroy(), which forgets the ref. */
  private openModal(config: ModalConfig): void {
    this.modalRef?.close();
    const ref = this.modals.open({ resizable: true, maximizable: true, minWidth: '360px', ...config });
    const destroy = ref._destroy.bind(ref);
    ref._destroy = () => {
      destroy();
      if (this.modalRef === ref) this.modalRef = null;
    };
    this.modalRef = ref;
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // UTC on purpose: the slot is stored as the wall clock that was typed, stamped
    // +00:00. Rendering it in the browser zone would show a different hour than the
    // scheduling/edit form.
    return d.toLocaleString(this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });
  }

  /**
   * Everything a card renders, built ONCE per load (and per language) and indexed by
   * interview. Calling builders from the template would hand daf-accordion-card and
   * daf-avatar-group a fresh object on every change-detection pass; their inputs are
   * signals, so a new identity re-runs their computeds for nothing.
   */
  private readonly views = computed<Map<number, InterviewView>>(() => {
    this.translate.currentLang();
    const manage = this.canManage();
    const byId = new Map<number, InterviewView>();
    for (const iv of this.interviews()) byId.set(iv.id, this.buildView(iv, manage));
    return byId;
  });

  view(iv: CandidateInterview): InterviewView {
    return this.views().get(iv.id) ?? this.buildView(iv, this.canManage());
  }

  private buildView(iv: CandidateInterview, manage: boolean): InterviewView {
    const t = (k: string) => this.translate.instant(k);
    const { state, icon, pill } = this.stateOf(iv);
    const subtitle = [this.formatDate(iv.scheduledAt), iv.location].filter(Boolean).join(' · ');

    // Edit stays available until the interview is DONE — a finished interview is a
    // record and the backend rejects edits. Cancelling only makes sense while PLANNED.
    const menu: ActionMenuItem[] = [];
    if (manage && iv.status !== 'DONE') {
      menu.push({ id: 'edit', icon: 'edit', label: t('CANDIDATES.COMMON.EDIT') });
      if (iv.status === 'PLANNED') {
        menu.push({ id: 'cancel', icon: 'event_busy', label: t('CANDIDATES.INTERVIEWS.CANCEL_ACTION'), variant: 'danger' });
      }
    }

    return {
      card: {
        title: `#${iv.sequenceNumber} · ${this.typeLabel(iv)}`,
        subtitle,
        icon,
        state,
        statusLabel: t(pill),
        // Solid, not glass: these sit INSIDE the glass rh-section-card, and a glass card
        // in a glass card stacks two backdrop-filter layers — the text on the inner one
        // reads soft, and worse while the hover transition runs.
        variant: 'outlined',
      },
      menu,
      avatars: this.buildAvatars(iv),
      synthesis: this.buildSynthesis(iv),
    };
  }

  /**
   * The questionnaire across every PV this user may read (V135): one row per question, in
   * question order — the average of a rating, how many times each choice was picked. Text
   * answers stay under their PV. Shown from two PVs up: with one it would only repeat it.
   */
  private buildSynthesis(iv: CandidateInterview): SynthesisRow[] {
    const reports = iv.reports ?? [];
    if (reports.length < 2) return [];
    type Acc = { label: string; order: number; max: number | null; min: number | null; sum: number; n: number; counts: Map<string, number> };
    const byKey = new Map<string, Acc>();
    for (const r of reports) {
      for (const a of r.answers ?? []) {
        if (a.responseType === 'TEXT') continue;
        // An archived question keeps its id; a deleted one never had answers.
        const key = a.questionId != null ? 'q' + a.questionId : 'l' + a.label;
        const acc = byKey.get(key) ?? {
          label: this.questionLabel(a.label, a.labelEn), order: a.order,
          max: a.ratingMax, min: a.ratingMin, sum: 0, n: 0, counts: new Map<string, number>(),
        };
        if (a.responseType === 'RATING' && a.number != null) { acc.sum += a.number; acc.n++; }
        else for (const o of a.options ?? []) acc.counts.set(o, (acc.counts.get(o) ?? 0) + 1);
        byKey.set(key, acc);
      }
    }
    return [...byKey.entries()]
      .sort((x, y) => x[1].order - y[1].order)
      .map(([key, acc]) => {
        const average = acc.n ? Math.round((acc.sum / acc.n) * 10) / 10 : null;
        return {
          key,
          label: acc.label,
          average,
          max: acc.max,
          pct: this.ratingPct(average, acc.min, acc.max),
          choices: [...acc.counts.entries()]
            .sort((x, y) => y[1] - x[1])
            .map(([label, count]) => ({ label, count })),
        };
      })
      .filter(s => s.average !== null || s.choices.length);
  }

  /** The whole lifecycle in one accordion state — stripe, disc and pill stay in sync. */
  private stateOf(iv: CandidateInterview): { state: AccordionState; icon: string; pill: string } {
    if (iv.status === 'CANCELLED') return { state: 'locked',  icon: 'event_busy',   pill: 'CANDIDATES.INTERVIEWS.STATUS_CANCELLED' };
    if (iv.result === 'PASS')      return { state: 'done',    icon: 'verified',     pill: 'CANDIDATES.INTERVIEWS.PASS' };
    if (iv.result === 'FAIL')      return { state: 'blocked', icon: 'block',        pill: 'CANDIDATES.INTERVIEWS.FAIL' };
    if (iv.status === 'DONE')      return { state: 'active',  icon: 'rate_review',  pill: 'CANDIDATES.INTERVIEWS.PV.TO_VALIDATE' };
    return                                { state: 'pending', icon: 'event',        pill: 'CANDIDATES.INTERVIEWS.STATUS_PLANNED' };
  }

  /**
   * The service guarantees interviewers holds at least the lead; the interviewerName
   * fallback stays for a response served by an older backend.
   *
   * A missing name (user removed from the directory) becomes « #id » rather than an
   * empty disc: deriveInitials would render « ? », which reads as a display bug where
   * « #42 » reads as missing data.
   */
  private buildAvatars(iv: CandidateInterview): AvatarData[] {
    const panel = iv.interviewers ?? [];
    if (panel.length) {
      return panel.map(u => this.avatarOf(u));
    }
    if (iv.interviewerUserId != null) {
      return [{ name: iv.interviewerName?.trim() || `#${iv.interviewerUserId}` }];
    }
    return [];
  }
}
