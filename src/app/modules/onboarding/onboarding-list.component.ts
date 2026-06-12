import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService }    from './onboarding.service';
import { OnboardingListItem }   from './onboarding.model';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
@Component({
  selector: 'app-onboarding-list',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './onboarding-list.component.html',
  styleUrl:    './onboarding-list.component.scss',
})
export class OnboardingListComponent implements OnInit {
  private service = inject(OnboardingService);
  private router  = inject(Router);

  items   = signal<OnboardingListItem[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);
  protected readonly statusBadge = statusBadge;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getPendingList().subscribe({
      next:  (data) => { this.items.set(data); this.loading.set(false); },
      error: ()     => { this.error.set('Erreur lors du chargement des dossiers.'); this.loading.set(false); },
    });
  }

  navigate(id: number): void {
    this.router.navigate(['/onboarding', id]);
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return value.slice(0, 10);
  }
}
