import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, FormFieldComponent } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { EmployeeProfile } from '../models/profile.model';
import { contractLabel } from '../profile-labels';
import {
  BenefitCatalogueDto, EmployeePayrollBonusDto, EmployeePayrollConfigDto, RemunerationService,
} from '../services/remuneration.service';

const BONUS_CURRENCIES = ['TND', 'EUR', 'USD', 'EGP', 'SAR', 'AED'];

/**
 * "Rémunération" — the employee's payroll configuration (country, contract type,
 * benefits-in-kind, current net salary), owned by daf360-payroll-service, not this page's
 * own ProfileUpdateDto. Self-contained like the Contrats/Matériel tabs: its own load, its
 * own save, its own local state — it never touches the page's global editForm/patch cycle,
 * because that cycle only ever saves to THIS service's own PATCH endpoint. See
 * docs/superpowers/specs/2026-09-22-employee-payroll-config-design.md.
 */
@Component({
  selector: 'rh-remuneration-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, FormFieldComponent, ButtonComponent, FormsModule, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'PROFILES.SECTIONS.REMUNERATION' | translate"
      icon="account_balance_wallet">

      @if (loading()) {
        <p class="text-[13px] text-on-surface-variant">…</p>
      } @else if (config(); as cfg) {
        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Country is read-only here — deliberately: it's inherited from the employee's
               own profile, and only rarely needs overriding, which is handled from the
               dedicated Payroll app screen where the full country picker already lives.
               See docs/superpowers/specs/2026-09-22-employee-payroll-config-design.md §5. -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {{ 'PROFILES.FIELDS.REMUNERATION_COUNTRY' | translate }}
            </label>
            <span class="text-[13px]">{{ profile().paysLabel }}</span>
          </div>

          <!-- Contract type is read-only here too, same reasoning as Country above: it's the
               employee's real value from the HR system, not an independent payroll setting. -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {{ 'PROFILES.FIELDS.REMUNERATION_CONTRACT_TYPE' | translate }}
            </label>
            <span class="text-[13px]">{{ contractTypeLabel() }}</span>
          </div>

          <daf-form-field
            [value]="cfg.currentGrossSalary"
            [options]="{ type: 'number', label: ('PROFILES.FIELDS.REMUNERATION_GROSS_SALARY' | translate), fullWidth: true }"
            (valueChange)="patchConfig({ currentGrossSalary: asNumber($event) })" />

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">&nbsp;</label>
            <daf-button
              [options]="{
                variant: 'secondary', pill: true, iconStart: 'calculate',
                label: ('PROFILES.FIELDS.REMUNERATION_CALCULATE_NET' | translate),
                loading: calculatingNet(), disabled: calculatingNet() || cfg.currentGrossSalary == null
              }"
              (onClick)="calculateNet()" />
          </div>

          <daf-form-field
            [value]="cfg.currentNetSalary"
            [options]="{ type: 'number', label: ('PROFILES.FIELDS.REMUNERATION_CURRENT_SALARY' | translate), fullWidth: true }"
            (valueChange)="patchConfig({ currentNetSalary: asNumber($event) })" />
        </div>

        <div class="mb-4 flex flex-col gap-2 rounded-xl border border-outline-variant p-4">
          <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {{ 'PROFILES.FIELDS.REMUNERATION_BONUSES' | translate }}
          </label>
          @for (b of bonuses(); track b.id) {
            <div class="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-[13px]">
              <span>{{ b.periodMonth }}/{{ b.periodYear }} — {{ b.label }} ({{ b.amount }} {{ b.currency }})</span>
              <button type="button" class="text-danger" title="{{ 'PROFILES.FIELDS.REMUNERATION_DELETE_BONUS' | translate }}" (click)="deleteBonus(b.id)">✕</button>
            </div>
          }
          <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ 'PROFILES.FIELDS.REMUNERATION_BONUS_AMOUNT' | translate }}</label>
              <input type="number" [placeholder]="'PROFILES.FIELDS.REMUNERATION_BONUS_AMOUNT' | translate" class="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]"
                [ngModel]="newBonusAmount()" (ngModelChange)="newBonusAmount.set($any($event))" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ 'PROFILES.FIELDS.REMUNERATION_BONUS_CURRENCY' | translate }}</label>
              <select class="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]"
                [ngModel]="newBonusCurrency()" (ngModelChange)="newBonusCurrency.set($event)">
                @for (c of bonusCurrencies; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ 'PROFILES.FIELDS.REMUNERATION_BONUS_MONTH' | translate }}</label>
              <input type="number" [placeholder]="'PROFILES.FIELDS.REMUNERATION_BONUS_MONTH' | translate" min="1" max="12" class="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]"
                [ngModel]="newBonusMonth()" (ngModelChange)="newBonusMonth.set($any($event))" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ 'PROFILES.FIELDS.REMUNERATION_BONUS_YEAR' | translate }}</label>
              <input type="number" [placeholder]="'PROFILES.FIELDS.REMUNERATION_BONUS_YEAR' | translate" class="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]"
                [ngModel]="newBonusYear()" (ngModelChange)="newBonusYear.set($any($event))" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ 'PROFILES.FIELDS.REMUNERATION_BONUS_LABEL' | translate }}</label>
              <input type="text" [placeholder]="'PROFILES.FIELDS.REMUNERATION_BONUS_LABEL' | translate" class="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]"
                [ngModel]="newBonusLabel()" (ngModelChange)="newBonusLabel.set($event)" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{{ 'PROFILES.FIELDS.REMUNERATION_BONUS_COMMENT' | translate }}</label>
            <input type="text" [placeholder]="'PROFILES.FIELDS.REMUNERATION_BONUS_COMMENT' | translate" class="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]"
              [ngModel]="newBonusComment()" (ngModelChange)="newBonusComment.set($event)" />
          </div>
          <daf-button
            [options]="{ variant: 'teal', pill: true, iconStart: 'add', label: ('PROFILES.FIELDS.REMUNERATION_ADD_BONUS' | translate) }"
            (onClick)="addBonus()" />
          @if (bonusError()) {
            <span class="text-[12.5px] text-danger">{{ bonusError() }}</span>
          }
        </div>

        @if (benefits().length) {
          <div class="mb-4 flex flex-col gap-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {{ 'PROFILES.FIELDS.REMUNERATION_BENEFITS' | translate }}
            </label>
            <div class="flex flex-col gap-2">
              @for (b of benefits(); track b.benefitCode) {
                <label class="flex items-center gap-2 text-[13px]">
                  <input type="checkbox"
                    [checked]="isBenefitSelected(cfg, b.benefitCode)"
                    (change)="toggleBenefit(cfg, b.benefitCode)" />
                  {{ b.benefitLabelFr }}
                </label>
              }
            </div>
          </div>
        }

        <daf-form-field
          [value]="reason()"
          [options]="{ label: ('PROFILES.FIELDS.REMUNERATION_REASON' | translate), fullWidth: true }"
          (valueChange)="reason.set($any($event) ?? '')" />

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <daf-button
            [options]="{
              variant: 'teal', pill: true, iconStart: 'save',
              label: ('PROFILES.FIELDS.REMUNERATION_SAVE' | translate),
              loading: saving(), disabled: saving() || reason().trim() === ''
            }"
            (onClick)="save()" />

          @if (success()) {
            <span class="flex items-center gap-1.5 text-[12.5px] text-teal">
              <span class="material-symbols-outlined text-[15px]"
                    style="font-variation-settings:'FILL' 1">check_circle</span>
              {{ success() }}
            </span>
          }
          @if (error()) {
            <span class="flex items-center gap-1.5 text-[12.5px] text-danger">
              <span class="material-symbols-outlined text-[15px]">error</span>
              {{ error() }}
            </span>
          }
        </div>
      } @else if (error()) {
        <p class="text-[13px] text-danger">{{ error() }}</p>
      }
    </rh-section-card>
  `,
})
export class RemunerationSectionComponent implements OnInit {
  private svc = inject(RemunerationService);
  private translate = inject(TranslateService);

  readonly profile = input.required<EmployeeProfile>();

  readonly config   = signal<EmployeePayrollConfigDto | null>(null);
  readonly benefits = signal<BenefitCatalogueDto[]>([]);
  readonly reason   = signal('');
  readonly loading  = signal(true);
  readonly saving   = signal(false);
  readonly calculatingNet = signal(false);
  readonly error    = signal<string | null>(null);
  readonly success  = signal<string | null>(null);

  readonly bonusCurrencies = BONUS_CURRENCIES;
  readonly bonuses = signal<EmployeePayrollBonusDto[]>([]);
  readonly newBonusAmount = signal<number | null>(null);
  readonly newBonusCurrency = signal('TND');
  readonly newBonusMonth = signal<number | null>(new Date().getMonth() + 1);
  readonly newBonusYear = signal<number | null>(new Date().getFullYear());
  readonly newBonusLabel = signal('');
  readonly newBonusComment = signal('');
  readonly bonusError = signal<string | null>(null);

  ngOnInit(): void {
    this.svc.get(this.profile().userId).subscribe({
      next: raw => {
        // A never-configured employee comes back with paysId null when payroll-service's own
        // cross-service HR lookup can't resolve it — but this app already has the employee's
        // real country on the loaded profile, so use that instead of leaving the form
        // half-empty (and unsaveable: the backend's own upsert requires a non-null paysId).
        // contractType is likewise always overridden from the HR profile, never trusted from
        // payroll's own stored value — this screen no longer lets it be set independently.
        const cfg = { ...raw, paysId: raw.paysId ?? this.profile().paysId, contractType: this.profile().contractType ?? '' };
        this.config.set(cfg);
        this.loading.set(false);
        this.svc.getBenefits(cfg.paysId).subscribe({
          next: ps => this.benefits.set(ps.benefits ?? []),
          error: () => this.benefits.set([]),
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_LOAD_ERROR'));
      },
    });
    this.svc.getBonuses(this.profile().userId).subscribe({
      next: list => this.bonuses.set(list),
      error: () => this.bonusError.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_BONUS_LOAD_ERROR')),
    });
  }

  calculateNet(): void {
    const cfg = this.config();
    if (!cfg || cfg.currentGrossSalary == null) return;
    this.calculatingNet.set(true);
    this.error.set(null);
    this.svc.calculateNet(this.profile().userId, cfg.currentGrossSalary).subscribe({
      next: res => {
        this.calculatingNet.set(false);
        this.config.set({ ...cfg, currentNetSalary: res.netInHand });
      },
      error: () => {
        this.calculatingNet.set(false);
        this.error.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_CALCULATE_ERROR'));
      },
    });
  }

  addBonus(): void {
    const amount = this.newBonusAmount();
    const month = this.newBonusMonth();
    const year = this.newBonusYear();
    const label = this.newBonusLabel().trim();
    this.bonusError.set(null);
    if (amount == null || amount <= 0 || label === '' || month == null || year == null
      || month < 1 || month > 12) {
      this.bonusError.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_BONUS_VALIDATION_ERROR'));
      return;
    }
    this.svc.createBonus(this.profile().userId, {
      amount,
      currency: this.newBonusCurrency(),
      periodMonth: month,
      periodYear: year,
      label,
      comment: this.newBonusComment().trim() || null,
    }).subscribe({
      next: created => {
        this.bonuses.set([created, ...this.bonuses()]);
        this.newBonusAmount.set(null);
        this.newBonusLabel.set('');
        this.newBonusComment.set('');
      },
      error: () => this.bonusError.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_BONUS_SAVE_ERROR')),
    });
  }

  deleteBonus(bonusId: number): void {
    this.bonusError.set(null);
    this.svc.deleteBonus(this.profile().userId, bonusId).subscribe({
      next: () => this.bonuses.set(this.bonuses().filter(b => b.id !== bonusId)),
      error: () => this.bonusError.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_BONUS_DELETE_ERROR')),
    });
  }

  patchConfig(partial: Partial<EmployeePayrollConfigDto>): void {
    const cfg = this.config();
    if (cfg) this.config.set({ ...cfg, ...partial });
  }

  contractTypeLabel(): string {
    return contractLabel(this.profile().contractType, this.translate);
  }

  isBenefitSelected(cfg: EmployeePayrollConfigDto, code: string): boolean {
    return cfg.selectedBenefitCodes.includes(code);
  }

  toggleBenefit(cfg: EmployeePayrollConfigDto, code: string): void {
    const selected = cfg.selectedBenefitCodes.includes(code)
      ? cfg.selectedBenefitCodes.filter(c => c !== code)
      : [...cfg.selectedBenefitCodes, code];
    this.config.set({ ...cfg, selectedBenefitCodes: selected });
  }

  asNumber(v: unknown): number | null {
    return v === null || v === undefined || v === '' ? null : Number(v);
  }

  save(): void {
    const cfg = this.config();
    if (!cfg || this.reason().trim() === '') return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.svc.upsert(this.profile().userId, {
      // Non-null by construction: ngOnInit's `raw.paysId ?? this.profile().paysId` fallback
      // (profile().paysId is itself non-nullable) always resolves this before it ever lands
      // in `config`, unlike the raw EmployeePayrollConfigDto the service can return.
      paysId: cfg.paysId!,
      contractType: cfg.contractType,
      selectedBenefitCodes: cfg.selectedBenefitCodes,
      currentGrossSalary: cfg.currentGrossSalary,
      currentNetSalary: cfg.currentNetSalary,
      reason: this.reason(),
    }).subscribe({
      next: updated => {
        this.saving.set(false);
        this.config.set(updated);
        this.reason.set('');
        this.success.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_SAVE_SUCCESS'));
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.translate.instant('PROFILES.FIELDS.REMUNERATION_SAVE_ERROR'));
      },
    });
  }
}
