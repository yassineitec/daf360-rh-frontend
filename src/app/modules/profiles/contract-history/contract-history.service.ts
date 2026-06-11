import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ContractHistoryDto, CreateContractRequest, TypeContratDto } from './contract-history.model';

@Injectable({ providedIn: 'root' })
export class ContractHistoryService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr';

  getHistory(profileId: number): Observable<ContractHistoryDto[]> {
    return this.http.get<ContractHistoryDto[]>(`${this.base}/profiles/${profileId}/contrats`)
      .pipe(catchError(() => of([])));
  }

  getActiveContract(profileId: number): Observable<ContractHistoryDto | null> {
    return this.http.get<ContractHistoryDto>(`${this.base}/profiles/${profileId}/contrats/actif`)
      .pipe(catchError(() => of(null)));
  }

  addContract(profileId: number, req: CreateContractRequest): Observable<ContractHistoryDto> {
    return this.http.post<ContractHistoryDto>(`${this.base}/profiles/${profileId}/contrats`, req);
  }

  getTypeContrats(): Observable<TypeContratDto[]> {
    return this.http.get<TypeContratDto[]>(`${this.base}/ref/type-contrat`)
      .pipe(catchError(() => of([])));
  }

  createTypeContrat(body: { code: string; labelFr: string; labelEn?: string }): Observable<TypeContratDto> {
    return this.http.post<TypeContratDto>(`${this.base}/ref/type-contrat`, body);
  }

  deleteTypeContrat(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/ref/type-contrat/${id}`);
  }
}
