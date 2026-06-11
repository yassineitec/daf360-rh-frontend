import { Component, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RegimeCatalogComponent } from './regimes/tabs/regime-catalog.component';
import { RegimeRoleAssignmentComponent } from './regimes/tabs/regime-role-assignment.component';
import { RegimeOverviewComponent } from './regimes/tabs/regime-overview.component';

type RegimeTab = 'catalog' | 'roles' | 'overview';

const TABS: { id: RegimeTab; label: string; icon: string }[] = [
  { id: 'catalog',  label: 'Catalogue',        icon: 'schedule'        },
  { id: 'roles',    label: 'Assignation rôles', icon: 'manage_accounts' },
  { id: 'overview', label: "Vue d'ensemble",    icon: 'dashboard'       },
];

@Component({
  selector: 'app-regimes-admin',
  standalone: true,
  imports: [NgClass, RegimeCatalogComponent, RegimeRoleAssignmentComponent, RegimeOverviewComponent],
  template: `
    <div>
      <!-- Tab bar -->
      <div style="display:flex;gap:4px;margin-bottom:24px;background:#eceef0;padding:4px;border-radius:12px;width:fit-content;">
        @for (tab of tabs; track tab.id) {
          <button type="button"
            (click)="activeTab.set(tab.id)"
            [ngClass]="{
              'tab-active': activeTab() === tab.id,
              'tab-inactive': activeTab() !== tab.id
            }"
            style="padding:8px 20px;border-radius:8px;border:none;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;">
            <span class="material-symbols-outlined" style="font-size:16px;">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        }
      </div>

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
    .tab-active   { background: #fff; color: #1d2b3e; box-shadow: 0 1px 3px rgba(51,65,85,.12); }
    .tab-inactive { background: transparent; color: #44474c; }
    .tab-inactive:hover { background: rgba(255,255,255,.5); }
  `],
})
export class RegimesAdminComponent {
  readonly paysId = input<number>(179);
  activeTab = signal<RegimeTab>('catalog');
  readonly tabs = TABS;
}
