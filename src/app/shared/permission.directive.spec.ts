import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient }          from '@angular/common/http';
import { provideHttpClientTesting }   from '@angular/common/http/testing';

import { PermissionDirective } from './permission.directive';
import { UserStore }           from '../core/user.store';

// ── Test host ──────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [PermissionDirective],
  template: `
    <span *appHasPermission="'RESPONSE_LEAVE'" id="guarded">Visible</span>
    <span *appHasPermission="'NONEXISTENT'"    id="hidden">Hidden</span>
  `,
})
class TestHostComponent {}

describe('PermissionDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let store:   UserStore;

  const setPermissions = (perms: string[]) => {
    // Patch the store's signal via the mock override
    (store as unknown as { _user: ReturnType<typeof signal> })._user.set({
      userId: 1, fullName: 'Bob', email: 'b@arx.ing', azureUpn: 'b@arx.ing',
      roleId: 2, roleName: 'RH', permissions: perms,
      paysId: 179, isoCode: 'TN', employeeId: '', photoUrl: null,
    });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports:   [TestHostComponent, PermissionDirective],
      providers: [UserStore, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    store   = TestBed.inject(UserStore);
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders element when user has the required permission', () => {
    setPermissions(['RESPONSE_LEAVE', 'GET_LEAVES']);

    const el = fixture.nativeElement.querySelector('#guarded');
    expect(el).toBeTruthy();
    expect(el.textContent.trim()).toBe('Visible');
  });

  it('does NOT render element when user lacks the required permission', () => {
    setPermissions(['GET_LEAVES']);   // no RESPONSE_LEAVE

    const el = fixture.nativeElement.querySelector('#guarded');
    expect(el).toBeNull();
  });

  it('hides element whose permission is never granted', () => {
    setPermissions(['RESPONSE_LEAVE', 'GET_LEAVES']);

    const el = fixture.nativeElement.querySelector('#hidden');
    expect(el).toBeNull();
  });

  it('shows element after permission is dynamically added', () => {
    setPermissions([]);
    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();

    setPermissions(['RESPONSE_LEAVE']);
    expect(fixture.nativeElement.querySelector('#guarded')).toBeTruthy();
  });

  it('hides element after permission is dynamically removed', () => {
    setPermissions(['RESPONSE_LEAVE']);
    expect(fixture.nativeElement.querySelector('#guarded')).toBeTruthy();

    setPermissions([]);
    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();
  });

  it('renders nothing when user is not authenticated', () => {
    (store as unknown as { _user: ReturnType<typeof signal> })._user.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();
    expect(fixture.nativeElement.querySelector('#hidden')).toBeNull();
  });
});
