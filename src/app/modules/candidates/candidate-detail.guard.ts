import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserStore } from '../../core/user.store';
import { CandidateService } from './candidate.service';

const CANDIDATE_PERMISSIONS = ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'];

/**
 * /rh/candidates/:id — the candidate permissions, or full record access (HR_ONBOARDING /
 * IT_PROVISIONING, asked of the server). A seat on an interview panel no longer opens this
 * page: an interviewer reads the candidate, the CV and writes their PV from the shell's
 * self-service (« Entretiens » tab), never from the RH module. Anyone else goes to the shell's
 * /forbidden, as the permission guard does.
 */
export const candidateDetailGuard: CanActivateFn = route => {
  const userStore = inject(UserStore);
  const router    = inject(Router);
  if (CANDIDATE_PERMISSIONS.some(p => userStore.hasPermission(p))) return true;

  const id = Number(route.paramMap.get('id'));
  if (!id) return router.parseUrl('/forbidden');
  return inject(CandidateService).getAccess(id).pipe(
    map(a => a.fullAccess ? true : router.parseUrl('/forbidden')),
    catchError(() => of(router.parseUrl('/forbidden'))),
  );
};
