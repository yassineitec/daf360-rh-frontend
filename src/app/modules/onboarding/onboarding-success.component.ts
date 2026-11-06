import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PageGuideComponent } from '../../shared/guide/page-guide.component';
import { GuideStep } from '../../shared/guide/page-guide.types';

/** Steps of the page guide, started from « Aide & guides »; `target` = a `data-guide` anchor. */
const GUIDE_STEPS: GuideStep[] = [
  { icon: 'celebration', titleKey: 'ONB_SUCCESS_GUIDE.WELCOME.TITLE', textKey: 'ONB_SUCCESS_GUIDE.WELCOME.TEXT' },
  { icon: 'arrow_forward', titleKey: 'ONB_SUCCESS_GUIDE.CARD.TITLE', textKey: 'ONB_SUCCESS_GUIDE.CARD.TEXT', target: 'card' },
  { icon: 'help', titleKey: 'ONB_SUCCESS_GUIDE.END.TITLE', textKey: 'ONB_SUCCESS_GUIDE.END.TEXT' },
];

@Component({
  selector: 'app-onboarding-success',
  standalone: true,
  imports: [TranslatePipe, PageGuideComponent],
  templateUrl: './onboarding-success.component.html',
  styleUrls: ['./onboarding-success.component.scss'],
})
export class OnboardingSuccessComponent implements OnInit {
  readonly guideSteps = GUIDE_STEPS;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  profileId  = signal(0);
  userId     = signal(0);
  ms365Email = signal('');
  fullName   = signal('');
  employeeId = signal('');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.profileId.set(+(params['profileId'] ?? 0));
    this.userId.set(+(params['userId'] ?? 0));
    this.ms365Email.set(params['ms365Email'] ?? '');
    this.fullName.set(params['fullName'] ?? '');
    this.employeeId.set(String(this.userId()));
  }

  goToProfile(): void {
    // Navigate to the newly-created employee's profile detail, not the full list.
    const id = this.profileId();
    this.router.navigate(id ? ['/rh/profiles', id] : ['/rh/profiles']);
  }

  goToList(): void {
    this.router.navigate(['/rh/onboarding']);
  }
}
