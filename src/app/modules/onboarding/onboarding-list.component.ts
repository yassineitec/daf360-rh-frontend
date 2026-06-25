import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { OnboardingService }    from './onboarding.service';
import { OnboardingKpiStats, OnboardingListItem } from './onboarding.model';
import { CardComponent, MetricCardComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';

@Component({
  selector: 'app-onboarding-list',
  standalone: true,
  imports: [CardComponent, MetricCardComponent, StatusBadgeComponent],
  templateUrl: './onboarding-list.component.html',
  styleUrl:    './onboarding-list.component.scss',
})
export class OnboardingListComponent implements OnInit {
  private service = inject(OnboardingService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

  items    = signal<OnboardingListItem[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);
  kpiStats = signal<OnboardingKpiStats | null>(null);

  protected readonly statusBadge = statusBadge;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getKpiStats().pipe(catchError(() => of(null))).subscribe(stats => {
      this.kpiStats.set(stats);
    });

    this.service.getPendingList().subscribe({
      next:  (data) => { this.items.set(data); this.loading.set(false); },
      error: ()     => { this.error.set('Erreur lors du chargement des dossiers.'); this.loading.set(false); },
    });
  }

  navigate(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return value.slice(0, 10);
  }
}
