import { Component, computed, inject, signal } from '@angular/core';
import { UserStore }   from '../../core/user.store';
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

const TABS: { key: AdminTab; label: string; permission: string }[] = [
  { key: 'roles',         label: 'Rôles & Permissions',  permission: 'GET_ROLES' },
  { key: 'parameters',    label: 'Paramètres de paie',   permission: 'GET_PAYS' },
  { key: 'holidays',      label: 'Jours fériés',         permission: 'GET_HOLIDAYS' },
  { key: 'request-types', label: 'Types de demandes',    permission: 'GET_ROLES' },
  { key: 'regimes',       label: 'Régimes horaires',     permission: 'GET_ROLES' },
  { key: 'lists',         label: 'Listes configurables', permission: 'ADMIN_LISTS' },
  { key: 'notifications', label: 'Notifications & Emails', permission: 'ADMIN_NOTIFICATIONS' },
  { key: 'breaks',        label: 'Gestion des pauses',    permission: 'ADMIN_BREAKS'         },
  { key: 'ref-data',      label: 'Données de référence',  permission: 'ADMIN_LISTS'          },
  { key: 'overtime',      label: 'Heures supplémentaires', permission: 'GET_PAYS'             },
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
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
  ],
  template: `
    @if (!isAdmin()) {
      <div class="access-denied">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <h2>Accès refusé</h2>
        <p>Seuls les administrateurs peuvent accéder à ce panneau.</p>
      </div>
    } @else {
      <div class="page-header">
        <h1 class="page-title">Administration</h1>
        <p class="page-sub">Entité {{ currentPays() }}</p>
      </div>

      <nav class="tab-bar" role="tablist">
        @for (tab of visibleTabs(); track tab.key) {
          <button
            class="tab-btn"
            [class.active]="activeTab() === tab.key"
            (click)="activeTab.set(tab.key)"
            role="tab"
            type="button"
          >{{ tab.label }}</button>
        }
      </nav>

      <div class="tab-content">
        @if (activeTab() === 'roles')         { <app-roles-admin /> }
        @if (activeTab() === 'parameters')    { <app-parameters-admin [paysId]="paysId()" /> }
        @if (activeTab() === 'holidays')      { <app-holidays-admin [paysId]="paysId()" /> }
        @if (activeTab() === 'request-types') { <app-request-types-admin [paysId]="paysId()" /> }
        @if (activeTab() === 'regimes')       { <app-regimes-admin [paysId]="paysId()" /> }
        @if (activeTab() === 'lists')         { <app-list-manager /> }
        @if (activeTab() === 'notifications') { <app-notification-routing /> }
        @if (activeTab() === 'breaks')        { <app-breaks-admin [paysId]="paysId()" /> }
        @if (activeTab() === 'ref-data')     { <app-ref-data-admin [paysId]="paysId()" /> }
        @if (activeTab() === 'overtime')    { <app-overtime-admin [paysId]="paysId()" /> }
      </div>
    }
  `,
  styles: [`
    .access-denied { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:80px 24px;color:var(--color-text-muted,#6B7280);text-align:center }
    .access-denied svg { opacity:.25 }
    .access-denied h2  { font-size:18px;font-weight:600;margin:0;color:var(--color-text,#1A1C1E) }
    .access-denied p   { font-size:14px;margin:0 }
    .page-header { padding:24px 24px 0 }
    .page-title  { font-family:var(--font-display,'DM Serif Display',serif);font-size:22px;font-weight:400;margin:0 }
    .page-sub    { font-size:12px;color:var(--color-text-muted,#6B7280);margin:3px 0 0 }
    .tab-bar     { display:flex;padding:12px 24px 0;border-bottom:1px solid var(--color-border,#E0E7E9);overflow-x:auto }
    .tab-btn     { padding:10px 18px;border:none;border-bottom:2px solid transparent;background:none;font-size:13px;font-weight:500;color:var(--color-text-muted,#6B7280);cursor:pointer;white-space:nowrap;transition:all .15s;margin-bottom:-1px }
    .tab-btn:hover { color:var(--color-text,#1A1C1E) }
    .tab-btn.active { color:var(--color-primary,#1C4E5C);border-bottom-color:var(--color-primary,#1C4E5C);font-weight:600 }
    .tab-content { padding:20px 24px 32px }
  `],
})
export class AdminComponent {
  private userStore = inject(UserStore);

  activeTab   = signal<AdminTab>('roles');
  isAdmin     = computed(() => this.userStore.isAdmin() || this.userStore.isHrManager());
  paysId      = computed(() => this.userStore.currentUser()?.paysId ?? 179);
  currentPays = computed(() => this.userStore.currentUser()?.isoCode ?? '—');

  visibleTabs = computed(() =>
    TABS.filter(t => this.userStore.hasPermission(t.permission) || this.userStore.isAdmin())
  );
}
