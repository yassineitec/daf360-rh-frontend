import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { HolidayCalendarComponent } from '../holiday-calendar.component';
import { DEFAULT_HOLIDAY_CALENDAR_CONFIG, Holiday, HolidayCalendarConfig } from '../models/admin.model';

/** A holiday on today's date, so it lands in the month the calendar opens on. */
function todayHoliday(): Holiday {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { id: 1, paysId: 179, dateHoliday: iso, frenchLabel: 'Fête', englishLabel: 'Holiday', isRecurring: false };
}

function render(config?: Partial<HolidayCalendarConfig>): HTMLElement {
  TestBed.configureTestingModule({ imports: [HolidayCalendarComponent], providers: [provideTranslateService()] });
  const fixture = TestBed.createComponent(HolidayCalendarComponent);
  fixture.componentRef.setInput('holidays', [todayHoliday()]);
  fixture.componentRef.setInput('paysIsoCode', 'TN');
  if (config) fixture.componentRef.setInput('config', { ...DEFAULT_HOLIDAY_CALENDAR_CONFIG, ...config });
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HolidayCalendarComponent badge config', () => {
  it('keeps the original display when nothing is configured', () => {
    const el = render();
    const bar = el.querySelector<HTMLElement>('.hc-holiday-bar')!;
    expect(bar.querySelector('img')!.getAttribute('alt')).toBe('tn');
    expect(bar.querySelector('.hc-holiday-abbrev')!.textContent!.trim()).toBe('ADMIN.catalog.holidays.calendar.abbrev');
    expect(bar.style.getPropertyValue('--hc-badge')).toBe('');
  });

  it('hides the flag when showFlag is false', () => {
    const el = render({ showFlag: false });
    expect(el.querySelector('.hc-holiday-bar img')).toBeNull();
  });

  it('draws the configured country flag instead of the entity one', () => {
    const el = render({ flagIsoCode: 'fr' });
    expect(el.querySelector('.hc-holiday-bar img')!.getAttribute('alt')).toBe('fr');
  });

  it('uses the configured abbreviation', () => {
    const el = render({ abbrev: 'Férié' });
    expect(el.querySelector('.hc-holiday-abbrev')!.textContent!.trim()).toBe('Férié');
  });

  it('applies the configured colour', () => {
    const el = render({ color: '#1d4ed8' });
    expect(el.querySelector<HTMLElement>('.hc-holiday-bar')!.style.getPropertyValue('--hc-badge')).toBe('#1d4ed8');
  });
});
