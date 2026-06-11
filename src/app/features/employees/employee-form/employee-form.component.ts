import { Component, OnInit, signal, Input } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { ContractType } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <!-- Header -->
    <div class="page-header">
      <div>
        <a class="back-link" routerLink="/employees">
          ← Employees
        </a>
        <h2 class="page-title" style="margin-top:4px">
          {{ employeeId ? 'Edit Employee' : 'New Employee' }}
        </h2>
      </div>
    </div>

    @if (error()) {
      <div class="alert alert-error">{{ error() }}</div>
    }

    <div class="card" style="max-width: 680px">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="card-body">

          <!-- Name row -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">First name <span class="req">*</span></label>
              <input class="form-control" formControlName="firstName"
                     [class.is-invalid]="invalid('firstName')" placeholder="Jean"/>
              @if (invalid('firstName')) {
                <span class="form-error">Required</span>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Last name <span class="req">*</span></label>
              <input class="form-control" formControlName="lastName"
                     [class.is-invalid]="invalid('lastName')" placeholder="Dupont"/>
              @if (invalid('lastName')) {
                <span class="form-error">Required</span>
              }
            </div>
          </div>

          <!-- Email -->
          <div class="form-group" style="margin-top:16px">
            <label class="form-label">Email address <span class="req">*</span></label>
            <input class="form-control" type="email" formControlName="email"
                   [class.is-invalid]="invalid('email')" placeholder="jean.dupont@company.com"/>
            @if (invalid('email')) {
              <span class="form-error">Valid email required</span>
            }
          </div>

          <!-- Hire date + Contract -->
          <div class="form-row" style="margin-top:16px">
            <div class="form-group">
              <label class="form-label">Hire date <span class="req">*</span></label>
              <input class="form-control" type="date" formControlName="hireDate"
                     [class.is-invalid]="invalid('hireDate')"/>
              @if (invalid('hireDate')) {
                <span class="form-error">Required</span>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Contract type <span class="req">*</span></label>
              <select class="form-control" formControlName="contractType"
                      [class.is-invalid]="invalid('contractType')">
                @for (ct of contractTypes; track ct) {
                  <option [value]="ct">{{ ct }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Position + Phone -->
          <div class="form-row" style="margin-top:16px">
            <div class="form-group">
              <label class="form-label">Position</label>
              <input class="form-control" formControlName="position"
                     placeholder="Software Engineer"/>
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-control" formControlName="phone"
                     placeholder="+33 6 00 00 00 00"/>
            </div>
          </div>

          <!-- Department + Manager IDs -->
          <div class="form-row" style="margin-top:16px">
            <div class="form-group">
              <label class="form-label">Department ID</label>
              <input class="form-control" type="number" formControlName="departmentId"
                     placeholder="1"/>
            </div>
            <div class="form-group">
              <label class="form-label">Manager ID</label>
              <input class="form-control" type="number" formControlName="managerId"
                     placeholder="42"/>
            </div>
          </div>

          <!-- Azure OID (optional) -->
          <div class="form-group" style="margin-top:16px">
            <label class="form-label">Azure Object ID</label>
            <input class="form-control mono" formControlName="azureOid"
                   placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
            <span class="text-muted" style="font-size:0.75rem">
              Links this employee to a Microsoft 365 account
            </span>
          </div>

        </div>

        <!-- Footer actions -->
        <div class="card-footer">
          <a class="btn btn-secondary" routerLink="/employees">Cancel</a>
          <button class="btn btn-primary" type="submit" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-inline"></span>
              Saving…
            } @else {
              {{ employeeId ? 'Save changes' : 'Create employee' }}
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .back-link {
      font-size: 0.82rem;
      color: var(--ink-400);
      text-decoration: none;
    }
    .back-link:hover { color: var(--ink-700); }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .req { color: var(--ink-700); }

    .card-footer {
      padding: 14px 20px;
      border-top: var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .spinner-inline {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class EmployeeFormComponent implements OnInit {
  @Input() id?: string; // route param via withComponentInputBinding

  form!: FormGroup;
  saving = signal(false);
  error  = signal('');

  contractTypes: ContractType[] = ['CDI', 'CDD', 'FREELANCE', 'INTERN'];

  get employeeId(): number | null {
    return this.id ? +this.id : null;
  }

  constructor(
    private fb: FormBuilder,
    private employeeService: EmployeeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName:    ['', Validators.required],
      lastName:     ['', Validators.required],
      email:        ['', [Validators.required, Validators.email]],
      hireDate:     ['', Validators.required],
      contractType: ['CDI', Validators.required],
      position:     [null],
      phone:        [null],
      departmentId: [null],
      managerId:    [null],
      azureOid:     [null],
    });

    if (this.employeeId) {
      this.loadEmployee(this.employeeId);
    }
  }

  private loadEmployee(id: number): void {
    this.employeeService.get(id).subscribe({
      next: (emp) => {
        this.form.patchValue({
          firstName:    emp.firstName,
          lastName:     emp.lastName,
          email:        emp.email,
          hireDate:     emp.hireDate,
          contractType: emp.contractType,
          position:     emp.position,
          phone:        emp.phone,
          departmentId: emp.departmentId,
          managerId:    emp.managerId,
        });
      },
      error: (e) => this.error.set(e.error?.message ?? 'Failed to load employee'),
    });
  }

  invalid(field: string): boolean {
    const ctrl = this.form.get(field)!;
    return ctrl.invalid && ctrl.touched;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const dto = { ...this.form.value };
    // Coerce empty strings / 0 to null for optional fields
    if (!dto.departmentId) dto.departmentId = null;
    if (!dto.managerId)    dto.managerId    = null;
    if (!dto.phone)        dto.phone        = null;
    if (!dto.position)     dto.position     = null;
    if (!dto.azureOid)     dto.azureOid     = null;

    this.saving.set(true);
    this.error.set('');

    const req$ = this.employeeId
      ? this.employeeService.update(this.employeeId, dto)
      : this.employeeService.create(dto);

    req$.subscribe({
      next:  () => this.router.navigate(['/employees']),
      error: (e) => {
        this.error.set(e.error?.message ?? 'Failed to save employee');
        this.saving.set(false);
      },
    });
  }
}
