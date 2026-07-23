import { Component, computed, inject, input, OnChanges, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }        from './admin.service';
import { RequestTypeCatalog }  from './models/admin.model';
import { SpinnerComponent }    from '../../shared/spinner.component';
import { ModalComponent }      from '../../shared/modal.component';
import {
  SelectComponent, SelectOption,
  FormFieldComponent,
  ButtonComponent,
  StatusBadgeComponent, DataTableComponent, DafCellDirective,
  TableColumn, TableConfig, TableRow, PaginationComponent, ModalService,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const CATEGORIES = ['DOCUMENT','PERSONAL_DATA_CHANGE','BANK_DETAILS','CAREER','OTHER'];
const PAGE_SIZE = 5;

@Component({
  selector: 'app-request-types-admin',
  standalone: true,
  imports: [
    SpinnerComponent, ModalComponent, SelectComponent, FormFieldComponent, ButtonComponent,
    StatusBadgeComponent, DataTableComponent, DafCellDirective, PaginationComponent,
    TranslatePipe,
  ],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">{{ 'ADMIN.catalog.requestTypes.title' | translate }}</h3>
        <p class="col-sub">{{ 'ADMIN.catalog.requestTypes.subtitle' | translate }}</p>
      </div>
      <div class="header-actions">
        <daf-button
          [label]="'ADMIN.catalog.requestTypes.initDefault' | translate"
          variant="ghost"
          [options]="{ disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button [label]="'ADMIN.catalog.requestTypes.add' | translate" variant="primary" (onClick)="openAdd()" />
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (types().length === 0) {
      <div class="empty-state">
        <p>{{ 'ADMIN.catalog.requestTypes.empty' | translate }}</p>
        <daf-button [label]="'ADMIN.catalog.requestTypes.initFull' | translate" variant="ghost" (onClick)="seed()" />
      </div>
    } @else {
      <div class="table-scroll">
      <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig">
        <ng-template dafCell="category" let-row>
          <daf-badge [label]="row['category']" [options]="{ variant: 'neutral', size: 'sm' }" />
        </ng-template>
        <ng-template dafCell="approvalLevel" let-row>
          <daf-badge [label]="row['approvalLevel']" [options]="{ variant: row['approvalLevel'] === 'L2' ? 'warning' : 'success', size: 'sm' }" />
        </ng-template>
        <ng-template dafCell="isActive" let-row>
          <daf-badge [label]="(row['_source'].isActive ? 'ADMIN.catalog.requestTypes.statusActive' : 'ADMIN.catalog.requestTypes.statusInactive') | translate" [options]="{ variant: row['_source'].isActive ? 'success' : 'neutral', size: 'sm' }" />
        </ng-template>
        <ng-template dafCell="_actions" let-row>
          <daf-button [label]="'ADMIN.catalog.requestTypes.actionEdit' | translate" variant="ghost" [options]="{ size: 'sm' }" (onClick)="openEdit(row['_source'])" />
          @if (row['_source'].isActive) {
            <daf-button [label]="'ADMIN.catalog.requestTypes.actionDeactivate' | translate" variant="danger" [options]="{ size: 'sm' }" (onClick)="deactivate(row['_source'])" />
          }
        </ng-template>
      </daf-data-table>
      </div>

      <!-- Count + Pagination -->
      <div class="rta-footer">
        <span class="rta-count"><strong>{{ totalElements() }}</strong> {{ 'ADMIN.catalog.requestTypes.countUnit' | translate }}</span>
        @if (totalPages() > 1) {
          <daf-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [totalElements]="totalElements()"
            (pageChange)="onPageChange($event)" />
        }
      </div>
    }

    <!-- Add/Edit Modal -->
    <app-modal
      [title]="(editTarget() ? 'ADMIN.catalog.requestTypes.modalTitleEdit' : 'ADMIN.catalog.requestTypes.modalTitleNew') | translate"
      [visible]="showModal()"
      [hasFooter]="true"
      (closed)="showModal.set(false)"
    >
      <div class="modal-form">
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldCode' | translate), placeholder: ('ADMIN.catalog.requestTypes.placeholderCode' | translate), required: true, disabled: !!editTarget(), fullWidth: true }"
            [value]="form.typeCode"
            (valueChange)="form.typeCode = $any($event).toUpperCase()"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldLabelFr' | translate), required: true, fullWidth: true }"
            [value]="form.displayNameFr"
            (valueChange)="form.displayNameFr = $any($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldLabelEn' | translate), required: true, fullWidth: true }"
            [value]="form.displayNameEn"
            (valueChange)="form.displayNameEn = $any($event)"
          />
        </div>
        <div class="form-row">
          <div class="field-row">
            <daf-select
              [selected]="[form.category]"
              [options]="categoryOptions"
              [config]="{ label: ('ADMIN.catalog.requestTypes.fieldCategory' | translate), required: true, fullWidth: true }"
              (selectedChange)="form.category = $event[0]"
            />
          </div>
          <div class="field-row">
            <daf-select
              [selected]="[form.approvalLevel]"
              [options]="approvalLevelOptions()"
              [config]="{ label: ('ADMIN.catalog.requestTypes.fieldApprovalLevel' | translate), fullWidth: true }"
              (selectedChange)="onApprovalLevelChange($event[0])"
            />
          </div>
          <div class="field-row">
            <daf-form-field
              [options]="{ label: ('ADMIN.catalog.requestTypes.fieldSla' | translate), type: 'number', fullWidth: true }"
              [value]="form.defaultSlaDays"
              (valueChange)="form.defaultSlaDays = $any($event)"
            />
          </div>
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldDescription' | translate), type: 'textarea', rows: 2, fullWidth: true }"
            [value]="form.description"
            (valueChange)="form.description = $any($event)"
          />
        </div>
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div slot="footer">
        <daf-button [label]="'ADMIN.catalog.requestTypes.cancel' | translate" variant="secondary" (onClick)="showModal.set(false)" />
        <daf-button
          [label]="(editTarget() ? 'ADMIN.catalog.requestTypes.save' : 'ADMIN.catalog.requestTypes.create') | translate"
          variant="teal"
          [options]="{ disabled: !form.typeCode || !form.displayNameFr || saving(), loading: saving() }"
          (onClick)="save()"
        />
      </div>
    </app-modal>
  `,
  styles: [`
    .section-header { display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px }
    .col-title { font-size:13px;font-weight:700;margin:0 }
    .col-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions { display:flex;flex-wrap:wrap;gap:8px;align-items:center }
    .center   { display:flex;justify-content:center;padding:24px }
    .table-scroll { overflow-x:auto }
    .rta-footer { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px }
    .rta-count  { font-size:12px;color:var(--color-text-muted) }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .form-row   { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }

    @media (max-width: 560px) {
      .form-row { grid-template-columns:1fr }
    }
  `],
})
export class RequestTypesAdminComponent implements OnChanges {
  private svc   = inject(AdminService);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);

  paysId = input(179);

  loading    = signal(false);
  seeding    = signal(false);
  saving     = signal(false);
  types      = signal<RequestTypeCatalog[]>([]);
  showModal  = signal(false);
  editTarget = signal<RequestTypeCatalog | null>(null);
  modalError = signal<string | null>(null);

  readonly categories = CATEGORIES;
  readonly categoryOptions: SelectOption[] = CATEGORIES.map(c => ({ value: c, label: c }));
  readonly approvalLevelOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'L1', label: this.translate.instant('ADMIN.catalog.requestTypes.approvalL1') },
      { value: 'L2', label: this.translate.instant('ADMIN.catalog.requestTypes.approvalL2') },
    ];
  });

  form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1' as 'L1'|'L2', defaultSlaDays:2 };

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'typeCode', label: this.translate.instant('ADMIN.catalog.requestTypes.colCode') },
      { key: 'displayNameFr', label: this.translate.instant('ADMIN.catalog.requestTypes.colLabel') },
      { key: 'category', label: this.translate.instant('ADMIN.catalog.requestTypes.colCategory') },
      { key: 'approvalLevel', label: this.translate.instant('ADMIN.catalog.requestTypes.colApproval') },
      { key: 'defaultSlaDays', label: this.translate.instant('ADMIN.catalog.requestTypes.colSla'), align: 'center' },
      { key: 'isActive', label: this.translate.instant('ADMIN.catalog.requestTypes.colActive'), align: 'center' },
      { key: '_actions', label: this.translate.instant('ADMIN.catalog.requestTypes.colActions'), align: 'right' },
    ];
  });

  readonly tableConfig: TableConfig = { hoverable: true };

  // Pagination — 5 per page
  currentPage = signal(0);
  readonly totalElements = computed(() => this.types().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));

  readonly pagedTypes = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.types().slice(start, start + PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const suffix = this.translate.instant('ADMIN.catalog.requestTypes.slaSuffix');
    return this.pagedTypes().map(t => ({
      typeCode: t.typeCode,
      displayNameFr: t.displayNameFr,
      category: t.category,
      approvalLevel: t.approvalLevel,
      defaultSlaDays: t.defaultSlaDays + suffix,
      isActive: t.isActive,
      _source: t,
    }));
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  ngOnChanges() { this.load(); }

  private load() {
    this.loading.set(true);
    this.currentPage.set(0);
    this.svc.listRequestTypes(this.paysId()).pipe(catchError(() => of([]))).subscribe(ts => {
      this.types.set(ts);
      this.loading.set(false);
    });
  }

  onApprovalLevelChange(value: string): void {
    this.form.approvalLevel = (value === 'L2' ? 'L2' : 'L1');
  }

  openAdd()  { this.editTarget.set(null); this.form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1', defaultSlaDays:2 }; this.showModal.set(true); this.modalError.set(null); }
  openEdit(t: RequestTypeCatalog) { this.editTarget.set(t); this.form = { typeCode:t.typeCode, displayNameFr:t.displayNameFr, displayNameEn:t.displayNameEn, description:t.description??'', category:t.category, approvalLevel:t.approvalLevel, defaultSlaDays:t.defaultSlaDays }; this.showModal.set(true); this.modalError.set(null); }

  save() {
    this.saving.set(true);
    const dto = { paysId:this.paysId(), ...this.form };
    const obs = this.editTarget() ? this.svc.updateRequestType(this.editTarget()!.id, dto) : this.svc.createRequestType(dto);
    obs.pipe(catchError(err => { this.modalError.set(err?.error?.message ?? this.translate.instant('ADMIN.catalog.requestTypes.error')); this.saving.set(false); return of(null); }))
       .subscribe(r => { this.saving.set(false); if (r) { this.showModal.set(false); this.load(); } });
  }

  deactivate(t: RequestTypeCatalog) {
    this.modal.open({
      title: this.translate.instant('ADMIN.catalog.requestTypes.deactivateTitle'),
      body:  this.translate.instant('ADMIN.catalog.requestTypes.deactivateBody', { name: t.displayNameFr }),
      buttons: [
        { label: this.translate.instant('ADMIN.catalog.requestTypes.cancel'),            variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.catalog.requestTypes.actionDeactivate'),  variant: 'primary',   action: r => {
          this.svc.deactivateRequestType(t.id).pipe(catchError(() => of(null))).subscribe(() => this.load());
          r.close();
        } },
      ],
    });
  }

  seed() {
    this.seeding.set(true);
    this.svc.seedRequestTypes().pipe(catchError(() => of(null))).subscribe(() => { this.seeding.set(false); this.load(); });
  }
}
