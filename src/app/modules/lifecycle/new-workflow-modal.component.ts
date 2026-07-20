import {
  Component, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LifecycleService }  from './lifecycle.service';
import { ProfileService }    from '../profiles/profile.service';
import {
  DEPARTURE_REASONS, DEPARTURE_REASON_LABELS, DepartureReason,
} from './models/lifecycle.model';
import { EmployeeListItem }  from '../profiles/models/profile.model';
import { ModalComponent }    from '../../shared/modal.component';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-new-workflow-modal',
  standalone: true,
  imports: [ModalComponent, ReactiveFormsModule, ButtonComponent, StatusBadgeComponent],
  template: `
    <app-modal
      title="Démarrer un offboarding"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="onClose()"
    >
      <form [formGroup]="form" class="ob-form">

        <!-- Employee autocomplete -->
        <div class="field-full">
          <label class="form-label">Employé *</label>
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
              <ul class="ac-list">
                @for (s of suggestions(); track s.profileId) {
                  <li class="ac-item" (click)="selectEmployee(s)">
                    <span class="ac-name">{{ s.fullName }}</span>
                    @if (s.department) { <span class="ac-dept">{{ s.department }}</span> }
                    @if (s.email) { <span class="ac-email">{{ s.email }}</span> }
                  </li>
                }
              </ul>
            }
          </div>
          @if (selectedEmployee()) {
            <div class="selected-pill">
              <daf-badge [label]="selectedEmployee()!.fullName" [options]="{ variant: 'teal', size: 'sm' }" />
              <button type="button" class="pill-remove" (click)="clearEmployee()">✕</button>
            </div>
          }
          @if (form.get('employeeProfileId')?.touched && form.get('employeeProfileId')?.errors?.['required']) {
            <span class="field-error">Sélectionner un employé</span>
          }
        </div>

        <!-- Responsable passation -->
        <div class="field-full">
          <label class="form-label">Responsable passation (Passation des projets)</label>
          <div class="ac-wrap">
            <input
              class="form-input"
              type="text"
              [value]="managerQuery"
              (input)="onManagerInput($event)"
              placeholder="Rechercher le manager responsable…"
              autocomplete="off"
            />
            @if (managerSearchLoading()) { <span class="ac-spinner">…</span> }
            @if (managerSuggestions().length > 0) {
              <ul class="ac-list">
                @for (s of managerSuggestions(); track s.profileId) {
                  <li class="ac-item" (click)="selectManager(s)">
                    <span class="ac-name">{{ s.fullName }}</span>
                    @if (s.department) { <span class="ac-dept">{{ s.department }}</span> }
                    @if (s.email) { <span class="ac-email">{{ s.email }}</span> }
                  </li>
                }
              </ul>
            }
          </div>
          @if (selectedManager()) {
            <div class="selected-pill">
              <daf-badge [label]="selectedManager()!.fullName" [options]="{ variant: 'neutral', size: 'sm' }" />
              <button type="button" class="pill-remove" (click)="clearManager()">✕</button>
            </div>
          }
        </div>

        <!-- Motif de départ -->
        <div>
          <label class="form-label">Motif de départ *</label>
          <select class="form-input" formControlName="departureReason">
            <option value="">Sélectionner…</option>
            @for (r of DEPARTURE_REASONS; track r) {
              <option [value]="r">{{ DEPARTURE_REASON_LABELS[r] }}</option>
            }
          </select>
          @if (form.get('departureReason')?.touched && form.get('departureReason')?.errors?.['required']) {
            <span class="field-error">Requis</span>
          }
        </div>

        <!-- Date de déclenchement -->
        <div>
          <label class="form-label">Date de déclenchement *</label>
          <input class="form-input" type="date" formControlName="triggerDate" />
          @if (form.get('triggerDate')?.touched && form.get('triggerDate')?.errors?.['required']) {
            <span class="field-error">Requis</span>
          }
        </div>

        <!-- Dernier jour de travail -->
        <div>
          <label class="form-label">Dernier jour de travail</label>
          <input class="form-input" type="date" formControlName="lastWorkingDay" />
        </div>

        <!-- Notes -->
        <div class="field-full">
          <label class="form-label">Notes</label>
          <textarea class="form-input form-textarea" rows="2" formControlName="departureNotes" placeholder="Optionnel…"></textarea>
        </div>

        @if (errorMsg()) {
          <div class="error-banner" role="alert">{{ errorMsg() }}</div>
        }

      </form>

      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="onClose()" />
        <daf-button
          label="Démarrer"
          variant="teal"
          [options]="{ disabled: form.invalid || saving(), loading: saving() }"
          (onClick)="save()"
        />
      </div>
    </app-modal>
  `,
  styles: [`
    .ob-form        { display:grid;grid-template-columns:1fr 1fr;gap:16px }
    .field-full     { grid-column:1/-1 }
    .form-label     { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted,#6B7280);margin-bottom:4px }
    .form-input     { width:100%;padding:8px 12px;border:1px solid var(--color-border,#E0E7E9);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface,#fff);color:var(--color-text,#1A1C1E);outline:none;box-sizing:border-box;transition:border .15s }
    .form-input:focus { border-color:var(--color-primary,#1C4E5C) }
    .form-textarea  { resize:vertical }
    .field-error    { font-size:11px;color:#DC2626;margin-top:2px }
    .error-banner   { grid-column:1/-1;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }
    .ac-wrap        { position:relative }
    .ac-spinner     { position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--color-text-muted) }
    .ac-list        { position:absolute;z-index:200;top:calc(100% + 4px);left:0;right:0;background:var(--color-surface,#fff);border:1px solid var(--color-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);list-style:none;padding:4px 0;margin:0;max-height:200px;overflow-y:auto }
    .ac-item        { display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;font-size:13px }
    .ac-item:hover  { background:var(--color-bg-secondary,#EEF2F5) }
    .ac-name        { font-weight:500;flex:1 }
    .ac-dept        { font-size:11px;color:var(--color-text-muted);background:var(--color-bg-secondary);padding:1px 6px;border-radius:999px }
    .ac-email       { font-size:11px;color:var(--color-text-muted);margin-left:auto }
    .selected-pill  { display:inline-flex;align-items:center;gap:6px;margin-top:6px }
    .pill-remove    { background:none;border:none;cursor:pointer;color:var(--color-primary);font-size:14px;padding:0 }
    @media(max-width:520px) { .ob-form { grid-template-columns:1fr } }
  `],
})
export class NewWorkflowModalComponent {
  private fb          = inject(FormBuilder);
  private svc         = inject(LifecycleService);
  private profileSvc  = inject(ProfileService);

