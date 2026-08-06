import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import {
  ButtonComponent, CheckboxComponent, MultiDatePickerComponent,
  StatusBadgeComponent,
  ToggleComponent,
} from '@khalilrebhiitec/daf360';

import {
  OffboardingAssetReturn, OffboardingChecklistItem, OffboardingTask,
  OffboardingWorkflowInstance,
} from '../models/offboarding.model';
import {
  StageView, assetIcon, checklistOf, dayMonth, shortDate, stampDate,
} from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';
import { StageTasksComponent } from './stage-tasks.component';
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
    ToggleComponent, ListRowComponent, StageTasksComponent, TranslatePipe,
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

            <!-- V61 — account_deactivation_at. The column stores a moment; the picker is
                 date-only, so choosing a day sets it to the end of that day (the employee
                 works until then) — see the page's onDeactivationDate. -->
            <daf-multi-date-picker
              [config]="{
                label: ('OFFBOARDING.STAGE.IT_DEACTIVATION' | translate),
                selectionMode: 'single', fullWidth: true, disabled: !canEdit()
              }"
              [value]="deactivationDate()"
              (valueChange)="deactivationChange.emit($event)" />

            @if (wf().accountDeactivationAt) {
              <p class="-mt-2 text-[11px] text-on-surface-variant">
                {{ 'OFFBOARDING.IT.DEACTIVATION_SET' | translate:
                     { when: stamp(wf().accountDeactivationAt) } }}
              </p>
            }

            <!-- Checklist group ACCESS — seeded per file since V60. The @empty branch only
                 shows for files that predate it and were never backfilled (terminal ones). -->
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

            <!-- V61 — generated from the live asset list, so it can be re-issued after a
                 late return. Disabled with nothing tracked: a décharge that enumerates
                 nothing certifies nothing, and the API refuses it. -->
            <daf-button
              [options]="{
                variant: 'primary', fullWidth: true, iconStart: 'history_edu',
                label: (wf().dischargeDocumentUrl ? 'OFFBOARDING.IT.DISCHARGE_REGENERATE'
                                                  : 'OFFBOARDING.STAGE.IT_GENERATE_DISCHARGE') | translate,
                disabled: !canEdit() || !assets().length,
                loading: generatingDischarge()
              }"
              (onClick)="generateDischarge.emit()" />

            @if (!assets().length) {
              <p class="-mt-2 text-[11px] italic text-on-surface-variant">
                {{ 'OFFBOARDING.IT.DISCHARGE_NEEDS_ASSETS' | translate }}
              </p>
            } @else if (pendingCount()) {
              <!-- Generating early is legitimate (it names what is still out), but the user
                   should know the document will say so. -->
              <p class="-mt-2 flex items-start gap-1.5 text-[11px] text-on-surface-variant">
                <span class="material-symbols-outlined shrink-0 text-[14px]">info</span>
                {{ 'OFFBOARDING.IT.DISCHARGE_PENDING_WARN' | translate: { count: pendingCount() } }}
              </p>
            }

            <!-- A button, not a link: the stored value is a path on the server's storage
                 volume, so linking to it downloaded nothing. The page fetches the bytes. -->
            @if (wf().dischargeDocumentUrl) {
              <button type="button"
                      class="flex items-center gap-2 text-[12px] font-bold text-tertiary underline"
                      (click)="downloadDischarge.emit()">
                <span class="material-symbols-outlined text-[16px]">download</span>
                {{ wf().dischargeDocumentName ?? ('OFFBOARDING.STAGE.IT_DISCHARGE_DOWNLOAD' | translate) }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Spans both columns: the three IT tasks (retour équipements, retour badge,
           désactivation des accès) settle the stage, and ASSET_RETURN_IT is the file's
           blocking gate. -->
      <rh-stage-tasks class="mt-8"
        [tasks]="tasks()"
        [canEdit]="canEdit()"
        (complete)="completeTask.emit($event)"
        (skip)="skipTask.emit($event)" />
    </rh-stage-panel>
  `,
})
export class StageItAssetsComponent {
  readonly view    = input.required<StageView>();
  readonly wf      = input.required<OffboardingWorkflowInstance>();
  readonly assets  = input<OffboardingAssetReturn[]>([]);
  readonly tasks   = input<OffboardingTask[]>([]);
  readonly canEdit = input(false);
  readonly syncing = input(false);
  readonly generatingDischarge = input(false);

  readonly confirmAsset     = output<OffboardingAssetReturn>();
  readonly syncAssets       = output<void>();
  readonly addAsset         = output<void>();
  readonly toggleAccess     = output<{ item: OffboardingChecklistItem; done: boolean }>();
  readonly generateDischarge = output<void>();
  readonly downloadDischarge = output<void>();
  readonly completeTask     = output<OffboardingTask>();
  readonly skipTask         = output<OffboardingTask>();
  /** Emits the picker's raw Date(s); the page converts and adds the end-of-day time. */
  readonly deactivationChange = output<Date | Date[] | null>();

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

  /** The stored value is a timestamp; the picker only speaks dates, so it takes the day. */
  protected readonly deactivationDate = computed(
    () => isoToDate((this.wf().accountDeactivationAt ?? '').slice(0, 10)),
  );

  /** Assets still out — drives the warning under the décharge button. */
  protected readonly pendingCount = computed(
    () => this.assets().filter(a => !a.actualReturnDate && !a.isWrittenOff).length,
  );

  protected readonly stamp = stampDate;

  /**
   * The serial now has its own column (V61), so it can sit on the meta line alongside the
   * state instead of being appended to the description — which is what the design shows.
   */
  protected assetMeta(a: OffboardingAssetReturn): string | null {
    const parts: string[] = [];
    if (a.serialNumber) parts.push(`S/N ${a.serialNumber}`);
    if (a.actualReturnDate)        parts.push(`✓ ${dayMonth(a.actualReturnDate)}`);
    else if (a.isWrittenOff)       parts.push('⨯');
    else if (a.expectedReturnDate) parts.push(shortDate(a.expectedReturnDate));
    return parts.length ? parts.join(' · ') : null;
  }

  /** The explicit flag wins; otherwise an unreturned asset past its expected date is urgent. */
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
