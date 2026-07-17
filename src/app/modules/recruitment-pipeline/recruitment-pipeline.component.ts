import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
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
  { key: 'pending',   label: 'RECRUITMENT_PIPELINE.STAGE.PENDING',    statuses: ['PENDING'],
    color: '#95a5a6', icon: '📋', nextRoute: null, nextLabel: null },
  { key: 'accepted',  label: 'RECRUITMENT_PIPELINE.STAGE.ACCEPTED',   statuses: ['ACCEPTED'],
    color: '#27ae60', icon: '✅', nextRoute: () => '/it-provisioning', nextLabel: 'RECRUITMENT_PIPELINE.ACTION.ACCEPTED' },
  { key: 'it',        label: 'RECRUITMENT_PIPELINE.STAGE.IT',         statuses: ['IT_IN_PROGRESS','EMAIL_CREATED'],
    color: '#3498db', icon: '💻', nextRoute: () => '/it-provisioning', nextLabel: 'RECRUITMENT_PIPELINE.ACTION.IT' },
  { key: 'onboarding',label: 'RECRUITMENT_PIPELINE.STAGE.ONBOARDING', statuses: ['EMAIL_RECEIVED','HR_IN_PROGRESS'],
    color: '#f39c12', icon: '📝', nextRoute: (c) => '/onboarding/' + c.id, nextLabel: 'RECRUITMENT_PIPELINE.ACTION.ONBOARDING' },
  { key: 'hired',     label: 'RECRUITMENT_PIPELINE.STAGE.HIRED',      statuses: ['HIRED'],
    color: '#1e8449', icon: '🎉', nextRoute: () => '/profiles', nextLabel: 'RECRUITMENT_PIPELINE.ACTION.HIRED' },
  { key: 'rejected',  label: 'RECRUITMENT_PIPELINE.STAGE.REJECTED',   statuses: ['REJECTED','ARCHIVED'],
    color: '#e74c3c', icon: '❌', nextRoute: null, nextLabel: null },
];

@Component({
  selector: 'app-recruitment-pipeline',
  standalone: true,
  imports: [StatusBadgeComponent, SpinnerComponent, TranslatePipe],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrl:    './recruitment-pipeline.component.scss',
})
export class RecruitmentPipelineComponent implements OnInit {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private translate = inject(TranslateService);

  all     = signal<PipelineCandidate[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  readonly stages = STAGES;
  protected readonly statusBadge = statusBadge;

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
        error: ()   => { this.error.set(this.translate.instant('RECRUITMENT_PIPELINE.ERR_LOAD')); this.loading.set(false); },
      });
  }

  navigate(path: string): void { this.router.navigate([path]); }
  goToCandidate(id: number): void { this.router.navigate(['/candidates', id]); }
}
