import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { tabParam } from '@khalilrebhiitec/daf360';
import { UserStore }   from '../../core/user.store';
import { AdminTab }    from './models/admin.model';
import { RolesAdminComponent }        from './roles-admin.component';
import { UsersAdminComponent }        from './users/users-admin.component';
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
import { SharePointAdminComponent }         from './sharepoint/sharepoint-admin.component';

const TABS: { key: AdminTab; labelKey: string; permission: string }[] = [
  { key: 'roles',         labelKey: 'ADMIN.shell.tabs.roles',        permission: 'GET_ROLES' },
  // The account register: the only screen that shows accounts WITHOUT an HR file, which
  // every other list filters out on purpose.
  { key: 'users',         labelKey: 'ADMIN.shell.tabs.users',        permission: 'GET_USERS' },
  { key: 'parameters',    labelKey: 'ADMIN.shell.tabs.parameters',   permission: 'GET_PAYS' },
  { key: 'holidays',      labelKey: 'ADMIN.shell.tabs.holidays',     permission: 'GET_HOLIDAYS' },
  { key: 'request-types', labelKey: 'ADMIN.shell.tabs.requestTypes', permission: 'GET_ROLES' },
  { key: 'regimes',       labelKey: 'ADMIN.shell.tabs.regimes',      permission: 'GET_ROLES' },
  { key: 'lists',         labelKey: 'ADMIN.shell.tabs.lists',        permission: 'ADMIN_LISTS' },
  { key: 'notifications', labelKey: 'ADMIN.shell.tabs.notifications', permission: 'ADMIN_NOTIFICATIONS' },
  { key: 'breaks',        labelKey: 'ADMIN.shell.tabs.breaks',        permission: 'ADMIN_BREAKS'         },
  { key: 'ref-data',      labelKey: 'ADMIN.shell.tabs.refData',       permission: 'ADMIN_LISTS'          },
  { key: 'overtime',        labelKey: 'ADMIN.shell.tabs.overtime',    permission: 'GET_PAYS'             },
  { key: 'interview-types',     labelKey: 'ADMIN.shell.tabs.interviewTypes',     permission: 'RH_ADMIN_INTERVIEW_TYPES' },
  { key: 'offboarding-catalog',  labelKey: 'ADMIN.shell.tabs.offboardingCatalog', permission: 'RH_MANAGE_OFFBOARDING'    },
  { key: 'document-templates',   labelKey: 'ADMIN.shell.tabs.documentTemplates',  permission: 'HR_ADMIN_ROLES'            },
  // Its own permission, not HR_ADMIN_ROLES: the folder browser in this tab can enumerate
  // every employee folder on the HR SharePoint site, which is a different capability from
  // editing roles even though the same people hold both today.
  { key: 'sharepoint',           labelKey: 'ADMIN.shell.tabs.sharepoint',         permission: 'ADMIN_SHAREPOINT'          },
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    RolesAdminComponent,
    UsersAdminComponent,
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
    SharePointAdminComponent,
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
      <div class="page-header">
        <h2 class="page-title">{{ 'ADMIN.shell.title' | translate }}</h2>
        <p class="page-sub">{{ 'ADMIN.shell.entity' | translate:{ pays: currentPays() } }}</p>
      </div>

      <div class="admin-layout">
        <nav class="side-nav" role="tablist">
          @for (tab of visibleTabs(); track tab.key) {
            <button
              class="side-nav-btn"
              [class.active]="activeTab() === tab.key"
              (click)="activeTab.set(tab.key)"
              role="tab"
              type="button"
            >{{ tab.labelKey | translate }}</button>
          }
        </nav>

        <div class="tab-content">
          @if (activeTab() === 'roles')         { <app-roles-admin /> }
          @if (activeTab() === 'users')         { <app-users-admin /> }
          @if (activeTab() === 'parameters')    { <app-parameters-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'holidays')      { <app-holidays-admin [paysId]="paysId()" [paysLabel]="currentPays()" /> }
          @if (activeTab() === 'request-types') { <app-request-types-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'regimes')       { <app-regimes-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'lists')         { <app-list-manager /> }
          @if (activeTab() === 'notifications') { <app-notification-routing /> }
          @if (activeTab() === 'breaks')        { <app-breaks-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'ref-data')     { <app-ref-data-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'overtime')          { <app-overtime-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'interview-types')     { <app-interview-types-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'offboarding-catalog')  { <app-offboarding-catalog-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'document-templates')   { <app-document-templates-admin [paysId]="paysId()" /> }
          @if (activeTab() === 'sharepoint')            { <app-sharepoint-admin [paysId]="paysId()" /> }
        </div>
      </div>
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

    .admin-layout { display:grid;grid-template-columns:260px 1fr;gap:20px;align-items:start;padding:20px }
    .tab-content  { min-width:0; overflow-x:hidden }

    .side-nav     {
      display:flex;flex-direction:column;gap:4px;background:var(--color-surface);
      border:1px solid var(--color-border);border-radius:12px;padding:10px;
      box-sizing:border-box;position:sticky;top:20px;
    }
    .side-nav-btn {
      text-align:left;padding:10px 14px;border:none;border-radius:8px;background:none;
      font-family:var(--font-sans);font-size:var(--text-label-md);font-weight:500;
      color:var(--color-text-muted);cursor:pointer;
      transition:background-color var(--duration-normal) var(--ease-smooth),color var(--duration-normal) var(--ease-smooth);
    }
    .side-nav-btn:hover { color:var(--color-text);background:var(--color-surface-container-low) }
    .side-nav-btn.active { color:var(--color-on-tertiary-container);background:var(--color-tertiary-container);font-weight:600;box-shadow:var(--shadow-sm) }

    /* Below 900px the sidebar becomes a horizontal scrollable tab strip above the content —
       matches the shell's own sidebar collapse point (768px) plus a little headroom so the
       two never fight for space in between. */
    @media (max-width: 900px) {
      .admin-layout { grid-template-columns:1fr; gap:14px; padding:16px }
      .side-nav {
        position:static;flex-direction:row;gap:6px;overflow-x:auto;
        -webkit-overflow-scrolling:touch;scrollbar-width:none;
        border:none;background:transparent;padding:2px 0 4px;border-radius:0;
      }
      .side-nav::-webkit-scrollbar { display:none }
      .side-nav-btn {
        flex-shrink:0;white-space:nowrap;border-radius:999px;
        background:var(--color-surface);border:1px solid var(--color-border);
      }
      .side-nav-btn.active {
        background:var(--color-tertiary);color:#fff;border-color:var(--color-tertiary);
        box-shadow:0 2px 8px rgba(0,0,0,0.12);
      }
    }

    @media (max-width: 640px) {
      .page-header { padding:16px 16px 0 }
      .admin-layout { padding:12px;gap:10px }
      .side-nav { gap:8px }
      .side-nav-btn { padding:9px 16px;font-size:13px }
    }
  `],
})
export class AdminComponent {
  private userStore = inject(UserStore);

  /**
   * Adossé au paramètre d'URL — voir tabParam. Ce n'est pourtant pas un daf-tabs mais un
   * bandeau fait main : tabParam rend un WritableSignal ordinaire, donc le
   * `(click)="activeTab.set(tab.key)"` du gabarit fonctionne inchangé.
   *
   * Cette page était la plus exposée à la perte d'onglet : quinze sections derrière un
   * même écran, et un rechargement renvoyait chaque fois sur « Rôles ».
   *
   * La liste vient de `visibleTabs`, filtrée par permission — un lien vers une section
   * qu'on n'a pas le droit de voir retombe ainsi sur « Rôles » au lieu de n'afficher aucun
   * panneau.
   */
  activeTab   = tabParam<AdminTab>(
    computed(() => this.visibleTabs().map(t => t.key)), 'roles');
  isAdmin     = computed(() => this.userStore.isAdmin() || this.userStore.isHrManager());
  paysId      = computed(() => this.userStore.currentUser()?.paysId ?? 52);
  currentPays = computed(() => this.userStore.currentUser()?.isoCode ?? '—');

  visibleTabs = computed(() =>
    TABS.filter(t => this.userStore.hasPermission(t.permission) || this.userStore.isAdmin())
  );
}
