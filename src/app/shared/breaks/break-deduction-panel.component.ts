import {
  Component, OnChanges, SimpleChanges, inject, input, output, signal,
} from '@angular/core';
import { BreakService } from '../../modules/admin/breaks/break.service';
import { ComputedBreakDeduction } from '../../modules/admin/breaks/break.model';

@Component({
  selector: 'app-break-deduction-panel',
  standalone: true,
  imports: [],
  template: `
<div style="background:#f7f9fb;border:1px solid #eceef0;border-radius:12px;padding:16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <p style="font-size:12px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.4px;margin:0;">Pauses déduites</p>
    @if (isLoading()) {
      <span style="font-size:11px;color:#44474c;">Calcul…</span>
    }
  </div>

  @if (!isLoading() && deductions().length === 0) {
    <p style="font-size:12px;color:#75777d;margin:0;font-style:italic;">Aucune pause automatique applicable.</p>
  }

  @for (d of deductions(); track d.label) {
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fff;border-radius:8px;margin-bottom:6px;border:1px solid #eceef0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="width:8px;height:8px;border-radius:50%;background:{{ d.source === 'LEGAL_RULE' ? '#f59e0b' : '#1a6b7c' }};flex-shrink:0;"></span>
        <span style="font-size:12px;color:#1d2b3e;">{{ d.label }}</span>
        @if (d.breakTimeStart && d.breakTimeEnd) {
          <span style="font-size:10px;color:#75777d;background:#f2f4f6;padding:1px 7px;border-radius:4px;margin-left:4px;">
            {{ d.breakTimeStart }} – {{ d.breakTimeEnd }}
          </span>
        }
        <span style="font-size:10px;color:#44474c;background:#f2f4f6;padding:2px 7px;border-radius:4px;">{{ d.durationMin }} min</span>
      </div>
      <span style="font-size:12px;font-weight:600;color:#ba1a1a;">−{{ d.deductedHours.toFixed(2) }}h</span>
    </div>
  }

  @if (!isLoading() && deductions().length > 0) {
    <div style="display:flex;justify-content:space-between;padding:8px 12px;margin-top:4px;background:#fff;border-radius:8px;border:1px solid #eceef0;">
      <span style="font-size:12px;font-weight:700;color:#1d2b3e;">Heures nettes</span>
      <span style="font-size:14px;font-weight:800;color:#1d2b3e;">{{ netHours().toFixed(2) }}h</span>
    </div>
  }
</div>
  `,
})
export class BreakDeductionPanelComponent implements OnChanges {
  private svc = inject(BreakService);

  readonly regimeId        = input<number | null>(null);
  readonly grossHours      = input<number>(0);
  readonly workDate        = input<string>('');
  readonly paysId          = input<number>(0);
  readonly readonly        = input<boolean>(false);

  readonly netHoursChanged = output<number>();

  deductions = signal<ComputedBreakDeduction[]>([]);
  isLoading  = signal(false);

  netHours = signal<number>(0);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['grossHours'] || changes['workDate'] || changes['paysId'] || changes['regimeId']) {
      this.compute();
    }
  }

  private compute(): void {
    const gross = this.grossHours();
    const pays  = this.paysId();
    if (!gross || !pays) {
      this.deductions.set([]);
      this.netHours.set(gross ?? 0);
      return;
    }
    this.isLoading.set(true);
    const regimeId = this.regimeId();
    const obs = regimeId
        ? this.svc.getTemplatesForRegime(regimeId)
        : this.svc.getTemplatesForPays(pays);

    obs.subscribe({
      next: templates => {
        // Simple client-side deduction: sum durations from AUTO/MANDATORY templates
        const applicable = templates.filter(t =>
          t.isActive && t.deductionType !== 'OPTIONAL' &&
          (!t.minWorkHoursTrigger || gross >= t.minWorkHoursTrigger)
        );
        const deductions: ComputedBreakDeduction[] = applicable.map(t => ({
          source: 'TEMPLATE',
          label: t.labelFr,
          durationMin: t.durationMin,
          deductedHours: t.durationMin / 60,
          appliesToDays: t.appliesToDays,
          breakTimeStart: t.breakTimeStart,
          breakTimeEnd:   t.breakTimeEnd,
        }));
        const totalDeducted = deductions.reduce((s, d) => s + d.deductedHours, 0);
        const net = Math.max(0, gross - totalDeducted);
        this.deductions.set(deductions);
        this.netHours.set(net);
        this.netHoursChanged.emit(net);
        this.isLoading.set(false);
      },
      error: () => {
        this.deductions.set([]);
        this.netHours.set(gross);
        this.isLoading.set(false);
      },
    });
  }
}
