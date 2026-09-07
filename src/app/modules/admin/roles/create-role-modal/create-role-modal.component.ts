import { Component, TemplateRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import {
  FormFieldComponent,
  SelectComponent, SelectOption,
  ButtonComponent,
  ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { RoleManagementService } from '../role-management.service';
import { PaysOption, PaysScopeMode, RoleListItem } from '../role.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-create-role-modal',
  standalone: true,
  imports: [FormFieldComponent, SelectComponent, ButtonComponent, TranslatePipe],
  templateUrl: './create-role-modal.component.html',
  styleUrl: './create-role-modal.component.scss',
})
export class CreateRoleModalComponent {
  allRoles = input<RoleListItem[]>([]);

  roleCreated = output<RoleListItem>();

  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);
  private modal = inject(ModalService);
  private modalRef?: ModalRef;

  /** Projected into the real daf-modal-host via ModalService — buttons live in here too,
   * not in ModalConfig.buttons, because that config is a one-shot snapshot: it can't react
   * to `saving()`/`frenchName()` afterward the way a normal template binding can. */
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  frenchName    = signal('');
  parentRoleId  = signal<number | null>(null);
  paysScopeMode = signal<PaysScopeMode>('OWN');
  paysScope     = signal<number[]>([]);
  paysOptions   = signal<PaysOption[]>([]);
  saving        = signal(false);
  error         = signal<string | null>(null);

  constructor() {
    this.svc.getPaysOptions().subscribe(list => this.paysOptions.set(list));
  }

  parentOptions = computed<SelectOption[]>(() =>
    this.allRoles().map(r => ({ value: String(r.id), label: r.frenchName }))
  );

  parentSelected = computed(() =>
    this.parentRoleId() != null ? [String(this.parentRoleId())] : []
  );

  scopeModeOptions = computed<SelectOption[]>(() => [
    { value: 'OWN',  label: this.translate.instant('ADMIN.roles.info.SCOPE_MODE_OWN') },
    { value: 'LIST', label: this.translate.instant('ADMIN.roles.info.SCOPE_MODE_LIST') },
    { value: 'ALL',  label: this.translate.instant('ADMIN.roles.info.SCOPE_MODE_ALL') },
  ]);

  paysSelectOptions = computed<SelectOption[]>(() =>
    this.paysOptions().map(p => ({
      value: String(p.id),
      label: p.frenchLabel ?? p.isoCode ?? String(p.id),
    })),
  );

  showCountryPicker = computed(() => this.paysScopeMode() === 'LIST');

  scopeModeHint = computed(() =>
    this.translate.instant(`ADMIN.roles.info.SCOPE_HINT_${this.paysScopeMode()}`),
  );

  scopeModeSelected = computed(() => [this.paysScopeMode()]);

  onScopeModeChange(value: string[]): void {
    const mode = (value[0] ?? 'OWN') as PaysScopeMode;
    this.paysScopeMode.set(mode);
    if (mode !== 'LIST') this.paysScope.set([]);
  }

  paysScopeSelected = computed(() => this.paysScope().map(String));

  onPaysScopeChange(value: string[]): void {
    this.paysScope.set(value.map(Number).filter(n => !Number.isNaN(n)));
  }

  /** Called by the "Nouveau rôle" button — replaces the old `[visible]` input. */
  open(): void {
    this.reset();
    this.modalRef = this.modal.open({
      title: this.translate.instant('ADMIN.roles.create.TITLE'),
      body: this.bodyTpl(),
      size: 'md',
      // The form has unsaved input the moment it's open — an accidental backdrop
      // click must not silently drop it the way it would for a plain confirm dialog.
      closeOnBackdrop: false,
    });
  }

  cancel(): void {
    this.modalRef?.close();
  }

  create(): void {
    if (!this.frenchName().trim()) return;
    this.saving.set(true);
    this.error.set(null);

    this.svc
      .createRole({
        frenchName:    this.frenchName().trim(),
        parentRoleId:  this.parentRoleId(),
        paysScopeMode: this.paysScopeMode(),
        showAll:       this.paysScopeMode() === 'ALL',
        ...(this.paysScopeMode() === 'LIST' ? { paysScope: this.paysScope() } : {}),
      })
      .subscribe({
        next: (role) => {
          this.saving.set(false);
          this.roleCreated.emit(role);
          this.modalRef?.close();
        },
        error: (err) => {
          this.saving.set(false);
          // ProblemDetail: the message lives in `detail`.
          this.error.set(
            err?.error?.detail
              ?? err?.error?.message
              ?? this.translate.instant('ADMIN.roles.create.CREATE_ERROR'),
          );
        },
      });
  }

  reset(): void {
    this.frenchName.set('');
    this.parentRoleId.set(null);
    this.paysScopeMode.set('OWN');
    this.paysScope.set([]);
    this.error.set(null);
  }

  onParentChange(value: string): void {
    this.parentRoleId.set(value ? Number(value) : null);
  }
}
