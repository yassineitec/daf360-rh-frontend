import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OnboardingListItem, OnboardingFormData, OnboardingProfileDto, CompletionResult, OnboardingKpiStats } from './onboarding.model';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/onboarding`;

  getKpiStats(): Observable<OnboardingKpiStats> {
    return this.http.get<OnboardingKpiStats>(`${this.base}/kpi`);
  }

  getPendingList(): Observable<OnboardingListItem[]> {
    return this.http.get<OnboardingListItem[]>(`${this.base}/pending`);
  }

  getOnboardingForm(candidateId: number): Observable<OnboardingFormData> {
    return this.http.get<OnboardingFormData>(`${this.base}/${candidateId}/form`);
  }

  saveDraft(candidateId: number, dto: OnboardingProfileDto): Observable<{ candidateId: number; savedAt: string }> {
    return this.http.post<{ candidateId: number; savedAt: string }>(`${this.base}/${candidateId}/draft`, dto);
  }

  completeProfile(candidateId: number, dto: OnboardingProfileDto): Observable<CompletionResult> {
    return this.http.post<CompletionResult>(`${this.base}/${candidateId}/complete`, dto);
  }
}
