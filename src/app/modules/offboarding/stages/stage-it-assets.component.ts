import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import {
  ButtonComponent, CheckboxComponent, MultiDatePickerComponent,
  StatusBadgeComponent,
  ToggleComponent,
} from '@khalilrebhiitec/daf360';

import {
  OffboardingAssetReturn, OffboardingChecklistItem, OffboardingWorkflowInstance,
} from '../models/offboarding.model';
import { StageView, assetIcon, checklistOf, dayMonth, shortDate } from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';
import { isoToDate } from '../../../shared/date-picker.utils';

/**
 * Stage 4 — Informatique & Matériel: the physical inventory on the left, the
 * security flow on the right, exactly as the design splits them.
 *
 * The toggle on an asset row is the **confirm-return** action, not a form field:
 * turning it on opens the condition modal (the page owns it), and it is disabled
 * once `actualReturnDate` is set, because a return cannot be un-confirmed.
 */
@Component({
  selector: 'rh-stage-it-assets',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, 
    ButtonComponent, CheckboxComponent, MultiDatePickerComponent,
    ToggleComponent, ListRowComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="grid grid-cols-1 gap-8 md:grid-cols-2">

        <!-- ── Inventaire physique ── -->
        <div>
          <h4 class="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px]">devices</span>
            {{ 'OFFBOARDING.STAGE.IT_INVENTORY' | translate }}
          </h4>

          <div class="flex flex-col gap-3">
            @for (a of assets(); track a.id) {
              <rh-list-row
                [icon]="assetIcon(a.assetType)"
                [title]="a.assetDescription"
                [meta]="assetMeta(a)"
                [state]="a.actualReturnDate ? 'done' : (isUrgent(a) ? 'urgent' : 'default')">
                <div trailing>
                  <daf-toggle
                    [options]="{ disabled: !canEdit() || !!a.actualReturnDate }"
                    [checked]="!!a.actualReturnDate"
                    (checkedChange)="onToggleAsset(a, $event)" />
                </div>
              </rh-list-row>
            }
            @empty {
              <div class="flex flex-col items-start gap-3 rounded-xl border border-dashed
                          border-outline-variant/50 p-4">
                <p class="text-[13px] italic text-on-surface-variant">
                  {{ 'OFFBOARDING.DETAIL.ASSETS_EMPTY' | translate }}
                </p>
                @if (canEdit()) {
                  <daf-button
                    [options]="{ variant: 'ghost', size: 'sm', iconStart: 'sync',
                                 label: ('OFFBOARDING.DETAIL.ASSETS_SYNC' | translate), loading: syncing() }"
                    (onClick)="syncAssets.emit()" />
                }
              </div>
            }
          </div>

          @if (canEdit() && assets().length) {
            <div class="mt-3 flex flex-wrap gap-2">
              <daf-button
                [options]="{ variant: 'ghost', size: 'sm', iconStart: 'sync',
                             label: ('OFFBOARDING.DETAIL.ASSETS_SYNC' | translate), loading: syncing() }"
                (onClick)="syncAssets.emit()" />
              <daf-button
                [options]="{ variant: 'secondary', size: 'sm', iconStart: 'add',
                             label: ('OFFBOARDING.DETAIL.ASSETS_ADD' | translate) }"
                (onClick)="addAsset.emit()" />
            </div>
          }
        </div>

        <!-- ── Sécurité & flux ── -->
        <div>
          <h4 class="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px]">lock_person</span>
            {{ 'OFFBOARDING.STAGE.IT_SECURITY' | translate }}
          </h4>

          <div class="flex flex-col gap-4 rounded-2xl border border-outline-variant/20
                      bg-surface-container-low p-5">

            <!-- PENDING V46 — account_deactivation_at. The design shows a datetime;
                 daf-multi-date-picker is date-only, so the time half waits for the
                 backend column (and for the lib's showTime flag). -->
            <daf-multi-date-picker
              [config]="{
                label: ('OFFBOARDING.STAGE.IT_DEACTIVATION' | translate),
                selectionMode: 'single', fullWidth: true, disabled: true
              }"
              [value]="deactivationDate()" />

            <!-- PENDING V46 — checklist group ACCESS. Three fixed rows in the design;
                 rendered from data when it exists, otherwise the seeded labels
                 disabled so the shape of the step is visible. -->
            <div class="flex flex-col gap-2">
              @for (item of accessItems(); track item.code) {
                <daf-checkbox
                  [options]="{ label: item.label, disabled: !canEdit() }"
                  [checked]="item.isDone"
                  (checkedChange)="toggleAccess.emit({ item, done: $event })" />
              }
              @empty {
                @for (label of ACCESS_PLACEHOLDERS; track label) {
                  <daf-checkbox [options]="{ label: label | translate, disabled: true }" [checked]="false" />
                }
              }
            </div>

            <!-- PENDING V46 — discharge_document_url -->
            <daf-button
              [options]="{
                variant: 'primary', fullWidth: true, iconStart: 'history_edu',
                label: ('OFFBOARDING.STAGE.IT_GENERATE_DISCHARGE' | translate),
                disabled: true
              }"
              (onClick)="generateDischarge.emit()" />

            @if (wf().dischargeDocumentUrl) {
              <a class="flex items-center gap-2 text-[12px] font-bold text-tertiary underline"
                 [href]="wf().dischargeDocumentUrl" target="_blank" rel="noopener">
                <span class="material-symbols-outlined text-[16px]">download</span>
                {{ 'OFFBOARDING.STAGE.IT_DISCHARGE_DOWNLOAD' | translate }}
              </a>
            }
          </div>
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageItAssetsComponent {
  readonly view    = input.required<StageView>();
  readonly wf      = input.required<OffboardingWorkflowInstance>();
  readonly assets  = input<OffboardingAssetReturn[]>([]);
  readonly canEdit = input(false);
  readonly syncing = input(false);

  readonly confirmAsset     = output<OffboardingAssetReturn>();
  readonly syncAssets       = output<void>();
  readonly addAsset         = output<void>();
  readonly toggleAccess     = output<{ item: OffboardingChecklistItem; done: boolean }>();
  readonly generateDischarge = output<void>();

  protected readonly assetIcon = assetIcon;

  /** Labels for the three access rows the design names, until the data exists. */
  protected readonly ACCESS_PLACEHOLDERS = [
    'OFFBOARDING.STAGE.IT_ACCESS_WORKSPACE',
    'OFFBOARDING.STAGE.IT_ACCESS_VPN',
    'OFFBOARDING.STAGE.IT_ACCESS_MAIL_REDIRECT',
  ];

  protected readonly accessItems = computed<OffboardingChecklistItem[]>(
    () => checklistOf(this.wf().checklistItems, 'ACCESS'),
  );

  protected readonly deactivationDate = computed(() => isoToDate(this.wf().accountDeactivationAt ?? ''));

  /** "SN: DAF-IT-0092" · "Validé le 08/10" · "Urgent" — the design's three metas. */
  protected assetMeta(a: OffboardingAssetReturn): string | null {
    if (a.actualReturnDate) return `✓ ${dayMonth(a.actualReturnDate)}`;
    if (a.serialNumber)     return `SN: ${a.serialNumber}`;
    if (a.expectedReturnDate) return shortDate(a.expectedReturnDate);
    return null;
  }

  /** No `is_urgent` column yet — an unreturned asset past its expected date is. */
  protected isUrgent(a: OffboardingAssetReturn): boolean {
    if (a.isUrgent) return true;
    if (a.actualReturnDate || !a.expectedReturnDate) return false;
    return new Date(a.expectedReturnDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  /** Turning the switch on is a confirm-return intent; the page opens the modal. */
  protected onToggleAsset(a: OffboardingAssetReturn, checked: boolean): void {
    if (checked && !a.actualReturnDate) this.confirmAsset.emit(a);
  }
}
