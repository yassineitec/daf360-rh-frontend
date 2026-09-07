import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent, PageComponent, PageHeaderComponent } from '@khalilrebhiitec/daf360';
import { UserStore }   from '../../core/user.store';
import { RefDataService } from '../../core/ref/ref-data.service';
import { PaysTimezone } from '../../core/ref/ref-data.model';
import { AdminTab }    from './models/admin.model';
import { RolesAdminComponent }        from './roles-admin.component';
import { ParametersAdminComponent }   from './parameters-admin.component';
import { HolidaysAdminComponent }     from './holidays-admin.component';
import { RequestTypesAdminComponent } from './request-types-admin.component';
import { RegimesAdminComponent }      from './regimes-admin.component';
import { BreaksAdminComponent }       from './breaks-admin.component';
import { ListManagerComponent }       from './lists/list-manager.component';
import { NotificationRoutingComponent } from './notifications/notification-routing.component';
import { RefDataAdminComponent }        from './ref-data-admin.component';
import { OvertimeAdminComponent }       from './overtime/overtime-admin.component';
import { InterviewTypesAdminComponent }      from './interview-types-admin.component';
import { OffboardingCatalogAdminComponent }   from './offboarding-catalog-admin.component';
import { DocumentTemplatesAdminComponent }   from './document-templates-admin.component';

/** Same tone → icon colour language as /finance/home's own module cards. */
const TONE_ICON: Record<string, { iconColor: string; iconBg: string }> = {
  primary:   { iconColor: 'text-primary',   iconBg: 'bg-primary/10' },
  secondary: { iconColor: 'text-secondary', iconBg: 'bg-secondary/10' },
  teal:      { iconColor: 'text-teal',      iconBg: 'bg-teal/10' },
  warning:   { iconColor: 'text-warning',   iconBg: 'bg-warning/10' },
  danger:    { iconColor: 'text-danger',    iconBg: 'bg-danger/10' },
};

