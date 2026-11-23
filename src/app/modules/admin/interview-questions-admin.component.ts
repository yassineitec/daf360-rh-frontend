import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import {
  ActionMenuComponent, ActionMenuItem, ButtonComponent, FormFieldComponent, SelectComponent,
  SelectOption, SkeletonComponent, SliderComponent, StatusBadgeComponent, TagInputComponent,
  ToggleComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InterviewService } from '../candidates/interview.service';
import {
  INTERVIEW_QUESTION_TYPES, InterviewQuestion, InterviewQuestionType, InterviewType,
  SaveInterviewQuestionRequest,
} from '../candidates/interview.model';

const K = 'ADMIN.docs.interviews.questions.';

const TYPE_ICON: Record<InterviewQuestionType, string> = {
  TEXT: 'notes', RATING: 'linear_scale', SELECT: 'radio_button_checked', MULTI_SELECT: 'check_box',
};

/**
 * Questionnaire of ONE interview type (V135) — opened from the « Questions » action of the
 * types table. Every interviewer of that type answers these questions in their PV, so the
 * panel's opinions come back in the same shape.
 *
 * The list and the editor share the modal: editing swaps the list for the form, so there is
 * never a modal on top of a modal. A question that has been answered keeps its response type
 * and scale (the server refuses a change) and can only be archived, not deleted.
 */
