import { Component, input, signal } from '@angular/core';
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
  imports: [RegimeCatalogComponent, RegimeRoleAssignmentComponent, RegimeOverviewComponent],
  template: `
    <div>
      <!-- Tab bar -->
      <nav class="ra-tab-bar" role="tablist">
        @for (tab of tabs; track tab.id) {
          <button type="button"
            class="ra-tab-btn"
            [class.active]="activeTab() === tab.id"
            (click)="activeTab.set(tab.id)"
            role="tab">
            <span class="material-symbols-outlined" style="font-size:16px;">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        }
      </nav>

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
    .ra-tab-bar {
      display: flex;
      gap: 4px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--color-outline-variant);
      overflow-x: auto;
      flex-wrap: wrap;
    }
    .ra-tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      white-space: nowrap;
      margin-bottom: -1px;
      transition: color .15s ease, border-color .15s ease;
    }
    .ra-tab-btn:hover { color: var(--color-on-surface); }
    .ra-tab-btn.active {
      color: var(--color-tertiary);
      border-bottom-color: var(--color-tertiary);
      font-weight: 600;
    }
  `],
})
export class RegimesAdminComponent {
  readonly paysId = input<number>(179);
  activeTab = signal<RegimeTab>('catalog');
  readonly tabs = TABS;
}
