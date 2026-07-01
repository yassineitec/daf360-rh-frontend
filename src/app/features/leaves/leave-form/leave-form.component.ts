import { Component, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LeaveService } from '../../../core/services/leave.service';
import { AbsenceType } from '../../../core/models/leave.model';
import { MultiDatePickerComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-leave-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MultiDatePickerComponent],
  template: `
    <div class="page-header">
      <div>
        <a class="back-link" routerLink="/leaves">← Leave Requests</a>
        <h2 class="page-title" style="margin-top:4px">Submit Leave Request</h2>
      </div>
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <div class="card" style="max-width: 560px">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="card-body" style="display:flex; flex-direction:column; gap:16px">

          <div class="form-group">
            <label class="form-label">Employee ID <span style="color:#333">*</span></label>
            <input class="form-control" type="number" formControlName="employeeId"/>
          </div>

          <div class="form-group">
            <label class="form-label">Absence type <span style="color:#333">*</span></label>
            <select class="form-control" formControlName="absenceType">
              @for (t of absenceTypes; track t.value) {
                <option [value]="t.value">{{ t.label }}</option>
              }
            </select>
          </div>

          <daf-multi-date-picker
            [value]="dateRange()"
            [config]="{ label: 'Période de congé', selectionMode: 'range', required: true, placeholder: 'Sélectionner une période', allowPastDays: true }"
            (valueChange)="onRangeChange($event)"
          />

          <div class="form-group">
            <label class="form-label">Comment</label>
            <textarea class="form-control" rows="3" formControlName="comment"
                      placeholder="Optional note…"></textarea>
          </div>

        </div>

        <div class="card-footer">
          <a class="btn btn-secondary" routerLink="/leaves">Cancel</a>
          <button class="btn btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Submitting…' : 'Submit request' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .back-link { font-size:0.82rem; color:var(--ink-400); text-decoration:none; }
    .back-link:hover { color: var(--ink-700); }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .card-footer { padding:14px 20px; border-top:var(--border); display:flex; justify-content:flex-end; gap:10px; }
  `],
})
export class LeaveFormComponent implements OnInit {
  form!: ReturnType<FormBuilder['group']>;

  saving    = signal(false);
  error     = signal('');
  dateRange = signal<Date | Date[] | null>(null);

  absenceTypes: { value: AbsenceType; label: string }[] = [
    { value: 'PAID_LEAVE',        label: 'Paid Leave' },
    { value: 'SICK_LEAVE',        label: 'Sick Leave' },
    { value: 'UNPAID_LEAVE',      label: 'Unpaid Leave' },
    { value: 'RTT',               label: 'RTT' },
    { value: 'MATERNITY_LEAVE',   label: 'Maternity Leave' },
    { value: 'PATERNITY_LEAVE',   label: 'Paternity Leave' },
    { value: 'TRAINING',          label: 'Training' },
    { value: 'EXCEPTIONAL',       label: 'Exceptional' },
  ];

  constructor(
    private fb: FormBuilder,
    private leaveService: LeaveService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      employeeId:  [null as number | null, Validators.required],
      absenceType: ['PAID_LEAVE' as AbsenceType, Validators.required],
      startDate:   ['', Validators.required],
      endDate:     ['', Validators.required],
      comment:     [null as string | null],
    });
  }

  onRangeChange(value: Date | Date[] | null): void {
    this.dateRange.set(value);
    if (Array.isArray(value) && value.length === 2) {
      const toISO = (d: Date) => d.toISOString().substring(0, 10);
      this.form.patchValue({ startDate: toISO(value[0]), endDate: toISO(value[1]) });
    } else {
      this.form.patchValue({ startDate: '', endDate: '' });
    }
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.leaveService.submit(this.form.value as any).subscribe({
      next:  () => this.router.navigate(['/leaves']),
      error: (e) => { this.error.set(e.error?.message ?? 'Failed to submit'); this.saving.set(false); },
    });
  }
}