const TABS: { key: AdminTab; labelKey: string; permission: string; icon: string; tone: keyof typeof TONE_ICON }[] = [
  { key: 'roles',               labelKey: 'ADMIN.shell.tabs.roles',               permission: 'GET_ROLES',                  icon: 'admin_panel_settings', tone: 'primary' },
  { key: 'parameters',          labelKey: 'ADMIN.shell.tabs.parameters',          permission: 'GET_PAYS',                   icon: 'tune',                  tone: 'secondary' },
  { key: 'holidays',            labelKey: 'ADMIN.shell.tabs.holidays',            permission: 'GET_HOLIDAYS',               icon: 'event',                 tone: 'teal' },
  { key: 'request-types',       labelKey: 'ADMIN.shell.tabs.requestTypes',        permission: 'GET_ROLES',                  icon: 'description',           tone: 'primary' },
  { key: 'regimes',             labelKey: 'ADMIN.shell.tabs.regimes',             permission: 'GET_ROLES',                  icon: 'schedule',              tone: 'warning' },
  { key: 'lists',               labelKey: 'ADMIN.shell.tabs.lists',               permission: 'ADMIN_LISTS',                icon: 'list_alt',              tone: 'secondary' },
  { key: 'notifications',       labelKey: 'ADMIN.shell.tabs.notifications',       permission: 'ADMIN_NOTIFICATIONS',        icon: 'notifications',         tone: 'primary' },
  { key: 'breaks',               labelKey: 'ADMIN.shell.tabs.breaks',              permission: 'ADMIN_BREAKS',               icon: 'free_breakfast',        tone: 'teal' },
  { key: 'ref-data',            labelKey: 'ADMIN.shell.tabs.refData',             permission: 'ADMIN_LISTS',                icon: 'storage',               tone: 'secondary' },
  { key: 'overtime',             labelKey: 'ADMIN.shell.tabs.overtime',            permission: 'GET_PAYS',                   icon: 'more_time',             tone: 'warning' },
  { key: 'interview-types',      labelKey: 'ADMIN.shell.tabs.interviewTypes',      permission: 'RH_ADMIN_INTERVIEW_TYPES',   icon: 'forum',                 tone: 'primary' },
  { key: 'offboarding-catalog',   labelKey: 'ADMIN.shell.tabs.offboardingCatalog',  permission: 'RH_MANAGE_OFFBOARDING',      icon: 'logout',                tone: 'danger' },
  { key: 'document-templates',    labelKey: 'ADMIN.shell.tabs.documentTemplates',   permission: 'HR_ADMIN_ROLES',             icon: 'article',               tone: 'teal' },
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CardComponent,
    PageComponent,
    PageHeaderComponent,
    RolesAdminComponent,
    ParametersAdminComponent,
    HolidaysAdminComponent,
    RequestTypesAdminComponent,
    RegimesAdminComponent,
    ListManagerComponent,
    NotificationRoutingComponent,
    BreaksAdminComponent,
    RefDataAdminComponent,
    OvertimeAdminComponent,
    InterviewTypesAdminComponent,
    OffboardingCatalogAdminComponent,
    DocumentTemplatesAdminComponent,
    TranslatePipe,
  ],
  template: `
    @if (!isAdmin()) {
      <div class="access-denied">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <h2>{{ 'ADMIN.shell.accessDenied.title' | translate }}</h2>
        <p>{{ 'ADMIN.shell.accessDenied.message' | translate }}</p>
      </div>
    } @else {
      @if (activeTab() === null) {
        <div class="page-header">
          <h2 class="page-title">{{ 'ADMIN.shell.title' | translate }}</h2>
          <p class="page-sub">{{ 'ADMIN.shell.entity' | translate:{ pays: currentPays() } }}</p>
        </div>
      }

      @if (activeTab() === null) {
        <!-- Same module-card recipe as /finance/home: a flex-wrap grid of clickable
             daf-card tiles, one per admin section, instead of a side-nav + tab strip. -->
        <section class="admin-cards">
          @for (tab of visibleTabs(); track tab.key) {
            <daf-card
              class="admin-card"
              [options]="{
                variant: 'glass', padding: 'lg', radius: 'xl', hoverable: true, clickable: true, fullHeight: true,
                icon: tab.icon, iconFilled: true,
                iconBg: toneIcon(tab.tone).iconBg, iconColor: toneIcon(tab.tone).iconColor,
                title: (tab.labelKey | translate)
              }"
              (cardClick)="activeTab.set(tab.key)" />
          }
        </section>
      } @else {
        <div class="tab-content">
          <daf-page [kpis]="0" [breadcrumbs]="true">
            @if (!(activeTab() === 'roles' && rolesDetailOpen()) && !(activeTab() === 'notifications' && notificationDetailOpen())) {
              <!-- Same daf-page-header breadcrumb convention as the detail pages (requests,
                   recruitment demands, profiles), instead of a back button — the title
                   always matches whichever module card was chosen. Hidden while a role or a
                   notification rule is open: those tabs then show their own breadcrumb, which
                   already includes these same two crumbs plus the role's/rule's name. -->
              <daf-page-header
                class="tab-breadcrumb-header"
                [title]="currentTabLabelKey() | translate"
                [breadcrumbs]="[{ label: ('ADMIN.shell.title' | translate) }, { label: (currentTabLabelKey() | translate) }]"
                (breadcrumbNavigate)="activeTab.set(null)" />
            }

            @if (activeTab() === 'roles')         { <app-roles-admin (backToAdmin)="activeTab.set(null)" (roleDetailOpen)="rolesDetailOpen.set($event)" /> }
            @if (activeTab() === 'parameters')    { <app-parameters-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'holidays')      { <app-holidays-admin [paysId]="paysId()" [paysLabel]="currentPays()" [paysIsoCode]="currentPaysIso()" /> }
            @if (activeTab() === 'request-types') { <app-request-types-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'regimes')       { <app-regimes-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'lists')         { <app-list-manager /> }
            @if (activeTab() === 'notifications') { <app-notification-routing (backToAdmin)="activeTab.set(null)" (detailOpen)="notificationDetailOpen.set($event)" /> }
            @if (activeTab() === 'breaks')        { <app-breaks-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'ref-data')     { <app-ref-data-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'overtime')          { <app-overtime-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'interview-types')     { <app-interview-types-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'offboarding-catalog')  { <app-offboarding-catalog-admin [paysId]="paysId()" /> }
            @if (activeTab() === 'document-templates')   { <app-document-templates-admin [paysId]="paysId()" /> }
          </daf-page>
        </div>
      }
    }
  `,
  styles: [`
    /* Cancel the shell's page padding so this page fills the full content area edge-to-edge.
       No internal scroll containers here — the shell (.shell-content) owns the single page scrollbar. */
    :host {
      display: block;
      margin: -2rem;
    }
    @media (max-width: 1024px) { :host { margin: -1.5rem } }
    @media (max-width: 768px)  { :host { margin: -0.75rem -1rem } }
    @media (max-width: 480px)  { :host { margin: -0.75rem } }

    .access-denied { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:80px 24px;color:var(--color-text-muted);text-align:center }
    .access-denied svg { opacity:.25 }
    .access-denied h2  { font-size:var(--text-headline-md);font-weight:600;margin:0;color:var(--color-text) }
    .access-denied p   { font-size:var(--text-body-md);margin:0 }
    .page-header { padding:24px 24px 0 }
    .page-title  { font-family:var(--font-sans);font-size:24px;font-weight:700;letter-spacing:-0.025em;line-height:1.25;margin:0 }
    @media (min-width: 640px) { .page-title { font-size:32px } }
    .page-sub    { font-size:var(--text-body-sm);color:var(--color-text-muted);margin:3px 0 0 }

    /* Flex-wrap grid, same approach as /finance/home's own module cards: four per row on
       wide screens, wrapping down as space runs out — no media-query breakpoints needed. */
    .admin-cards {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      padding: 20px 24px;
    }
    .admin-card {
      flex: 0 1 calc(25% - 18px);
      min-width: 220px;
    }
    /* daf-card's title defaults to the 'text-headline-lg' preset when no [size] is set —
       too large for a compact 220px module tile. Target the title only (not [size], which
       also caps the card at max-w-[320px] and would break the 4-per-row grid). */
    .admin-card ::ng-deep h4 { font-size:15px; line-height:1.3 }

    .tab-content  { min-width:0; overflow-x:hidden; padding:20px 24px 24px }

    .tab-breadcrumb-header { display:block }
    /* The active tab's own label is already the breadcrumb trail's last crumb —
       the header's own title line under it would just repeat it. */
    .tab-breadcrumb-header ::ng-deep h1 { display:none }
    /* Bigger than the library's default 12px — it now carries the back-navigation
       affordance on its own, with no button next to it to anchor its size against. */
    .tab-breadcrumb-header ::ng-deep nav { font-size:15px; line-height:1.4 }

    @media (max-width: 640px) {
      .page-header  { padding:16px 16px 0 }
      .admin-cards  { padding:12px 16px; gap:12px }
      .tab-content  { padding:12px 16px 16px }
    }
  `],
})
export class AdminComponent {
  private userStore = inject(UserStore);
  private refData   = inject(RefDataService);

