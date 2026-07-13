import {
  Component, computed, inject, input, output, signal,
} from '@angular/core';
import {
  FormBuilder, ReactiveFormsModule, Validators,
} from '@angular/forms';
import {
  debounceTime, distinctUntilChanged, Subject, switchMap, catchError, of,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LifecycleService }  from './lifecycle.service';
import { ProfileService }    from '../profiles/profile.service';
import { WORKFLOW_EVENT_TYPES, EVENT_TYPE_LABELS } from './models/lifecycle.model';
import { ProfileSummary }    from '../profiles/models/profile.model';
import { ModalComponent }    from '../../shared/modal.component';
import { StatusBadgeComponent, ButtonComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-new-workflow-modal',
  standalone: true,
  imports: [ModalComponent, ReactiveFormsModule, StatusBadgeComponent, ButtonComponent],
  template: `
    <app-modal
      title="Nouveau workflow"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" class="wf-form">

        <!-- Employee autocomplete -->
        <div class="field-row field-full">
          <label class="form-label">Employé (profil) *</label>
          <div class="ac-wrap">
            <input
              class="form-input"
              type="text"
              [value]="employeeQuery"
              (input)="onEmployeeInput($event)"
              placeholder="Rechercher par nom ou identifiant…"
              autocomplete="off"
            />
            @if (searchLoading()) { <span class="ac-spinner">…</span> }
            @if (suggestions().length > 0) {
              <ul class="ac-list" role="listbox">
                @for (s of suggestions(); track s.id) {
                  <li
                    class="ac-item" role="option"
                    (click)="selectEmployee(s)"
                    (keydown.enter)="selectEmployee(s)"
                    tabindex="0"
                  >
                    <span class="ac-id">Profil #{{ s.id }}</span>
                    @if (s.fullName) { <span class="ac-name">{{ s.fullName }}</span> }
                    @if (s.department) { <span class="ac-type">{{ s.department }}</span> }
                  </li>
                }
              </ul>
            }
          </div>
          @if (selectedEmployee()) {
            <div class="selected-pill">
              <daf-badge [label]="selectedEmployeeLabel()" [options]="{ variant: 'teal', size: 'sm' }" />
              <button type="button" (click)="clearEmployee()" aria-label="Retirer">✕</button>
            </div>
          }
          @if (form.get('employeeProfileId')?.touched && form.get('employeeProfileId')?.errors?.['required']) {
            <span class="field-error">Sélectionner un employé</span>
          }
        </div>

        <!-- Event type -->
        <div class="field-row">
          <label class="form-label">Type d'événement *</label>
          <select class="form-input" formControlName="eventType">
            <option value="">Sélectionner…</option>
            @for (t of eventTypes; track t) { <option [value]="t">{{ eventLabel(t) }}</option> }
          </select>
          @if (form.get('eventType')?.touched && form.get('eventType')?.errors?.['required']) {
            <span class="field-error">Requis</span>
          }
        </div>

        <!-- Start date -->
        <div class="field-row">
          <label class="form-label">Date de démarrage</label>
          <input class="form-input" type="date" formControlName="startDate" />
        </div>

        <!-- Due date -->
        <div class="field-row">
          <label class="form-label">Échéance cible</label>
          <input class="form-input" type="date" formControlName="dueDate" />
        </div>

        <!-- Notes -->
        <div class="field-row field-full">
          <label class="form-label">Notes</label>
          <textarea class="form-input form-textarea" rows="3" formControlName="notes" placeholder="Optionnel…"></textarea>
        </div>

        @if (errorMsg()) {
          <div class="error-banner" role="alert">{{ errorMsg() }}</div>
        }

      </form>

      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="closed.emit()" />
        <daf-button
          label="Créer"
          variant="teal"
          [options]="{ disabled: form.invalid || saving(), loading: saving() }"
          (onClick)="save()"
        />
      </div>
    </app-modal>
  `,
  styles: [`
    .wf-form       { display:grid;grid-template-columns:1fr 1fr;gap:16px }
    .field-row     { display:flex;flex-direction:column;gap:4px }
    .field-full    { grid-column:1/-1 }
    .form-label    { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted,#6B7280) }
    .form-input    { padding:8px 12px;border:1px solid var(--color-border,#E0E7E9);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface,#fff);color:var(--color-text,#1A1C1E);outline:none;width:100%;transition:border .15s }
    .form-input:focus { border-color:var(--color-primary,#1C4E5C) }
    .form-textarea { resize:vertical }
    .field-error   { font-size:11px;color:#DC2626 }
    .error-banner  { grid-column:1/-1;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }
    .ac-wrap       { position:relative }
    .ac-spinner    { position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--color-text-muted) }
    .ac-list       { position:absolute;z-index:200;top:calc(100% + 4px);left:0;right:0;background:var(--color-surface,#fff);border:1px solid var(--color-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);list-style:none;padding:4px 0;margin:0;max-height:200px;overflow-y:auto }
    .ac-item       { display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;font-size:13px }
    .ac-item:hover { background:var(--color-bg-secondary,#EEF2F5) }
    .ac-id   { font-family:monospace;font-size:12px;color:var(--color-text-muted) }
    .ac-name { font-weight:500;flex:1 }
    .ac-type { font-size:11px;color:var(--color-text-muted);background:var(--color-bg-secondary);padding:1px 6px;border-radius:999px }
    .selected-pill { display:inline-flex;align-items:center;gap:6px;margin-top:6px }
    .selected-pill button { background:none;border:none;cursor:pointer;color:var(--color-primary);font-size:14px;padding:0 }
    .btn-primary { display:inline-flex;align-items:center;gap:6px;padding:8px 20px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer }
    .btn-primary:disabled { opacity:.5;cursor:not-allowed }
    .btn-ghost { padding:7px 16px;border:1px solid var(--color-border);border-radius:8px;background:none;font-size:13px;cursor:pointer;color:var(--color-text-muted) }
    @media(max-width:500px) { .wf-form { grid-template-columns:1fr } }
  `],
})
export class NewWorkflowModalComponent {
  private fb           = inject(FormBuilder);
  private lifecycleSvc = inject(LifecycleService);
  private profileSvc   = inject(ProfileService);

