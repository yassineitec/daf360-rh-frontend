import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ProfileService }        from '../profile.service';
import { ContractHistoryService } from '../contract-history/contract-history.service';
import { ProfileDetailService }   from '../services/profile-detail.service';
import { EmployeeProfile }        from '../models/profile.model';
import { ContractHistoryDto }     from '../contract-history/contract-history.model';
import { EmployeeDocument }       from '../models/profile.model';

import { ProfileHeaderComponent }      from './components/profile-header/profile-header.component';
import { ProfileSidebarInfoComponent } from './components/profile-sidebar-info/profile-sidebar-info.component';
import { ProfileInfoTabComponent }     from './components/profile-info-tab/profile-info-tab.component';
import { ProfileContractTabComponent } from './components/profile-contract-tab/profile-contract-tab.component';
import { ProfileDocumentsTabComponent }from './components/profile-documents-tab/profile-documents-tab.component';
import { ProfileLeavesTabComponent }   from './components/profile-leaves-tab/profile-leaves-tab.component';

import type { LeaveBalanceDto, LeaveHistoryDto } from '../services/profile-detail.service';

type TabId = 'info' | 'contrat' | 'documents' | 'conges';

@Component({
  selector: 'rh-profile-detail',
  standalone: true,
  imports: [
    ProfileHeaderComponent,
    ProfileSidebarInfoComponent,
    ProfileInfoTabComponent,
    ProfileContractTabComponent,
    ProfileDocumentsTabComponent,
    ProfileLeavesTabComponent,
  ],
  templateUrl: './profile-detail.component.html',
})
export class ProfileDetailComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private profileSvc = inject(ProfileService);
  private contractSvc= inject(ContractHistoryService);
  private detailSvc  = inject(ProfileDetailService);

  profile       = signal<EmployeeProfile | null>(null);
  contracts     = signal<ContractHistoryDto[]>([]);
  documents     = signal<EmployeeDocument[]>([]);
  leaveBalances = signal<LeaveBalanceDto[]>([]);
  leaveHistory  = signal<LeaveHistoryDto[]>([]);
  loading       = signal(true);
  activeTab     = signal<TabId>('info');
  profileId     = signal<number>(0);

  readonly tabs = [
    { id: 'info'      as TabId, label: 'Informations' },
    { id: 'contrat'   as TabId, label: 'Contrat & Salaire' },
    { id: 'documents' as TabId, label: 'Documents' },
    { id: 'conges'    as TabId, label: 'Congés' },
  ];

  readonly photoUrl = computed(() => {
    const p = this.profile();
    if (!p) return null;
    return this.profileSvc.photoUrl(p.photoUrl);
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.profileId.set(id);
    this.loading.set(true);

    forkJoin({
      profile:   this.profileSvc.getById(id),
      contracts: this.contractSvc.getHistory(id),
      documents: this.profileSvc.listDocuments(id),
      balances:  this.detailSvc.getLeaveBalances(id, new Date().getFullYear()),
      history:   this.detailSvc.getLeaveHistory(id),
    }).subscribe({
      next: data => {
        console.log(data.profile);
        
        this.profile.set(data.profile);
        this.contracts.set(data.contracts);
        this.documents.set(data.documents);
        this.leaveBalances.set(data.balances);
        this.leaveHistory.set(data.history);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onBack(): void  { this.router.navigate(['/profiles']); }
  onEdit(): void  { this.router.navigate(['/profiles', this.profileId(), 'edit']); }
}
