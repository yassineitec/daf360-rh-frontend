import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserStore } from '../../core/user.store';
import { CandidateService } from './candidate.service';

const CANDIDATE_PERMISSIONS = ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'];

/**
 * /rh/candidates/:id (V132) — the candidate permissions as before, or a seat on one of this
 * candidate's interview panels, which is not a permission and so has to be asked of the
 * server. Anyone else goes to the shell's /forbidden, as the permission guard does.
 */
export const candidateDetailGuard: CanActivateFn = route => {
  const userStore = inject(UserStore);
  const router    = inject(Router);
  if (CANDIDATE_PERMISSIONS.some(p => userStore.hasPermission(p))) return true;

  const id = Number(route.paramMap.get('id'));
  if (!id) return router.parseUrl('/forbidden');
  return inject(CandidateService).getAccess(id).pipe(
    map(a => (a.fullAccess || a.interviewer) ? true : router.parseUrl('/forbidden')),
    catchError(() => of(router.parseUrl('/forbidden'))),
  );
};
