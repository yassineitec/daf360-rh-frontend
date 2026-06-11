import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-onboarding-success',
  standalone: true,
  imports: [],
  templateUrl: './onboarding-success.component.html',
  styleUrls: ['./onboarding-success.component.scss'],
})
export class OnboardingSuccessComponent implements OnInit {
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
    this.router.navigate(['/hr/profiles']);
  }

  goToList(): void {
    this.router.navigate(['/hr/onboarding']);
  }
}
