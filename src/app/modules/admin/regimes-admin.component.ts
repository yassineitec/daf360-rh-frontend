import { Component, computed, inject, input, signal } from '@angular/core';
import { RegimeCatalogComponent } from './regimes/tabs/regime-catalog.component';
import { RegimeRoleAssignmentComponent } from './regimes/tabs/regime-role-assignment.component';
import { RegimeOverviewComponent } from './regimes/tabs/regime-overview.component';
import { EntityTimezoneCardComponent } from './regimes/entity-timezone-card.component';
import { TabItem, TabsComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type RegimeTab = 'catalog' | 'roles' | 'overview';

@Component({
  selector: 'app-regimes-admin',
  standalone: true,
  imports: [
    RegimeCatalogComponent, RegimeRoleAssignmentComponent, RegimeOverviewComponent,
    EntityTimezoneCardComponent, TabsComponent, TranslatePipe,
  ],
  template: `
    <div>
      <!-- The entity's clock. Above the tabs because every regime, break window and
           pointage transition below is read in this zone — without it the entity has no
           presence automation at all. -->
      <app-entity-timezone-card [paysId]="paysId()" />

      <!-- Real daf-tabs strip, same convention as role-editor. -->
      <daf-tabs
        class="ra-tabs"
        variant="underline"
        [tabs]="tabs()"
        [active]="activeTab()"
        (activeChange)="activeTab.set($any($event))"
        [tabsLabel]="'ADMIN.regimes.tabs.ariaLabel' | translate" />

      <!-- Tab content -->
      @if (activeTab() === 'catalog') {
        <app-regime-catalog [paysId]="paysId()" />
      }
      @if (activeTab() === 'roles') {
        <app-regime-role-assignment [paysId]="paysId()" />
      }
      @if (activeTab() === 'overview') {
        <app-regime-overview [paysId]="paysId()" />
      }
    </div>
  `,
  styles: [`
    .ra-tabs { margin-bottom: 24px; }
  `],
})
export class RegimesAdminComponent {
  private translate = inject(TranslateService);

  readonly paysId = input<number>(179);
  activeTab = signal<RegimeTab>('catalog');

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'catalog',  label: this.translate.instant('ADMIN.regimes.tabs.catalog'),        icon: 'schedule'        },
      { id: 'roles',    label: this.translate.instant('ADMIN.regimes.tabs.roleAssignment'), icon: 'manage_accounts' },
      { id: 'overview', label: this.translate.instant('ADMIN.regimes.tabs.overview'),       icon: 'dashboard'       },
    ];
  });
}
