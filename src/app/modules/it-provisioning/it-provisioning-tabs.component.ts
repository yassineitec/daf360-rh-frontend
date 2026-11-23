import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TabItem, TabsComponent } from '@khalilrebhiitec/daf360';

export type ItProvisioningTab = 'pending' | 'history';

/** Each tab's own URL — kept, so bookmarks, notification links and the form's back link still land. */
const TAB_URL: Record<ItProvisioningTab, string[]> = {
  pending: ['/rh/it-provisioning'],
  history: ['/rh/it-provisioning', 'historique'],
};

/**
 * The two tabs of « Provisioning IT » — « Dossiers en cours » and « Historique ».
 *
 * They used to be two sidebar entries under an « IT provisioning » group; the sidebar now
 * has ONE entry for the page (inside « Lifecycle »), and the two lists are tabs of it.
 *
 * Route-backed on purpose: each list keeps its own component, its own remembered filters
 * and its own URL (`it-provisioning` / `it-provisioning/historique`), so a tab click is a
 * navigation between them. Both pages draw this strip right under the same page header,
 * which is what makes them read as one page.
 */
@Component({
  selector: 'rh-it-provisioning-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabsComponent],
  host: { class: 'block' },
  template: `
    <daf-tabs
      variant="underline"
      style="--daf-tabs-fade: var(--color-background)"
      idPrefix="it-provisioning"
      [tabs]="tabs()"
      [active]="active()"
      (activeChange)="go($event)" />
  `,
})
export class ItProvisioningTabsComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  /** The tab of the page drawing the strip. */
  readonly active = input.required<ItProvisioningTab>();

  protected readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'pending', label: this.translate.instant('NAV.IT_PROVISIONING_CURRENT'), icon: 'devices' },
      { id: 'history', label: this.translate.instant('NAV.IT_PROVISIONING_HISTORY'), icon: 'history' },
    ];
  });

  protected go(id: string): void {
    if (id === this.active() || !(id in TAB_URL)) return;
    this.router.navigate(TAB_URL[id as ItProvisioningTab]);
  }
}
