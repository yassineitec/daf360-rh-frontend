import { Component, computed, inject, input, signal } from '@angular/core';
import { RegimeCatalogComponent } from './regimes/tabs/regime-catalog.component';
import { RegimeRoleAssignmentComponent } from './regimes/tabs/regime-role-assignment.component';
import { RegimeOverviewComponent } from './regimes/tabs/regime-overview.component';
import { EntityTimezoneCardComponent } from './regimes/entity-timezone-card.component';
import { TabItem, TabsComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { rememberAdminState } from './admin-section-state';
import { PageGuideComponent } from '../../shared/guide/page-guide.component';
import { GuideStep } from '../../shared/guide/page-guide.types';

type RegimeTab = 'catalog' | 'roles' | 'overview';

/**
 * Guide of the « Régimes horaires » card, started from « Aide & guides ». The fuseau card
 * sits above the tabs; each later step names the tab it needs (`tab` = a RegimeTab).
 */
const GUIDE_STEPS: GuideStep[] = [
  { icon: 'schedule',        titleKey: 'ADMIN_REGIMES_GUIDE.WELCOME.TITLE',  textKey: 'ADMIN_REGIMES_GUIDE.WELCOME.TEXT' },
  { icon: 'public',          titleKey: 'ADMIN_REGIMES_GUIDE.TIMEZONE.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.TIMEZONE.TEXT', target: 'regimes-timezone' },
  { icon: 'add',             titleKey: 'ADMIN_REGIMES_GUIDE.CATALOG.TITLE',  textKey: 'ADMIN_REGIMES_GUIDE.CATALOG.TEXT',  target: 'regimes-catalog-toolbar', tab: 'catalog' },
  { icon: 'edit',            titleKey: 'ADMIN_REGIMES_GUIDE.EDITOR.TITLE',   textKey: 'ADMIN_REGIMES_GUIDE.EDITOR.TEXT',   target: 'regimes-catalog-editor',  tab: 'catalog' },
  { icon: 'manage_accounts', titleKey: 'ADMIN_REGIMES_GUIDE.ROLES.TITLE',    textKey: 'ADMIN_REGIMES_GUIDE.ROLES.TEXT',    target: 'regimes-roles-table',     tab: 'roles' },
  { icon: 'dashboard',       titleKey: 'ADMIN_REGIMES_GUIDE.OVERVIEW.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.OVERVIEW.TEXT', target: 'regimes-overview-toolbar', tab: 'overview' },
  { icon: 'person',          titleKey: 'ADMIN_REGIMES_GUIDE.OVERRIDE.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.OVERRIDE.TEXT', target: 'regimes-overview-table',  tab: 'overview' },
  { icon: 'help',            titleKey: 'ADMIN_REGIMES_GUIDE.END.TITLE',      textKey: 'ADMIN_REGIMES_GUIDE.END.TEXT' },
];

@Component({
  selector: 'app-regimes-admin',
  standalone: true,
  imports: [
    RegimeCatalogComponent, RegimeRoleAssignmentComponent, RegimeOverviewComponent,
    EntityTimezoneCardComponent, TabsComponent, TranslatePipe, PageGuideComponent,
  ],
  template: `
    <rh-page-guide storageKey="admin-regimes" [steps]="guideSteps" (tabChange)="onGuideTab($event)" />

    <div>
      <!-- The entity's clock. Above the tabs because every regime, break window and
           pointage transition below is read in this zone — without it the entity has no
           presence automation at all. -->
      <div data-guide="regimes-timezone">
        <app-entity-timezone-card [paysId]="paysId()" />
      </div>

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

  /** Steps of this card's guide (see `GUIDE_STEPS`). */
  readonly guideSteps = GUIDE_STEPS;

  /** A guide step asks for its tab: show it. */
  onGuideTab(id: string): void {
    if (id === 'catalog' || id === 'roles' || id === 'overview') this.activeTab.set(id);
  }

  // ── Mémoire de la section ──────────────────────────────────────────────────
  /** Onglet actif gardé tant qu'on reste dans /rh/admin (voir `rememberAdminState`). */
  private readonly memory = rememberAdminState('regimes', { activeTab: this.activeTab });

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'catalog',  label: this.translate.instant('ADMIN.regimes.tabs.catalog'),        icon: 'schedule'        },
      { id: 'roles',    label: this.translate.instant('ADMIN.regimes.tabs.roleAssignment'), icon: 'manage_accounts' },
      { id: 'overview', label: this.translate.instant('ADMIN.regimes.tabs.overview'),       icon: 'dashboard'       },
    ];
  });
}