  visible = input(false);
  closed  = output<void>();
  created = output<void>();

  saving        = signal(false);
  searchLoading = signal(false);
  suggestions   = signal<ProfileSummary[]>([]);
  selectedEmployee = signal<ProfileSummary | null>(null);
  errorMsg      = signal<string | null>(null);
  employeeQuery = '';

  readonly eventTypes = [...WORKFLOW_EVENT_TYPES];

  selectedEmployeeLabel = computed(() => {
    const s = this.selectedEmployee();
    if (!s) return '';
    return s.fullName ? `Profil #${s.id} — ${s.fullName}` : `Profil #${s.id}`;
  });

  form = this.fb.group({
    employeeProfileId: [null as number | null, Validators.required],
    eventType:         ['', Validators.required],
    startDate:         [null as string | null],
    dueDate:           [null as string | null],
    notes:             [''],
  });

  private search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
      switchMap(q => {
        if (!q.trim()) { this.searchLoading.set(false); return of(null); }
        this.searchLoading.set(true);
        return this.profileSvc.list({ search: q, size: 8 }).pipe(catchError(() => of(null)));
      })
    ).subscribe(res => {
      this.searchLoading.set(false);
      this.suggestions.set(res?.content ?? []);
    });
  }

  onEmployeeInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.employeeQuery = q;
    if (!q.trim()) { this.suggestions.set([]); return; }
    this.search$.next(q);
  }

  selectEmployee(s: ProfileSummary) {
    this.selectedEmployee.set(s);
    this.form.patchValue({ employeeProfileId: s.id });
    this.suggestions.set([]);
    this.employeeQuery = '';
  }

  clearEmployee() {
    this.selectedEmployee.set(null);
    this.form.patchValue({ employeeProfileId: null });
    this.employeeQuery = '';
    this.suggestions.set([]);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.value;
    this.saving.set(true);
    this.errorMsg.set(null);

    this.lifecycleSvc.createWorkflow({
      employeeProfileId: v.employeeProfileId!,
      eventType:         v.eventType!,
      startDate:         v.startDate ?? undefined,
      dueDate:           v.dueDate   ?? undefined,
      notes:             v.notes     || undefined,
    }).pipe(
      catchError(err => {
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la création');
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(w => {
      if (w) { this.saving.set(false); this.form.reset(); this.created.emit(); }
    });
  }

  eventLabel(t: string) { return EVENT_TYPE_LABELS[t] ?? t; }
}