  visible = input(false);
  closed  = output<void>();
  created = output<number>();

  saving        = signal(false);
  searchLoading = signal(false);
  suggestions   = signal<EmployeeListItem[]>([]);
  selectedEmployee = signal<EmployeeListItem | null>(null);
  errorMsg      = signal<string | null>(null);
  employeeQuery = '';

  managerSearchLoading = signal(false);
  managerSuggestions   = signal<EmployeeListItem[]>([]);
  selectedManager      = signal<EmployeeListItem | null>(null);
  managerQuery         = '';

  protected readonly DEPARTURE_REASONS = DEPARTURE_REASONS;
  protected readonly DEPARTURE_REASON_LABELS = DEPARTURE_REASON_LABELS;

  form = this.fb.group({
    employeeProfileId:        [null as number | null, Validators.required],
    handoverManagerProfileId: [null as number | null],
    departureReason:          ['' as DepartureReason | '', Validators.required],
    triggerDate:              ['', Validators.required],
    lastWorkingDay:           [null as string | null],
    departureNotes:           [''],
  });

  private search$        = new Subject<string>();
  private managerSearch$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
      switchMap(q => {
        if (!q.trim()) { this.searchLoading.set(false); return of(null); }
        this.searchLoading.set(true);
        return this.profileSvc.listAllEmployees({ search: q }, 0, 8).pipe(catchError(() => of(null)));
      }),
    ).subscribe(res => {
      this.searchLoading.set(false);
      this.suggestions.set((res?.content ?? []).filter(e => e.hasProfile && e.profileId !== null));
    });

    this.managerSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
      switchMap(q => {
        if (!q.trim()) { this.managerSearchLoading.set(false); return of(null); }
        this.managerSearchLoading.set(true);
        return this.profileSvc.listAllEmployees({ search: q }, 0, 8).pipe(catchError(() => of(null)));
      }),
    ).subscribe(res => {
      this.managerSearchLoading.set(false);
      this.managerSuggestions.set((res?.content ?? []).filter(e => e.hasProfile && e.profileId !== null));
    });
  }

  onEmployeeInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.employeeQuery = q;
    if (!q.trim()) { this.suggestions.set([]); return; }
    this.search$.next(q);
  }

  selectEmployee(s: EmployeeListItem) {
    this.selectedEmployee.set(s);
    this.form.patchValue({ employeeProfileId: s.profileId });
    this.suggestions.set([]);
    this.employeeQuery = '';
  }

  clearEmployee() {
    this.selectedEmployee.set(null);
    this.form.patchValue({ employeeProfileId: null });
    this.employeeQuery = '';
    this.suggestions.set([]);
  }

  onManagerInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.managerQuery = q;
    if (!q.trim()) { this.managerSuggestions.set([]); return; }
    this.managerSearch$.next(q);
  }

  selectManager(s: EmployeeListItem) {
    this.selectedManager.set(s);
    this.form.patchValue({ handoverManagerProfileId: s.profileId });
    this.managerSuggestions.set([]);
    this.managerQuery = '';
  }

  clearManager() {
    this.selectedManager.set(null);
    this.form.patchValue({ handoverManagerProfileId: null });
    this.managerQuery = '';
    this.managerSuggestions.set([]);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.value;
    this.saving.set(true);
    this.errorMsg.set(null);

    this.svc.startOffboarding({
      employeeProfileId:        v.employeeProfileId!,
      departureReason:          v.departureReason as DepartureReason,
      triggerDate:              v.triggerDate!,
      lastWorkingDay:           v.lastWorkingDay            || undefined,
      departureNotes:           v.departureNotes            || undefined,
      handoverManagerProfileId: v.handoverManagerProfileId  ?? undefined,
    }).pipe(
      catchError(err => {
        this.errorMsg.set(err?.error?.message ?? err?.error?.detail ?? 'Erreur lors de la création');
        this.saving.set(false);
        return of(null);
      }),
    ).subscribe(result => {
      if (result) {
        this.saving.set(false);
        this.reset();
        this.created.emit(result.id);
      }
    });
  }

  onClose() { this.reset(); this.closed.emit(); }

  private reset() {
    this.form.reset();
    this.selectedEmployee.set(null);
    this.employeeQuery = '';
    this.suggestions.set([]);
    this.selectedManager.set(null);
    this.managerQuery = '';
    this.managerSuggestions.set([]);
    this.errorMsg.set(null);
  }
}
