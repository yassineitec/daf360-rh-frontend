import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent, FormFieldComponent } from '@khalilrebhiitec/daf360';
import { NotificationEventTypeWithRule } from './notification-routing.model';
import { NotificationRoutingService } from './notification-routing.service';
import { RoutingRuleEditorComponent } from './routing-rule-editor.component';

@Component({
  selector: 'app-notification-routing',
  standalone: true,
  imports: [FormsModule, RoutingRuleEditorComponent, CardComponent, FormFieldComponent],
  templateUrl: './notification-routing.component.html',
  styleUrl: './notification-routing.component.scss',
})
export class NotificationRoutingComponent implements OnInit {
  private svc = inject(NotificationRoutingService);

  eventTypes = signal<NotificationEventTypeWithRule[]>([]);
  selectedType = signal<NotificationEventTypeWithRule | null>(null);
  loadingTypes = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');

  filteredTypes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.eventTypes().filter(
      (t) =>
        !q ||
        t.labelFr.toLowerCase().includes(q) ||
        t.module.toLowerCase().includes(q)
    );
  });

  grouped = computed(() => {
    const byModule = new Map<string, NotificationEventTypeWithRule[]>();
    for (const t of this.filteredTypes()) {
      if (!byModule.has(t.module)) byModule.set(t.module, []);
      byModule.get(t.module)!.push(t);
    }
    return [...byModule.entries()].map(([module, types]) => ({ module, types }));
  });

  ngOnInit(): void {
    this.svc.getEventTypes().subscribe({
      next: (types) => {
        this.eventTypes.set(types);
        this.loadingTypes.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Erreur lors du chargement des événements');
        this.loadingTypes.set(false);
      },
    });
  }

  selectType(type: NotificationEventTypeWithRule): void {
    this.selectedType.set(type);
  }
}
