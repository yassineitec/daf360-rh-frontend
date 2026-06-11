import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import {
  CreateListValueRequest, ListType, ListValue, UpdateListValueRequest,
} from '../../../core/lists/configurable-list.model';
import { UserStore } from '../../../core/user.store';

@Component({
  selector: 'app-list-manager',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: './list-manager.component.html',
  styleUrl: './list-manager.component.scss',
})
export class ListManagerComponent implements OnInit {
  private listService = inject(ConfigurableListService);
  private fb          = inject(FormBuilder);
  private userStore   = inject(UserStore);

  listTypes       = signal<ListType[]>([]);
  selectedType    = signal<ListType | null>(null);
  values          = signal<ListValue[]>([]);
  loadingTypes    = signal(true);
  loadingValues   = signal(false);
  searchQuery     = signal('');
  editingId       = signal<number | null>(null);
  showAddForm     = signal(false);
  error           = signal<string | null>(null);
  successMsg      = signal<string | null>(null);
  confirmDeleteId = signal<number | null>(null);

  readonly filteredTypes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.listTypes().filter(t =>
      !q || t.labelFr.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  });

  editForm: FormGroup = this.fb.group({
    labelFr:   ['', Validators.required],
    labelEn:   ['', Validators.required],
    sortOrder: [0],
    isActive:  [true],
  });

  addForm: FormGroup = this.fb.group({
    valueCode: ['', [Validators.required, Validators.maxLength(100)]],
    labelFr:   ['', Validators.required],
    labelEn:   ['', Validators.required],
    sortOrder: [0],
  });

  ngOnInit(): void {
    this.listService.getListTypes().subscribe({
      next: types => { this.listTypes.set(types); this.loadingTypes.set(false); },
      error: () => { this.error.set('Impossible de charger les types de listes.'); this.loadingTypes.set(false); },
    });
  }

  selectType(type: ListType): void {
    this.selectedType.set(type);
    this.showAddForm.set(false);
    this.editingId.set(null);
    this.loadValues(type.id);
  }

  loadValues(id: number): void {
    this.loadingValues.set(true);
    this.listService.getAllValuesForAdmin(id).subscribe({
      next: vals => { this.values.set(vals); this.loadingValues.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des valeurs.'); this.loadingValues.set(false); },
    });
  }

  startEdit(value: ListValue): void {
    this.editingId.set(value.id);
    this.editForm.patchValue({
      labelFr: value.labelFr, labelEn: value.labelEn,
      sortOrder: value.sortOrder, isActive: value.isActive,
    });
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(value: ListValue): void {
    if (this.editForm.invalid) return;
    const dto: UpdateListValueRequest = this.editForm.value;
    this.listService.updateValue(value.id, dto).subscribe({
      next: () => { this.editingId.set(null); this.flash('Valeur mise à jour.'); this.loadValues(value.listTypeId); },
      error: err => this.error.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur.'),
    });
  }

  confirmDelete(id: number): void { this.confirmDeleteId.set(id); }
  cancelDelete(): void { this.confirmDeleteId.set(null); }

  deleteValue(id: number, listTypeId: number): void {
    this.listService.deleteValue(id).subscribe({
      next: () => { this.confirmDeleteId.set(null); this.flash('Valeur supprimée.'); this.loadValues(listTypeId); },
      error: err => {
        this.confirmDeleteId.set(null);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors de la suppression.');
      },
    });
  }

  addValue(): void {
    if (this.addForm.invalid || !this.selectedType()) return;
    const type = this.selectedType()!;
    const dto: CreateListValueRequest = { listTypeId: type.id, paysId: null, ...this.addForm.value };
    this.listService.createValue(dto).subscribe({
      next: () => { this.showAddForm.set(false); this.addForm.reset({ sortOrder: 0 }); this.flash('Valeur ajoutée.'); this.loadValues(type.id); },
      error: err => this.error.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors de la création.'),
    });
  }

  moveUp(value: ListValue, index: number): void {
    if (index === 0) return;
    const vals = [...this.values()];
    [vals[index - 1], vals[index]] = [vals[index], vals[index - 1]];
    this.reorder(vals);
  }

  moveDown(value: ListValue, index: number): void {
    const vals = this.values();
    if (index >= vals.length - 1) return;
    const copy = [...vals];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    this.reorder(copy);
  }

  private reorder(orderedValues: ListValue[]): void {
    this.values.set(orderedValues);
    const type = this.selectedType();
    if (!type) return;
    this.listService.reorder(type.id, orderedValues.map(v => v.id)).subscribe({
      next: () => this.flash('Ordre mis à jour.'),
      error: () => { this.error.set("Erreur lors de la mise à jour de l'ordre."); this.loadValues(type.id); },
    });
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
