import { Component, inject, input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { Holiday }          from './models/admin.model';
import { SpinnerComponent } from '../../shared/spinner.component';
import { ModalComponent }   from '../../shared/modal.component';

@Component({
  selector: 'app-holidays-admin',
  standalone: true,
  imports: [FormsModule, SpinnerComponent, ModalComponent],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">Jours fériés</h3>
        <p class="col-sub">Gestion par entité et par année</p>
      </div>
      <div class="header-actions">
        <select class="year-select" [(ngModel)]="selectedYear" (ngModelChange)="load()">
          @for (y of yearOptions; track y) { <option [value]="y">{{ y }}</option> }
        </select>
        <button class="btn-add" (click)="openAdd()" type="button">+ Ajouter</button>
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else {
      <!-- Calendar indicators -->
      @if (holidays().length > 0) {
        <div class="month-grid">
          @for (month of months; track month.num) {
            <div class="month-card">
              <p class="month-name">{{ month.label }}</p>
              <div class="day-chips">
                @for (h of getMonthHolidays(month.num); track h.id) {
                  <span class="day-chip" [title]="h.frenchLabel">
                    {{ dayNum(h.dateHoliday) }}
                  </span>
                }
                @if (!getMonthHolidays(month.num).length) {
                  <span class="no-holiday">—</span>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- List -->
      @if (holidays().length === 0) {
        <div class="empty-state"><p>Aucun jour férié pour {{ selectedYear }}.</p></div>
      } @else {
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Libellé FR</th><th>Libellé EN</th><th>Récurrent</th><th></th></tr>
          </thead>
          <tbody>
            @for (h of holidays(); track h.id) {
              <tr>
                <td class="date-td">{{ fmtDate(h.dateHoliday) }}</td>
                <td>{{ h.frenchLabel }}</td>
                <td class="cell-muted">{{ h.englishLabel }}</td>
                <td>
                  <span class="recur-badge" [class.yes]="h.isRecurring">
                    {{ h.isRecurring ? 'Annuel' : 'Ponctuel' }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button class="btn-edit"   (click)="openEdit(h)" type="button">Modifier</button>
                  <button class="btn-delete" (click)="del(h)"      type="button">Suppr.</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    }

    <!-- Add/Edit Modal -->
    <app-modal
      [title]="editTarget() ? 'Modifier le jour férié' : 'Nouveau jour férié'"
      [visible]="showModal()"
      [hasFooter]="true"
      (closed)="showModal.set(false)"
    >
      <div class="modal-form">
        <div class="field-row">
          <label class="form-label">Date *</label>
          <input class="form-input" type="date" [(ngModel)]="form.dateHoliday" />
        </div>
        <div class="field-row">
          <label class="form-label">Libellé français *</label>
          <input class="form-input" type="text" [(ngModel)]="form.frenchLabel" />
        </div>
        <div class="field-row">
          <label class="form-label">Libellé anglais *</label>
          <input class="form-input" type="text" [(ngModel)]="form.englishLabel" />
        </div>
        <label class="check-label">
          <input type="checkbox" [(ngModel)]="form.isRecurring" />
          Récurrent (chaque année)
        </label>
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div slot="footer">
        <button class="btn-ghost" (click)="showModal.set(false)" type="button">Annuler</button>
        <button class="btn-save" [disabled]="!form.dateHoliday || !form.frenchLabel || saving()" (click)="save()" type="button">
          @if (saving()) { <app-spinner size="sm" /> }
          {{ editTarget() ? 'Enregistrer' : 'Créer' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .section-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
    .col-title { font-size:13px;font-weight:700;margin:0 }
    .col-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions { display:flex;gap:8px;align-items:center }
    .year-select    { padding:6px 10px;border:1px solid var(--color-border);border-radius:6px;background:#fff;font-size:13px;outline:none }
    .btn-add        { padding:6px 14px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer }
    .center         { display:flex;justify-content:center;padding:24px }
    .month-grid     { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px }
    .month-card     { padding:10px;border:1px solid var(--color-border);border-radius:8px;background:#fff }
    .month-name     { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted);margin:0 0 6px }
    .day-chips      { display:flex;flex-wrap:wrap;gap:4px }
    .day-chip       { display:inline-block;width:24px;height:24px;border-radius:50%;background:var(--color-primary,#1C4E5C);color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:24px }
    .no-holiday     { font-size:11px;color:var(--color-text-muted) }
    .data-table { width:100%;border-collapse:collapse;font-size:13px }
    .data-table th { padding:8px 12px;background:var(--color-bg-secondary,#EEF2F5);border-bottom:1px solid var(--color-border);text-align:left;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--color-text-muted) }
    .data-table td { padding:9px 12px;border-bottom:1px solid var(--color-border);vertical-align:middle }
    .data-table tr:last-child td { border-bottom:none }
    .date-td   { font-weight:600;color:var(--color-primary,#1C4E5C);white-space:nowrap }
    .cell-muted{ color:var(--color-text-muted) }
    .recur-badge { padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:var(--color-bg-secondary);color:var(--color-text-muted) }
    .recur-badge.yes { background:#dcfce7;color:#16A34A }
    .actions-cell { display:flex;gap:6px }
    .btn-edit   { padding:3px 8px;background:none;border:1px solid var(--color-border);border-radius:4px;font-size:11px;cursor:pointer;color:var(--color-primary) }
    .btn-delete { padding:3px 8px;background:none;border:1px solid #fca5a5;border-radius:4px;font-size:11px;cursor:pointer;color:#DC2626 }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted) }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .form-label { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted) }
    .form-input { padding:8px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;width:100% }
    .form-input:focus { border-color:var(--color-primary) }
    .check-label { display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:12px }
    .btn-ghost { padding:7px 14px;border:1px solid var(--color-border);border-radius:8px;background:none;font-size:13px;cursor:pointer;color:var(--color-text-muted) }
    .btn-save  { display:inline-flex;align-items:center;gap:5px;padding:7px 16px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer }
    .btn-save:disabled { opacity:.5;cursor:not-allowed }
  `],
})
export class HolidaysAdminComponent implements OnChanges {
  private svc = inject(AdminService);

  paysId = input(179);

  loading    = signal(false);
  saving     = signal(false);
  holidays   = signal<Holiday[]>([]);
  showModal  = signal(false);
  editTarget = signal<Holiday | null>(null);
  modalError = signal<string | null>(null);
  selectedYear = new Date().getFullYear();

  readonly yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i);
  readonly months = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ].map((label, i) => ({ label, num: i + 1 }));

  form = { dateHoliday: '', frenchLabel: '', englishLabel: '', isRecurring: false };

  ngOnChanges() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listHolidays(this.paysId(), this.selectedYear).pipe(catchError(() => of([]))).subscribe(hs => {
      this.holidays.set(hs);
      this.loading.set(false);
    });
  }

  getMonthHolidays(month: number): Holiday[] {
    return this.holidays().filter(h => new Date(h.dateHoliday).getMonth() + 1 === month);
  }

  dayNum(iso: string): string { return String(new Date(iso).getDate()).padStart(2, '0'); }

  fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }

  openAdd()  { this.editTarget.set(null); this.form = { dateHoliday: '', frenchLabel: '', englishLabel: '', isRecurring: false }; this.showModal.set(true); this.modalError.set(null); }
  openEdit(h: Holiday) { this.editTarget.set(h); this.form = { dateHoliday: h.dateHoliday, frenchLabel: h.frenchLabel, englishLabel: h.englishLabel, isRecurring: h.isRecurring }; this.showModal.set(true); this.modalError.set(null); }

  save() {
    this.saving.set(true);
    const dto = { paysId: this.paysId(), ...this.form };
    const obs = this.editTarget()
      ? this.svc.updateHoliday(this.editTarget()!.id, dto)
      : this.svc.createHoliday(dto);

    obs.pipe(catchError(err => { this.modalError.set(err?.error?.message ?? 'Erreur'); this.saving.set(false); return of(null); }))
      .subscribe(result => {
        this.saving.set(false);
        if (result) { this.showModal.set(false); this.load(); }
      });
  }

  del(h: Holiday) {
    if (!confirm(`Supprimer "${h.frenchLabel}" ?`)) return;
    this.svc.deleteHoliday(h.id).pipe(catchError(() => of(null))).subscribe(() => {
      this.holidays.update(hs => hs.filter(x => x.id !== h.id));
    });
  }
}
