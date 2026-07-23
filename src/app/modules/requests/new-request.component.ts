import {
  Component, inject, input, OnChanges, output, signal, SimpleChanges,
} from '@angular/core';
import {
  AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule,
  ValidationErrors, Validators,
} from '@angular/forms';
import { catchError, of } from 'rxjs';

import { RequestsService } from './requests.service';
import {
  FieldDef, RequestCategory, RequestType,
  CATEGORY_LABELS, getFieldsForType, isFileField, TYPE_FIELDS,
} from './models/request.model';
import { ModalComponent }  from '../../shared/modal.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { StatusBadgeComponent, ButtonComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// ── IBAN validator ─────────────────────────────────────────────────────────────
function ibanValidator(c: AbstractControl): ValidationErrors | null {
  const v = (c.value as string | null)?.replace(/\s/g, '').toUpperCase();
  if (!v) return null;
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/.test(v) ? null : { iban: true };
}

/** Groups request types by category for the selector. */
function groupByCategory(types: RequestType[]): Map<RequestCategory, RequestType[]> {
  const map = new Map<RequestCategory, RequestType[]>();
  for (const t of types) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category)!.push(t);
  }
  return map;
}

@Component({
  selector: 'app-new-request',
  standalone: true,
  imports: [ModalComponent, SpinnerComponent, ReactiveFormsModule, StatusBadgeComponent, ButtonComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="selectedType() ? (selectedType()!.displayNameFr) : ('REQUESTS.NEW.TITLE' | translate)"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="onClose()"
    >
      <div class="new-request-body">

        <!-- ── Step 1: Type selector ──────────────────────────── -->
        @if (!selectedType()) {
          @if (loadingTypes()) {
            <div class="center"><app-spinner /></div>
          } @else {
            <div class="type-selector">
              @for (entry of groupedTypes(); track entry[0]) {
                <div class="type-group">
                  <p class="type-group-label">{{ categoryLabel(entry[0]) }}</p>
                  <div class="type-grid">
                    @for (t of entry[1]; track t.id) {
                      <button
                        class="type-card"
                        [class.l2]="t.approvalLevel === 'L2'"
                        (click)="selectType(t)"
                        type="button"
                      >
                        <span class="type-card-name">{{ t.displayNameFr }}</span>
                        @if (t.description) {
                          <span class="type-card-desc">{{ t.description }}</span>
                        }
                        @if (t.approvalLevel === 'L2') {
                          <daf-badge [label]="'REQUESTS.NEW.FINANCE_VALIDATION_BADGE' | translate" [options]="{ variant: 'warning', size: 'sm' }" />
                        }
                        <span class="sla-info">{{ 'REQUESTS.NEW.SLA_DAYS' | translate:{ days: t.defaultSlaDays } }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- ── Step 2: Dynamic form ───────────────────────────── -->
        @if (selectedType()) {
          <div class="form-intro">
            @if (selectedType()!.description) {
              <p class="form-desc">{{ selectedType()!.description }}</p>
            }
            @if (selectedType()!.approvalLevel === 'L2') {
              <div class="l2-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {{ 'REQUESTS.NEW.L2_NOTICE' | translate }}
              </div>
            }
          </div>

          <form [formGroup]="dynamicForm" class="dynamic-form">
            @for (field of fields(); track field.key) {
              <div class="field-row" [class.field-wide]="field.wide">
                <label class="form-label">
                  {{ field.label }}
                  @if (field.required) { <span class="req">*</span> }
                </label>

                @if (field.type === 'textarea') {
                  <textarea
                    class="form-input"
                    [formControlName]="field.key"
                    [placeholder]="field.placeholder ?? ''"
                    rows="3"
                  ></textarea>
                } @else if (field.type === 'file') {
                  <div class="file-wrap">
                    <label class="file-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                      </svg>
                      {{ fileNames()[field.key] ?? ('REQUESTS.NEW.CHOOSE_FILE' | translate) }}
                      <input type="file" hidden (change)="onFileSelect($event, field.key)"
                             [accept]="field.key === 'photo' ? 'image/*' : '.pdf,.jpg,.jpeg,.png'" />
                    </label>
                    @if (field.hint) { <span class="field-hint">{{ field.hint }}</span> }
                  </div>
                } @else if (field.type === 'iban') {
                  <input
                    class="form-input"
                    type="text"
                    [formControlName]="field.key"
                    [placeholder]="field.placeholder ?? ''"
                    style="text-transform:uppercase; font-family: monospace"
                    (input)="formatIban($event, field.key)"
                  />
                } @else {
                  <input
                    class="form-input"
                    [type]="field.type"
                    [formControlName]="field.key"
                    [placeholder]="field.placeholder ?? ''"
                  />
                }

                @if (touched(field.key) && required(field.key)) {
                  <span class="field-error">{{ 'REQUESTS.NEW.FIELD_REQUIRED' | translate }}</span>
                }
                @if (touched(field.key) && ibanError(field.key)) {
                  <span class="field-error">{{ 'REQUESTS.NEW.IBAN_INVALID' | translate }}</span>
                }
              </div>
            }
          </form>

          @if (errorMsg()) {
            <div class="error-banner" role="alert">{{ errorMsg() }}</div>
          }
        }

      </div>

      <div slot="footer">
        @if (selectedType()) {
          <daf-button [label]="'REQUESTS.NEW.BACK' | translate" variant="secondary" (onClick)="selectedType.set(null)" />
        } @else {
          <daf-button [label]="'REQUESTS.NEW.CANCEL' | translate" variant="secondary" (onClick)="onClose()" />
        }
        @if (selectedType()) {
          <daf-button
            [label]="'REQUESTS.NEW.SUBMIT' | translate"
            variant="teal"
            [options]="{ disabled: dynamicForm.invalid || saving(), loading: saving() }"
            (onClick)="submit()"
          />
        }
      </div>
    </app-modal>
  `,
  styles: [`
    .new-request-body { min-height: 200px; }
    .center { display:flex;justify-content:center;padding:32px }

    /* Type selector */
    .type-selector  { display:flex;flex-direction:column;gap:20px }
    .type-group     {}
    .type-group-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--color-text-muted,#6B7280);margin:0 0 10px }
    .type-grid      { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px }
    .type-card      {
      display:flex;flex-direction:column;gap:4px;
      padding:12px 14px;text-align:left;
      border:1px solid var(--color-border,#E0E7E9);border-radius:10px;
      background:var(--color-surface,#fff);cursor:pointer;transition:all .15s;
      &:hover { border-color:var(--color-primary,#1C4E5C);background:var(--color-teal-50,#EBF4F7); }
      &.l2   { border-color:#D97706; }
    }
    .type-card-name { font-size:13px;font-weight:600;color:var(--color-text,#1A1C1E) }
    .type-card-desc { font-size:11px;color:var(--color-text-muted,#6B7280);line-height:1.3 }
    .sla-info       { font-size:10px;color:var(--color-text-muted,#6B7280);margin-top:auto }

    /* Dynamic form */
    .form-intro   { margin-bottom:16px }
    .form-desc    { font-size:13px;color:var(--color-text-muted,#6B7280);margin:0 0 10px }
    .l2-notice    { display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fffbeb;border-radius:8px;border-left:3px solid #D97706;font-size:12px;color:#92400e }
    .dynamic-form { display:grid;grid-template-columns:1fr 1fr;gap:14px }
    .field-row    { display:flex;flex-direction:column;gap:4px }
    .field-wide   { grid-column:1/-1 }
    .form-label   { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted,#6B7280) }
    .req          { color:#DC2626;margin-left:2px }
    .form-input   { padding:8px 12px;border:1px solid var(--color-border,#E0E7E9);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface,#fff);color:var(--color-text);outline:none;width:100%;transition:border .15s }
    .form-input:focus { border-color:var(--color-primary,#1C4E5C) }
    .field-hint   { font-size:11px;color:var(--color-text-muted,#6B7280) }
    .field-error  { font-size:11px;color:#DC2626 }
    .file-wrap    { display:flex;flex-direction:column;gap:4px }
    .file-label   {
      display:inline-flex;align-items:center;gap:7px;
      padding:8px 14px;border:1px dashed var(--color-border);border-radius:8px;
      font-size:13px;cursor:pointer;color:var(--color-text-muted);transition:all .15s;
      &:hover { border-color:var(--color-primary);color:var(--color-primary) }
    }
    .error-banner { margin-top:12px;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }
    .btn-primary  { display:inline-flex;align-items:center;gap:6px;padding:8px 20px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer }
    .btn-primary:disabled { opacity:.5;cursor:not-allowed }
    .btn-ghost    { padding:7px 16px;border:1px solid var(--color-border);border-radius:8px;background:none;font-size:13px;cursor:pointer;color:var(--color-text-muted) }
    @media(max-width:500px) { .dynamic-form { grid-template-columns:1fr } }
  `],
})
export class NewRequestComponent implements OnChanges {
  private fb  = inject(FormBuilder);
  private svc = inject(RequestsService);
  private translate = inject(TranslateService);

  profileId = input(0);
  paysId    = input(1);
  visible   = input(false);

  closed    = output<void>();
  submitted = output<void>();

  loadingTypes = signal(false);
  saving       = signal(false);
  errorMsg     = signal<string | null>(null);
  types        = signal<RequestType[]>([]);
  selectedType = signal<RequestType | null>(null);
  fileNames    = signal<Record<string, string | undefined>>({});
  fileMap      = new Map<string, File>();

  dynamicForm  = this.fb.group({});
  fields       = signal<FieldDef[]>([]);

  readonly categoryLabel = (c: string) => CATEGORY_LABELS[c as RequestCategory] ?? c;

  groupedTypes = () => {
    const g = groupByCategory(this.types());
    return Array.from(g.entries());
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true && this.types().length === 0) {
      this.loadTypes();
    }
    if (changes['visible']?.currentValue === false) {
      this.reset();
    }
  }

  private loadTypes() {
    this.loadingTypes.set(true);
    this.svc.listTypes(this.paysId()).pipe(catchError(() => of([]))).subscribe(ts => {
      this.types.set(ts.filter(t => t.isActive));
      this.loadingTypes.set(false);
    });
  }

  selectType(t: RequestType) {
    this.selectedType.set(t);
    this.errorMsg.set(null);
    const fieldDefs = getFieldsForType(t.typeCode);
    this.fields.set(fieldDefs);
    this.buildForm(fieldDefs);
  }

  private buildForm(fieldDefs: FieldDef[]) {
    const ctrl: Record<string, unknown> = {};
    for (const f of fieldDefs) {
      if (isFileField(f)) continue;   // files handled separately
      const validators = [];
      if (f.required) validators.push(Validators.required);
      if (f.pattern)  validators.push(Validators.pattern(f.pattern));
      if (f.type === 'iban') validators.push(ibanValidator);
      if (f.type === 'email') validators.push(Validators.email);
      ctrl[f.key] = ['', validators];
    }
    this.dynamicForm = this.fb.group(ctrl);
  }

  onFileSelect(e: Event, key: string) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fileMap.set(key, file);
    this.fileNames.update(m => ({ ...m, [key]: file.name }));
  }

  submit() {
    this.dynamicForm.markAllAsTouched();
    if (this.dynamicForm.invalid) return;

    const t = this.selectedType()!;

    // Check required file fields
    const requiredFiles = this.fields().filter(f => isFileField(f) && f.required);
    for (const rf of requiredFiles) {
      if (!this.fileMap.has(rf.key)) {
        this.errorMsg.set(this.translate.instant('REQUESTS.NEW.FILE_REQUIRED', { label: rf.label }));
        return;
      }
    }

    const formValues = this.dynamicForm.value as Record<string, unknown>;
    const comment = (formValues['comment'] as string) ?? '';
    const attachment = this.fileMap.get('attachment') ?? this.fileMap.values().next().value ?? null;

    this.saving.set(true);
    this.errorMsg.set(null);

    this.svc.submitRequest(this.profileId(), t.id, comment, attachment)
      .pipe(catchError(err => {
        this.errorMsg.set(err?.error?.message ?? this.translate.instant('REQUESTS.NEW.ERROR_SUBMIT'));
        this.saving.set(false);
        return of(null);
      }))
      .subscribe(r => {
        if (r) { this.saving.set(false); this.submitted.emit(); }
      });
  }

  onClose() { this.reset(); this.closed.emit(); }

  private reset() {
    this.selectedType.set(null);
    this.fields.set([]);
    this.fileMap.clear();
    this.fileNames.set({});
    this.errorMsg.set(null);
    this.dynamicForm = this.fb.group({});
  }

  // ── Template helpers ──────────────────────────────────────────────────────
  touched(key: string): boolean { return this.dynamicForm.get(key)?.touched ?? false; }
  required(key: string): boolean { return !!(this.dynamicForm.get(key)?.errors?.['required']); }
  ibanError(key: string): boolean { return !!(this.dynamicForm.get(key)?.errors?.['iban']); }

  formatIban(e: Event, key: string) {
    const el = e.target as HTMLInputElement;
    const v  = el.value.replace(/\s/g, '').toUpperCase();
    this.dynamicForm.get(key)?.setValue(v, { emitEvent: false });
    el.value = v;
  }
}