@Component({
  selector: 'app-interview-questions-admin',
  standalone: true,
  imports: [
    ActionMenuComponent, ButtonComponent, FormFieldComponent, SelectComponent, SkeletonComponent,
    SliderComponent, StatusBadgeComponent, TagInputComponent, ToggleComponent, TranslatePipe,
  ],
  template: `
    <div class="flex flex-col gap-4">

      @if (error()) {
        <div class="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-[12px] text-danger">
          <span class="material-symbols-outlined text-[16px]">error</span>
          <span class="min-w-0 flex-1">{{ error() }}</span>
          <button type="button" class="material-symbols-outlined text-[16px] leading-none"
                  [attr.aria-label]="'COMMON.close' | translate" (click)="error.set(null)">close</button>
        </div>
      }

      @if (editing() === null) {
        <!-- ── List ── -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-[12px] text-on-surface-variant">{{ K + 'INTRO' | translate }}</p>
          <daf-button [label]="K + 'ADD' | translate" variant="teal"
            [options]="{ iconStart: 'add', size: 'sm' }" (onClick)="openNew()" />
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-2">
            <daf-skeleton height="56px" radius="lg" />
            <daf-skeleton height="56px" radius="lg" />
          </div>
        } @else if (!questions().length) {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant/40 px-4 py-8 text-center">
            <span class="material-symbols-outlined text-[26px] text-on-surface-variant">quiz</span>
            <p class="text-[13px] text-on-surface-variant">{{ K + 'EMPTY' | translate }}</p>
          </div>
        } @else {
          <ol class="flex flex-col gap-2">
            @for (q of questions(); track q.id; let i = $index, first = $first, last = $last) {
              <li class="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3"
                  [class.opacity-60]="!q.active">
                <div class="flex flex-col items-center gap-0.5 pt-0.5">
                  <button type="button" class="material-symbols-outlined text-[18px] leading-none text-on-surface-variant disabled:opacity-30"
                          [disabled]="first || reordering()" [attr.aria-label]="K + 'MOVE_UP' | translate"
                          (click)="move(i, -1)">keyboard_arrow_up</button>
                  <span class="text-[11px] font-bold text-on-surface-variant">{{ i + 1 }}</span>
                  <button type="button" class="material-symbols-outlined text-[18px] leading-none text-on-surface-variant disabled:opacity-30"
                          [disabled]="last || reordering()" [attr.aria-label]="K + 'MOVE_DOWN' | translate"
                          (click)="move(i, 1)">keyboard_arrow_down</button>
                </div>

                <div class="min-w-0 flex-1">
                  <p class="text-[13px] font-semibold text-on-surface">
                    {{ q.label }}
                    @if (q.required) { <span class="text-danger">*</span> }
                  </p>
                  @if (q.labelEn) {
                    <p class="text-[12px] text-on-surface-variant">{{ q.labelEn }}</p>
                  }
                  <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <daf-badge [label]="typeLabel(q.responseType)" [options]="{ variant: 'teal', size: 'sm' }" />
                    @if (!q.active) {
                      <daf-badge [label]="K + 'ARCHIVED' | translate" [options]="{ variant: 'neutral', size: 'sm' }" />
                    }
                    @if (q.answerCount > 0) {
                      <daf-badge [label]="K + 'ANSWERED' | translate: { n: q.answerCount }" [options]="{ variant: 'info', size: 'sm' }" />
                    }
                    <span class="text-[12px] text-on-surface-variant">{{ details(q) }}</span>
                  </div>

                  @if (confirmDeleteId() === q.id) {
                    <div class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger/5 p-2 text-[12px] text-danger">
                      <span class="flex-1">{{ K + 'DELETE_CONFIRM' | translate }}</span>
                      <daf-button [label]="'ADMIN.docs.interviews.cancel' | translate" variant="secondary"
                        [options]="{ size: 'sm' }" (onClick)="confirmDeleteId.set(null)" />
                      <daf-button [label]="K + 'DELETE' | translate" variant="danger"
                        [options]="{ size: 'sm', iconStart: 'delete' }" (onClick)="remove(q)" />
                    </div>
                  }
                </div>

                <daf-action-menu [items]="menuOf(q)" [config]="{ label: (K + 'ACTIONS' | translate) }"
                  (itemClick)="onMenu(q, $event)" />
              </li>
            }
          </ol>
        }
      } @else {
        <!-- ── Editor ── -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <daf-form-field
              [value]="fLabel()"
              [options]="{ label: (K + 'LABEL' | translate), required: true, maxLength: 500, fullWidth: true, placeholder: (K + 'LABEL_PLACEHOLDER' | translate) }"
              (valueChange)="fLabel.set($any($event) ?? '')" />
          </div>
          <div class="sm:col-span-2">
            <daf-form-field
              [value]="fLabelEn()"
              [options]="{ label: (K + 'LABEL_EN' | translate), maxLength: 500, fullWidth: true }"
              (valueChange)="fLabelEn.set($any($event) ?? '')" />
          </div>
          <div class="sm:col-span-2">
            <daf-form-field
              [value]="fHelp()"
              [options]="{ label: (K + 'HELP' | translate), type: 'textarea', rows: 2, maxLength: 1000, fullWidth: true, placeholder: (K + 'HELP_PLACEHOLDER' | translate) }"
              (valueChange)="fHelp.set($any($event) ?? '')" />
          </div>

          <daf-select
            [selected]="[fType()]"
            [options]="typeOptions()"
            [config]="{ label: (K + 'RESPONSE_TYPE' | translate), required: true, fullWidth: true, disabled: locked(), hint: locked() ? (K + 'LOCKED_HINT' | translate) : '' }"
            (selectedChange)="onTypeChange($event)" />

          <div class="flex items-end pb-2">
            <daf-toggle [checked]="fRequired()" [options]="{ label: (K + 'REQUIRED' | translate) }"
              (checkedChange)="fRequired.set($event)" />
          </div>

          @if (fType() === 'RATING') {
            <div class="grid grid-cols-3 gap-3 sm:col-span-2">
              <daf-form-field [value]="fMin()"
                [options]="{ label: (K + 'MIN' | translate), type: 'number', align: 'center', disabled: locked() }"
                (valueChange)="fMin.set(toInt($event, 1))" />
              <daf-form-field [value]="fMax()"
                [options]="{ label: (K + 'MAX' | translate), type: 'number', align: 'center', disabled: locked() }"
                (valueChange)="fMax.set(toInt($event, 5))" />
              <daf-form-field [value]="fStep()"
                [options]="{ label: (K + 'STEP' | translate), type: 'number', align: 'center', disabled: locked() }"
                (valueChange)="fStep.set(toInt($event, 1))" />
            </div>
            <daf-form-field [value]="fMinLabel()"
              [options]="{ label: (K + 'MIN_LABEL' | translate), maxLength: 100, fullWidth: true, placeholder: (K + 'MIN_LABEL_PLACEHOLDER' | translate) }"
              (valueChange)="fMinLabel.set($any($event) ?? '')" />
            <daf-form-field [value]="fMaxLabel()"
              [options]="{ label: (K + 'MAX_LABEL' | translate), maxLength: 100, fullWidth: true, placeholder: (K + 'MAX_LABEL_PLACEHOLDER' | translate) }"
              (valueChange)="fMaxLabel.set($any($event) ?? '')" />

            <div class="rounded-xl border border-dashed border-outline-variant/40 p-4 sm:col-span-2">
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ K + 'PREVIEW' | translate }}</p>
              <daf-slider
                [config]="{ title: fLabel() || (K + 'LABEL' | translate), min: fMin(), max: fMax(), step: fStep(), minLabel: fMinLabel(), maxLabel: fMaxLabel() }"
                [value]="preview()"
                (valueChange)="preview.set($event)" />
            </div>
          }

          @if (fType() === 'SELECT' || fType() === 'MULTI_SELECT') {
            <div class="sm:col-span-2">
              <daf-tag-input
                [tags]="fOptions()"
                [config]="{ label: (K + 'OPTIONS' | translate), required: true, placeholder: (K + 'OPTIONS_PLACEHOLDER' | translate), hint: (K + 'OPTIONS_HINT' | translate), maxTags: 30 }"
                (tagsChange)="fOptions.set($event)" />
            </div>
          }
        </div>

        @if (formError()) {
          <p class="flex items-center gap-1.5 text-[12px] text-danger">
            <span class="material-symbols-outlined text-[15px]">error</span>
            {{ formError() }}
          </p>
        }

        <div class="flex justify-end gap-2 border-t border-outline-variant/30 pt-4">
          <daf-button [label]="'ADMIN.docs.interviews.cancel' | translate" variant="secondary" (onClick)="closeEditor()" />
          <daf-button
            [label]="(editing() === 'new' ? 'ADMIN.docs.interviews.add' : 'ADMIN.docs.interviews.save') | translate"
            variant="teal"
            [options]="{ iconStart: 'save', loading: saving(), disabled: saving() || !fLabel().trim() }"
            (onClick)="save()" />
        </div>
      }
    </div>
  `,
})
export class InterviewQuestionsAdminComponent implements OnInit {
  readonly type = input.required<InterviewType>();
  /** The active-question count of the type may have changed. */
  readonly changed = output<void>();

