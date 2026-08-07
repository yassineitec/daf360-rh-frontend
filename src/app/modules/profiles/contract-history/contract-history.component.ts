import {
  Component, OnChanges, SimpleChanges, computed, inject, input, output, signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ButtonComponent,
  PaginationComponent,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';
import { ContractHistoryService } from './contract-history.service';
import { ContractHistoryDto } from './contract-history.model';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-contract-history',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ButtonComponent,
    PaginationComponent,
    StatusBadgeComponent,
    TranslatePipe,
  ],
  template: `
<div style="margin-top:4px;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div>
      <p style="font-size:12px;font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;margin:0;">
        {{ 'PROFILES.HISTORY.TITLE' | translate }}
      </p>
      @if (activeContract()) {
        <p style="font-size:12px;color:var(--color-teal);margin:3px 0 0;">
          {{ 'PROFILES.HISTORY.ACTIVE_CONTRACT' | translate }} <strong>{{ activeContract()!.typeContratLabelFr }}</strong>
          · {{ 'PROFILES.HISTORY.SINCE_LABEL' | translate }} {{ activeContract()!.dateEffet | date:'dd/MM/yyyy' }}
          @if (activeContract()!.salaireNet) { · {{ activeContract()!.salaireNet | number:'1.0-0' }} {{ 'PROFILES.HISTORY.TND_NET_SUFFIX' | translate }} }
        </p>
      }
    </div>
    <!-- Opens the SAME merged form as the section above, not a second one: the old button
         here posted straight to historique_contrat, which is how a dossier entry could exist
         with no lifecycle contract behind it. One form, one submit, both tables. -->
    @if (canEdit()) {
      <daf-button [label]="'PROFILES.HISTORY.NEW' | translate" variant="primary"
        [options]="{ size: 'sm', iconStart: 'add' }"
        (onClick)="newContract.emit()" />
    }
  </div>

  <!-- Timeline -->
  @if (isLoading()) {
    <div style="display:flex;flex-direction:column;gap:8px;">
      @for (i of [1,2,3]; track i) {
        <div style="height:56px;border-radius:10px;background:linear-gradient(90deg,var(--color-surface-container-low) 25%,var(--color-surface-container) 50%,var(--color-surface-container-low) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
      }
    </div>
  }

  @if (!isLoading() && history().length === 0) {
    <div style="text-align:center;padding:32px;color:var(--color-on-surface-variant);">
      <span class="material-symbols-outlined" style="font-size:36px;display:block;margin-bottom:8px;opacity:.35;">description</span>
      <p style="font-size:13px;margin:0;">{{ 'PROFILES.HISTORY.NONE' | translate }}</p>
    </div>
  }

  @if (!isLoading() && history().length > 0) {
    <!-- Same card shell as the lifecycle contracts above (rounded-xl · outline-variant
         border · surface-container-low), so one tab reads as one list rather than two
         designs stacked. The timeline rail is gone with it: the dossier log is ordered
         and dated, and the dot-and-line duplicated what the dates already say. -->
    <div class="flex flex-col gap-2.5">
      @for (c of pagedHistory(); track c.id) {
        <div class="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3.5">
          <div class="flex flex-wrap items-start justify-between gap-2.5">
            <div class="flex flex-1 flex-col gap-1.5">

              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[13px] font-bold text-on-surface">{{ c.typeContratLabelFr }}</span>
                <daf-badge [label]="(c.typeDocument === 'CONTRAT_INITIAL' ? 'PROFILES.HISTORY.DOC_INITIAL' : 'PROFILES.HISTORY.DOC_AMENDMENT') | translate"
                  [options]="{ variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'info' : 'warning', pill: true, size: 'sm' }" />
                @if (c.isActive) {
                  <daf-badge [label]="'PROFILES.HISTORY.ACTIVE' | translate" [options]="{ variant: 'teal', pill: true, size: 'sm' }" />
                }
              </div>

              <div class="flex flex-wrap gap-3.5 text-[12px] text-on-surface-variant">
                <span>
                  {{ 'PROFILES.HISTORY.FROM_LABEL' | translate }} {{ c.dateEffet | date:'dd/MM/yyyy' }}
                  @if (c.dateFin) { → {{ c.dateFin | date:'dd/MM/yyyy' }} }
                  @else { → {{ 'PROFILES.HISTORY.ONGOING' | translate }} }
                </span>
                @if (c.salaireNet) {
                  <span class="font-semibold text-on-surface">
                    {{ c.salaireNet | number:'1.0-0' }} {{ 'PROFILES.HISTORY.TND_NET_MONTH_SUFFIX' | translate }}
                  </span>
                }
              </div>

              @if (c.motif) {
                <span class="text-[11px] italic text-outline">{{ c.motif }}</span>
              }
              @if (c.commentaire) {
                <span class="text-[11px] text-outline">{{ c.commentaire }}</span>
              }
            </div>

            <span class="shrink-0 whitespace-nowrap text-[11px] text-outline">
              {{ c.dateCreation | date:'dd/MM/yyyy' }}
            </span>
          </div>
        </div>
      }
    </div>

    <!-- Count + Pagination -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;">
      <span style="font-size:12px;color:var(--color-on-surface-variant);">{{ 'PROFILES.HISTORY.COUNT' | translate:{ count: history().length } }}</span>
      @if (totalPages() > 1) {
        <daf-pagination
          [currentPage]="currentPage()"
          [totalPages]="totalPages()"
          [totalElements]="history().length"
          (pageChange)="onPageChange($event)" />
      }
    </div>
  }
</div>
  `,
  styles: [`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`],
})
/**
 * The dossier contract LOG (`historique_contrat`) — read-only.
 *
 * It used to own an add form of its own, which wrote a row here while the lifecycle
 * contract was created by a separate form on a separate tab: same event, two forms, two
 * tables, guaranteed to disagree. Both halves now live in `NewContractFormComponent`, which
 * writes the lifecycle contract and mirrors it here in one submit.
 */
export class ContractHistoryComponent implements OnChanges {
  private svc = inject(ContractHistoryService);

  readonly profileId = input.required<number>();
  readonly canEdit   = input<boolean>(false);

  /**
   * Asks the PARENT to open the merged new-contract modal.
   *
   * An output rather than owning the modal here: that form creates the lifecycle contract
   * (state machine, trial period, préavis) and only mirrors it into this log, so it belongs
   * to the page that owns both, not to the log component.
   */
  readonly newContract = output<void>();

  history         = signal<ContractHistoryDto[]>([]);
  activeContract  = signal<ContractHistoryDto | null>(null);
  isLoading       = signal(true);

  currentPage = signal(0);
  readonly totalPages = computed(() => Math.ceil(this.history().length / PAGE_SIZE));

  readonly pagedHistory = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.history().slice(start, start + PAGE_SIZE);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profileId']) this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.currentPage.set(0);
    this.svc.getHistory(this.profileId()).subscribe({
      next: h => {
        this.history.set(h);
        this.activeContract.set(h.find(c => c.isActive) ?? null);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  /** Re-reads the log — called by the parent after a contract is created. */
  reload(): void {
    this.load();
  }
}
