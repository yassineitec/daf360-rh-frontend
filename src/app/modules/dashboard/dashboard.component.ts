import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  DashboardService,
  WorkforceStats,
  WorkforceData,
  ProfileCompletionData,
  FinPeriodeEssaiItem,
} from './services/dashboard.service';
import { EmployeeListItem } from '../profiles/models/profile.model';
import { UserStore } from '../../core/user.store';
import { SpinnerComponent } from '../../shared/spinner.component';
import { QuickActionCardComponent } from './components/quick-action-card/quick-action-card.component';
import { AlertCardComponent, ProbationAlert } from './components/alert-card/alert-card.component';
import { WorkforceStatsComponent } from './components/workforce-stats/workforce-stats.component';
import { ProfileCompletionComponent } from './components/profile-completion/profile-completion.component';
import { EmployeeCardComponent, EmployeeCardData } from './components/employee-card/employee-card.component';
import { AnniversaryWidgetComponent, AnniversaireItem } from './components/anniversary-widget/anniversary-widget.component';
import { NewEmployeesWidgetComponent, NouveauItem } from './components/new-employees-widget/new-employees-widget.component';

interface QuickActionDef {
  icon:     string;
  label:    string;
  sublabel: string;
  route?:   string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    SpinnerComponent,
    QuickActionCardComponent,
    AlertCardComponent,
    WorkforceStatsComponent,
    ProfileCompletionComponent,
    EmployeeCardComponent,
    AnniversaryWidgetComponent,
    NewEmployeesWidgetComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private dashboardSvc    = inject(DashboardService);
  private userStore       = inject(UserStore);
  private router          = inject(Router);
  private activatedRoute  = inject(ActivatedRoute);

  // ── Raw signals ────────────────────────────────────────────────────────────
  readonly loading              = signal(true);
  readonly error                = signal<string | null>(null);
  readonly stats                = signal<WorkforceStats | null>(null);
  readonly workforce            = signal<WorkforceData | null>(null);
  readonly completion           = signal<ProfileCompletionData | null>(null);
  readonly finPeriodeEssai      = signal<FinPeriodeEssaiItem[]>([]);
  private readonly anniversairesRaw = signal<EmployeeListItem[]>([]);
  readonly nouveauxEmployes     = signal<EmployeeListItem[]>([]);

  readonly currentUser = this.userStore.currentUser;

  // ── Computed for template ──────────────────────────────────────────────────
  readonly userName = computed(() => this.currentUser()?.fullName ?? 'Collaborateur');

  readonly quickActions = computed<QuickActionDef[]>(() => {
    const s = this.stats();
    return [
      { icon: 'inbox',        label: 'Demandes',    sublabel: `${s?.pendingRequests ?? 0} en attente`, route: 'requests' },
      { icon: 'person_add',   label: 'Onboarding',  sublabel: 'Gérer les arrivées',                    route: 'onboarding' },
      { icon: 'beach_access', label: 'Congés',       sublabel: 'Valider les demandes',                  route: 'leave' },
      { icon: 'analytics',    label: 'Recrutement', sublabel: 'Voir le pipeline',                      route: 'recrutement' },
    ];
  });

  readonly probation = computed<ProbationAlert[]>(() =>
    this.finPeriodeEssai().map(p => ({
      fullName:      p.fullName,
      joursRestants: p.joursRestants ?? 0,
    }))
  );

  readonly employeeCards = computed<EmployeeCardData[]>(() =>
    this.nouveauxEmployes().map(emp => ({
      profileId:        emp.profileId,
      fullName:         emp.fullName,
      poste:            emp.roleName,
      department:       emp.department,
      anciennete:       emp.hireDate ? this.ancienneteLabel(emp.hireDate) : '—',
      presenceStatus:   'PRESENT' as const,
      photoUrl:         emp.photoUrl,
      gender:           emp.gender,
      initials:         this.initials(emp.fullName),
      completionPerso:  emp.hasProfile,
      completionDocs:   false,
      completionSkills: false,
    }))
  );

  readonly anniversaires = computed<AnniversaireItem[]>(() =>
    this.anniversairesRaw().map(emp => ({
      profileId:   emp.profileId,
      fullName:    emp.fullName,
      dateOfBirth: emp.hireDate,
    }))
  );

  readonly nouveaux = computed<NouveauItem[]>(() =>
    this.nouveauxEmployes().map(emp => ({
      profileId:  emp.profileId,
      fullName:   emp.fullName,
      hireDate:   emp.hireDate,
      grade:      emp.grade,
      department: emp.department,
    }))
  );

  ngOnInit(): void {
    this.dashboardSvc.load().subscribe({
      next: data => {
        this.stats.set(data.stats);
        this.workforce.set(data.workforce);
        this.completion.set(data.completion);
        this.finPeriodeEssai.set(data.finPeriodeEssai);
        this.anniversairesRaw.set(data.anniversaires);
        this.nouveauxEmployes.set(data.nouveauxEmployes);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement du tableau de bord.');
        this.loading.set(false);
      },
    });
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  onViewProfile(id: number | null): void {
    if (id != null) this.router.navigate(['../profiles', id], { relativeTo: this.activatedRoute });
  }

  onQuickAction(route?: string): void {
    if (route) this.router.navigate([route]);
  }

  private initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }

  private ancienneteLabel(hireDate: string): string {
    const months = Math.floor(
      (Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    if (months < 1) return "Moins d'un mois";
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    return `${years} an${years > 1 ? 's' : ''}`;
  }
}