  private svc = inject(InterviewService);
  private translate = inject(TranslateService);

  readonly K = K;

  readonly questions = signal<InterviewQuestion[]>([]);
  readonly loading = signal(true);
  readonly reordering = signal(false);
  readonly error = signal<string | null>(null);
  readonly confirmDeleteId = signal<number | null>(null);

  // ── editor: null = list, 'new' = creating, id = editing that question ──
  readonly editing = signal<'new' | number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fLabel = signal('');
  readonly fLabelEn = signal('');
  readonly fHelp = signal('');
  readonly fType = signal<InterviewQuestionType>('RATING');
  readonly fRequired = signal(true);
  readonly fOptions = signal<string[]>([]);
  readonly fMin = signal(1);
  readonly fMax = signal(5);
  readonly fStep = signal(1);
  readonly fMinLabel = signal('');
  readonly fMaxLabel = signal('');
  readonly preview = signal(3);
  /** The edited question was answered: type and scale are frozen. */
  readonly locked = signal(false);

  readonly typeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return INTERVIEW_QUESTION_TYPES.map(t => ({ value: t, label: this.typeLabel(t), icon: TYPE_ICON[t] }));
  });

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.svc.getQuestions(this.type().id).subscribe({
      next: q => { this.questions.set(q); this.loading.set(false); },
      error: err => { this.loading.set(false); this.error.set(this.errText(err, 'LOAD_ERROR')); },
    });
  }

  typeLabel(t: InterviewQuestionType): string {
    return this.translate.instant(K + 'TYPE_' + t);
  }

  /** One-line summary of the scale or the choices. */
  details(q: InterviewQuestion): string {
    if (q.responseType === 'RATING') {
      const ends = [q.ratingMinLabel, q.ratingMaxLabel].some(Boolean)
        ? ' (' + (q.ratingMinLabel || '…') + ' → ' + (q.ratingMaxLabel || '…') + ')' : '';
      return q.ratingMin + ' → ' + q.ratingMax + (q.ratingStep && q.ratingStep !== 1 ? ' / ' + q.ratingStep : '') + ends;
    }
    if (q.responseType === 'SELECT' || q.responseType === 'MULTI_SELECT') return q.options.join(' · ');
    return '';
  }

  menuOf(q: InterviewQuestion): ActionMenuItem[] {
    const t = (k: string) => this.translate.instant(K + k);
    const items: ActionMenuItem[] = [{ id: 'edit', icon: 'edit', label: t('EDIT') }];
    items.push(q.active
      ? { id: 'archive', icon: 'inventory_2', label: t('ARCHIVE') }
      : { id: 'restore', icon: 'unarchive', label: t('RESTORE') });
    if (q.answerCount === 0) items.push({ id: 'delete', icon: 'delete', label: t('DELETE'), variant: 'danger' });
    return items;
  }

  onMenu(q: InterviewQuestion, item: ActionMenuItem): void {
    this.error.set(null);
    if (item.id === 'edit') this.openEdit(q);
    else if (item.id === 'archive' || item.id === 'restore') this.toggleArchive(q, item.id === 'archive');
    else if (item.id === 'delete') this.confirmDeleteId.set(q.id);
  }

  // ── order ──

  move(index: number, delta: number): void {
    const list = [...this.questions()];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const before = this.questions();
    this.questions.set(list);           // optimistic: the row moves at once
    this.reordering.set(true);
    this.svc.reorderQuestions(this.type().id, list.map(q => q.id)).subscribe({
      next: q => { this.questions.set(q); this.reordering.set(false); },
      error: err => {
        this.questions.set(before);
        this.reordering.set(false);
        this.error.set(this.errText(err, 'SAVE_ERROR'));
      },
    });
  }

  // ── archive / delete ──

  private toggleArchive(q: InterviewQuestion, archive: boolean): void {
    const call = archive ? this.svc.archiveQuestion(q.id) : this.svc.restoreQuestion(q.id);
    call.subscribe({
      next: u => { this.replace(u); this.changed.emit(); },
      error: err => this.error.set(this.errText(err, 'SAVE_ERROR')),
    });
  }

  remove(q: InterviewQuestion): void {
    this.confirmDeleteId.set(null);
    this.svc.deleteQuestion(q.id).subscribe({
      next: () => { this.questions.update(l => l.filter(x => x.id !== q.id)); this.changed.emit(); },
      error: err => this.error.set(this.errText(err, 'SAVE_ERROR')),
    });
  }

  // ── editor ──

  openNew(): void {
    this.fill(null);
    this.editing.set('new');
  }

  openEdit(q: InterviewQuestion): void {
    this.fill(q);
    this.editing.set(q.id);
  }

  private fill(q: InterviewQuestion | null): void {
    this.fLabel.set(q?.label ?? '');
    this.fLabelEn.set(q?.labelEn ?? '');
    this.fHelp.set(q?.helpText ?? '');
    this.fType.set(q?.responseType ?? 'RATING');
    this.fRequired.set(q?.required ?? true);
    this.fOptions.set(q ? [...q.options] : []);
    this.fMin.set(q?.ratingMin ?? 1);
    this.fMax.set(q?.ratingMax ?? 5);
    this.fStep.set(q?.ratingStep ?? 1);
    this.fMinLabel.set(q?.ratingMinLabel ?? '');
    this.fMaxLabel.set(q?.ratingMaxLabel ?? '');
    this.preview.set(Math.round(((q?.ratingMin ?? 1) + (q?.ratingMax ?? 5)) / 2));
    this.locked.set((q?.answerCount ?? 0) > 0);
    this.formError.set(null);
  }

  closeEditor(): void {
    this.editing.set(null);
    this.formError.set(null);
  }

  onTypeChange(values: string[]): void {
    if (values[0]) this.fType.set(values[0] as InterviewQuestionType);
  }

  toInt(v: unknown, fallback: number): number {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? n : fallback;
  }

  /** Mirrors the server rules so the common mistakes are caught before the round trip. */
  private validate(): string | null {
    if (!this.fLabel().trim()) return 'ERR_LABEL';
    const type = this.fType();
    if (type === 'RATING') {
      const min = this.fMin(), max = this.fMax(), step = this.fStep();
      if (min < 0 || max > 100) return 'ERR_SCALE_BOUNDS';
      if (min >= max) return 'ERR_SCALE_ORDER';
      if (step <= 0 || (max - min) % step !== 0) return 'ERR_SCALE_STEP';
    }
    if ((type === 'SELECT' || type === 'MULTI_SELECT')
        && new Set(this.fOptions().map(o => o.trim()).filter(Boolean)).size < 2) return 'ERR_OPTIONS';
    return null;
  }

  save(): void {
    const invalid = this.validate();
    if (invalid) { this.formError.set(this.translate.instant(K + invalid)); return; }
    const type = this.fType();
    const dto: SaveInterviewQuestionRequest = {
      label: this.fLabel().trim(),
      labelEn: this.fLabelEn().trim(),
      helpText: this.fHelp().trim(),
      responseType: type,
      required: this.fRequired(),
      ...(type === 'RATING' ? {
        ratingMin: this.fMin(), ratingMax: this.fMax(), ratingStep: this.fStep(),
        ratingMinLabel: this.fMinLabel().trim(), ratingMaxLabel: this.fMaxLabel().trim(),
      } : {}),
      ...(type === 'SELECT' || type === 'MULTI_SELECT' ? { options: this.fOptions().map(o => o.trim()).filter(Boolean) } : {}),
    };
    const editing = this.editing();
    const call = editing === 'new'
      ? this.svc.createQuestion(this.type().id, dto)
      : this.svc.updateQuestion(editing as number, dto);
    this.saving.set(true);
    this.formError.set(null);
    call.subscribe({
      next: q => {
        this.saving.set(false);
        if (editing === 'new') this.questions.update(l => [...l, q]); else this.replace(q);
        this.editing.set(null);
        this.changed.emit();
      },
      error: err => { this.saving.set(false); this.formError.set(this.errText(err, 'SAVE_ERROR')); },
    });
  }

  private replace(q: InterviewQuestion): void {
    this.questions.update(l => l.map(x => x.id === q.id ? q : x));
  }

  private errText(err: { error?: { detail?: string } } | null, key: string): string {
    return err?.error?.detail ?? this.translate.instant(K + key);
  }
}
