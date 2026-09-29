import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AdminService } from '../admin.service';
import { HolidayCalendarConfigService } from '../holiday-calendar-config.service';
import { DEFAULT_HOLIDAY_CALENDAR_CONFIG, HOLIDAY_CALENDAR_CONFIG_KEY, ParameterSet } from '../models/admin.model';

function row(valeur: string, id = 7): ParameterSet {
  return { id, paysId: 179, cle: HOLIDAY_CALENDAR_CONFIG_KEY, valeur, description: null, updatedAt: '' };
}

describe('HolidayCalendarConfigService', () => {
  let admin: {
    listParameters: ReturnType<typeof vi.fn>;
    createParameter: ReturnType<typeof vi.fn>;
    updateParameter: ReturnType<typeof vi.fn>;
  };
  let svc: HolidayCalendarConfigService;

  beforeEach(() => {
    admin = {
      listParameters:  vi.fn(),
      createParameter: vi.fn(() => of(row('{}'))),
      updateParameter: vi.fn(() => of(row('{}'))),
    };
    TestBed.configureTestingModule({ providers: [{ provide: AdminService, useValue: admin }] });
    svc = TestBed.inject(HolidayCalendarConfigService);
  });

  it('returns the defaults when the pays has no config row', async () => {
    admin.listParameters.mockReturnValue(of([{ ...row('3'), cle: 'TAUX_CSS' }]));
    const res = await firstValueFrom(svc.load(179));
    expect(res).toEqual({ config: DEFAULT_HOLIDAY_CALENDAR_CONFIG, paramId: null, hasOtherParams: true });
  });

  it('reports a pays with no parameters at all', async () => {
    admin.listParameters.mockReturnValue(of([]));
    const res = await firstValueFrom(svc.load(179));
    expect(res.hasOtherParams).toBe(false);
  });

  it('does not count the config row itself as another parameter', async () => {
    admin.listParameters.mockReturnValue(of([row('{}')]));
    const res = await firstValueFrom(svc.load(179));
    expect(res.hasOtherParams).toBe(false);
  });

  it('returns the defaults when reading parameters is forbidden', async () => {
    admin.listParameters.mockReturnValue(throwError(() => ({ status: 403 })));
    const res = await firstValueFrom(svc.load(179));
    expect(res).toEqual({ config: DEFAULT_HOLIDAY_CALENDAR_CONFIG, paramId: null, hasOtherParams: true });
  });

  it('parses a saved row and keeps its id', async () => {
    admin.listParameters.mockReturnValue(of([row('{"showFlag":false,"flagIsoCode":"FR","abbrev":"Férié","color":"#1D4ED8"}')]));
    const res = await firstValueFrom(svc.load(179));
    expect(res).toEqual({
      config: { showFlag: false, flagIsoCode: 'fr', abbrev: 'Férié', color: '#1d4ed8' },
      paramId: 7,
      hasOtherParams: false,
    });
  });

  it('falls back field by field on invalid values', async () => {
    admin.listParameters.mockReturnValue(of([row('{"showFlag":"yes","flagIsoCode":"zz","abbrev":"Beaucoup trop long","color":"red"}')]));
    const res = await firstValueFrom(svc.load(179));
    expect(res.config).toEqual(DEFAULT_HOLIDAY_CALENDAR_CONFIG);
  });

  it('falls back to the defaults on a non-JSON value', async () => {
    admin.listParameters.mockReturnValue(of([row('pas du json')]));
    const res = await firstValueFrom(svc.load(179));
    expect(res.config).toEqual(DEFAULT_HOLIDAY_CALENDAR_CONFIG);
  });

  it('creates the row on first save', async () => {
    await firstValueFrom(svc.save(179, { ...DEFAULT_HOLIDAY_CALENDAR_CONFIG, abbrev: 'JF' }, null));
    expect(admin.updateParameter).not.toHaveBeenCalled();
    const dto = admin.createParameter.mock.calls[0][0];
    expect(dto.paysId).toBe(179);
    expect(dto.cle).toBe(HOLIDAY_CALENDAR_CONFIG_KEY);
    expect(JSON.parse(dto.valeur).abbrev).toBe('JF');
  });

  it('updates the existing row afterwards', async () => {
    await firstValueFrom(svc.save(179, DEFAULT_HOLIDAY_CALENDAR_CONFIG, 7));
    expect(admin.createParameter).not.toHaveBeenCalled();
    expect(admin.updateParameter.mock.calls[0][0]).toBe(7);
  });
});
