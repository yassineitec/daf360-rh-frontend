import { Component, input, output } from '@angular/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';

export interface EmployeeCardData {
  profileId:        number | null;
  fullName:         string;
  poste:            string | null;
  department:       string | null;
  anciennete:       string;
  presenceStatus:   'PRESENT' | 'TELETRAVAIL' | 'ABSENT';
  photoUrl:         string | null;
  initials:         string;
  completionPerso:  boolean;
  completionDocs:   boolean;
  completionSkills: boolean;
}

@Component({
  selector: 'rh-employee-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <div class="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant
                shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">

      <!-- Presence indicator (top-right) -->
      <div class="absolute top-0 right-0 p-3">
        @switch (employee().presenceStatus) {
          @case ('PRESENT') {
            <span class="flex items-center gap-1 text-[11px] font-bold text-secondary">
              <span class="w-2 h-2 rounded-full bg-secondary"></span>
              Présent
            </span>
          }
          @case ('TELETRAVAIL') {
            <span class="flex items-center gap-1 text-[11px] font-bold text-teal">
              <span class="material-symbols-outlined text-[14px]">home</span>
              Télétravail
            </span>
          }
          @case ('ABSENT') {
            <daf-badge
              label="En Congé"
              [options]="{ variant: 'danger', size: 'sm' }" />
          }
        }
      </div>

      <!-- Avatar + info -->
      <div class="flex items-start gap-4 mb-4">
        <div class="w-14 h-14 rounded-full border-2 border-[#79D7BE] overflow-hidden shrink-0">
          @if (employee().photoUrl) {
            <img [src]="employee().photoUrl!" [alt]="employee().fullName"
                 class="w-full h-full object-cover" />
          } @else {
            <div class="w-full h-full bg-surface-container flex items-center justify-center
                        text-[12px] font-bold text-on-surface">
              {{ employee().initials }}
            </div>
          }
        </div>
        <div>
          <h3 class="text-[14px] font-bold text-on-surface">{{ employee().fullName }}</h3>
          <p class="text-[12px] text-outline">
            {{ employee().poste ?? '—' }}{{ employee().department ? ' • ' + employee().department : '' }}
          </p>
          <p class="text-[11px] text-teal font-bold uppercase mt-1">
            Ancienneté: {{ employee().anciennete }}
          </p>
        </div>
      </div>

      <!-- Profile completion grid -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        @for (cell of completionCells(); track cell.label) {
          <div class="p-2 bg-surface rounded-lg text-center border border-outline-variant">
            <p class="text-[9px] text-outline uppercase font-bold mb-1">{{ cell.label }}</p>
            <span class="material-symbols-outlined text-[16px]"
              [class]="cell.ok ? 'text-secondary' : 'text-error'">
              {{ cell.ok ? 'check_circle' : 'cancel' }}
            </span>
          </div>
        }
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 bg-teal text-white rounded-lg text-[13px] font-semibold
                 hover:opacity-90 transition-opacity"
          (click)="viewProfile.emit(employee().profileId)">
          Voir profil
        </button>
        <button
          type="button"
          class="px-3 py-2 border border-outline-variant rounded-lg hover:bg-surface-container
                 transition-colors"
          (click)="moreActions.emit(employee().profileId)">
          <span class="material-symbols-outlined text-[16px] text-on-surface-variant">
            more_horiz
          </span>
        </button>
      </div>
    </div>
  `,
})
export class EmployeeCardComponent {
  readonly employee    = input.required<EmployeeCardData>();
  readonly viewProfile = output<number | null>();
  readonly moreActions = output<number | null>();

  completionCells() {
    const e = this.employee();
    return [
      { label: 'Perso',  ok: e.completionPerso },
      { label: 'Docs',   ok: e.completionDocs },
      { label: 'Skills', ok: e.completionSkills },
    ];
  }
}