  activeTab   = signal<AdminTab | null>(null);
  rolesDetailOpen = signal(false);
  notificationDetailOpen = signal(false);
  isAdmin     = computed(() => this.userStore.isAdmin() || this.userStore.isHrManager());

  // Every module card's [paysId] reads from the logged-in user's own pays.
  availablePays  = signal<PaysTimezone[]>([]);

  paysId = computed(() => this.userStore.currentUser()?.paysId ?? 52);

  currentPays = computed(() => {
    const picked = this.availablePays().find(p => p.id === this.paysId());
    return picked?.frenchLabel ?? this.userStore.currentUser()?.isoCode ?? '—';
  });

  currentPaysIso = computed(() => {
    const picked = this.availablePays().find(p => p.id === this.paysId());
    return picked?.isoCode ?? this.userStore.currentUser()?.isoCode ?? '';
  });

  readonly toneIcon = (tone: keyof typeof TONE_ICON) => TONE_ICON[tone];

  visibleTabs = computed(() =>
    TABS.filter(t => this.userStore.hasPermission(t.permission) || this.userStore.isAdmin())
  );

  currentTabLabelKey = computed(() => TABS.find(t => t.key === this.activeTab())?.labelKey ?? '');

  constructor() {
    this.refData.getPaysTimezones().subscribe(list => this.availablePays.set(list));
  }
}
