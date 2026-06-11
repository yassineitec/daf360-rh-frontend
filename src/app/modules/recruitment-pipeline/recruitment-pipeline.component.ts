import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { SpinnerComponent }     from '../../shared/spinner.component';

interface PipelineCandidate {
  id: number;
  firstName: string;
  lastName: string;
  appliedPosition: string | null;
  contractType:    string | null;
  expectedStartDate: string | null;
  status: string;
}

interface Stage {
  key:       string;
  label:     string;
  statuses:  string[];
  color:     string;
  icon:      string;
  nextRoute: ((c: PipelineCandidate) => string) | null;
  nextLabel: string | null;
}

const STAGES: Stage[] = [
  { key: 'pending',   label: 'Candidatures',         statuses: ['PENDING'],
    color: '#95a5a6', icon: '📋', nextRoute: null, nextLabel: null },
  { key: 'accepted',  label: 'Acceptés — IT à faire', statuses: ['ACCEPTED'],
    color: '#27ae60', icon: '✅', nextRoute: () => '/hr/it-provisioning', nextLabel: 'Provisioning IT →' },
  { key: 'it',        label: 'Provisioning IT',       statuses: ['IT_IN_PROGRESS','EMAIL_CREATED'],
    color: '#3498db', icon: '💻', nextRoute: () => '/hr/it-provisioning', nextLabel: 'Ouvrir →' },
  { key: 'onboarding',label: 'Onboarding RH',         statuses: ['EMAIL_RECEIVED','HR_IN_PROGRESS'],
    color: '#f39c12', icon: '📝', nextRoute: (c) => '/hr/onboarding/' + c.id, nextLabel: 'Compléter →' },
  { key: 'hired',     label: 'Embauchés',             statuses: ['HIRED'],
    color: '#1e8449', icon: '🎉', nextRoute: () => '/hr/profiles', nextLabel: 'Voir les profils →' },
  { key: 'rejected',  label: 'Rejetés / Archivés',    statuses: ['REJECTED','ARCHIVED'],
    color: '#e74c3c', icon: '❌', nextRoute: null, nextLabel: null },
];

@Component({
  selector: 'app-recruitment-pipeline',
  standalone: true,
  imports: [StatusBadgeComponent, SpinnerComponent],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrl:    './recruitment-pipeline.component.scss',
})
export class RecruitmentPipelineComponent implements OnInit {
  private http   = inject(HttpClient);
  private router = inject(Router);

  all     = signal<PipelineCandidate[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  readonly stages = STAGES;

  readonly grouped = computed(() =>
    STAGES.map(stage => ({
      stage,
      candidates: this.all().filter(c => stage.statuses.includes(c.status)),
    }))
  );

  readonly counts = computed(() =>
    STAGES.map(stage => ({
      stage,
      count: this.all().filter(c => stage.statuses.includes(c.status)).length,
    }))
  );

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    // The endpoint returns Page<CandidateListItem> — extract .content
    this.http
      .get<{ content: PipelineCandidate[] }>(`${environment.hrApiUrl}/api/hr/candidates?size=500&page=0`)
      .subscribe({
        next:  page => { this.all.set(page.content ?? []); this.loading.set(false); },
        error: ()   => { this.error.set('Impossible de charger le pipeline.'); this.loading.set(false); },
      });
  }

  navigate(path: string): void { this.router.navigate([path]); }
  goToCandidate(id: number): void { this.router.navigate(['/hr/candidates', id]); }
}
