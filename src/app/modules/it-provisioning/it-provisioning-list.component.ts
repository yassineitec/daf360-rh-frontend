import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ItProvisioningService }  from './it-provisioning.service';
import { ProvisioningListItem }   from './it-provisioning.model';
import { StatusBadgeComponent }   from '../../shared/status-badge.component';
import { SpinnerComponent }       from '../../shared/spinner.component';

@Component({
  selector: 'app-it-provisioning-list',
  standalone: true,
  imports: [StatusBadgeComponent, SpinnerComponent],
  templateUrl: './it-provisioning-list.component.html',
  styleUrl:    './it-provisioning-list.component.scss',
})
export class ItProvisioningListComponent implements OnInit {
  private service = inject(ItProvisioningService);
  private router  = inject(Router);

  items   = signal<ProvisioningListItem[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getPendingList().subscribe({
      next:  (data) => { this.items.set(data); this.loading.set(false); },
      error: ()     => { this.error.set('Erreur lors du chargement.'); this.loading.set(false); },
    });
  }

  hwProgress(r: ProvisioningListItem): string {
    return (r.assetsProvided ?? 0) + '/6';
  }

  licProgress(r: ProvisioningListItem): string {
    const n = [
      r.licenseOffice365,
      r.licenseAutocad,
      r.licenseRevit,
      r.licenseAutodesk,
      r.licenseKaspersky,
    ].filter(Boolean).length;
    return n + '/5';
  }

  navigate(id: number): void {
    this.router.navigate(['/hr/it-provisioning', id]);
  }
}
