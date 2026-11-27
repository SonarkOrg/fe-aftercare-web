import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { PrivacyGate } from '../../../models/privacy-gate.model';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { PrivacyGatesComponent } from './privacy-gates.component';

describe('PrivacyGatesComponent (PRIV-A-40)', () => {
  const url = `${environment.apiUrl}/settings/privacy-gates`;
  let fixture: ComponentFixture<PrivacyGatesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const gate = (over: Partial<PrivacyGate> = {}): PrivacyGate => ({ gate: 'NAM_COLLECTION', enabled: false, decisionRef: null, decidedAt: null, decidedByName: null, ...over });

  async function init(lang: 'fr' | 'en', list: PrivacyGate[]) {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(lang), HttpClientTestingModule, FormsModule],
      declarations: [PrivacyGatesComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PrivacyGatesComponent);
    el = fixture.nativeElement;
    await settle();
    http.expectOne(url).flush(list);
    await settle();
  }
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const row = (k: string) => q(`[data-gate=${k}]`);
  afterEach(() => http.verify());

  it('shows the two switches with their labels and a glyph + word status, off by default (fr-CA)', async () => {
    await init('fr', [gate(), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    expect(el.querySelector('h2')!.textContent).toContain('Confidentialité');
    expect(row('NAM_COLLECTION').textContent).toContain('Recueillir le NAM dans le produit (décision P1)');
    expect(row('HEALTH_CARD_CAPTURE').textContent).toContain("L'accueil peut lire et inscrire la carte (décision Q1)");
    expect(row('NAM_COLLECTION').querySelector('.gate-row__status')!.textContent!.trim()).toBe('— Désactivé');
    expect(row('NAM_COLLECTION').querySelector('label')!.textContent).toContain('Référence de la décision');
  });

  it('the English labels and status words', async () => {
    await init('en', [gate({ enabled: true, decisionRef: 'Z-DECISION P1', decidedAt: '2026-11-27T15:00:00Z', decidedByName: 'Dev Admin' }), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    expect(row('NAM_COLLECTION').textContent).toContain('Record the health-card number in the product (decision P1)');
    expect(row('NAM_COLLECTION').querySelector('.gate-row__status')!.textContent!.trim()).toBe('✓ On');
    expect(row('HEALTH_CARD_CAPTURE').querySelector('.gate-row__status')!.textContent!.trim()).toBe('— Off');
    expect(row('NAM_COLLECTION').textContent).toContain('Z-DECISION P1');
    expect(row('NAM_COLLECTION').textContent).toContain('Dev Admin');
  });

  it('cannot be turned on without a decision reference; with one it puts enabled + decisionRef and shows the answer', async () => {
    await init('en', [gate(), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    const btn = row('HEALTH_CARD_CAPTURE').querySelector<HTMLButtonElement>('.gate-enable')!;
    expect(btn.disabled).toBeTrue();
    const input = row('HEALTH_CARD_CAPTURE').querySelector<HTMLInputElement>('input')!;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    await settle();
    expect(btn.disabled).toBeTrue();
    input.value = 'Q1 recorded 2026-11-30';
    input.dispatchEvent(new Event('input'));
    await settle();
    expect(btn.disabled).toBeFalse();
    btn.click();
    const r = http.expectOne(`${url}/HEALTH_CARD_CAPTURE`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ enabled: true, decisionRef: 'Q1 recorded 2026-11-30' });
    r.flush(gate({ gate: 'HEALTH_CARD_CAPTURE', enabled: true, decisionRef: 'Q1 recorded 2026-11-30', decidedAt: '2026-11-30T15:00:00Z', decidedByName: 'Dev Admin' }));
    await settle();
    expect(row('HEALTH_CARD_CAPTURE').querySelector('.gate-row__status')!.textContent!.trim()).toBe('✓ On');
    expect(row('HEALTH_CARD_CAPTURE').querySelector('.gate-disable')).not.toBeNull();
  });

  it('turning one off sends enabled false and no reference', async () => {
    await init('en', [gate({ enabled: true, decisionRef: 'P1 ok' }), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    row('NAM_COLLECTION').querySelector<HTMLButtonElement>('.gate-disable')!.click();
    const r = http.expectOne(`${url}/NAM_COLLECTION`);
    expect(r.request.body).toEqual({ enabled: false, decisionRef: null });
    r.flush(gate({ enabled: false, decisionRef: 'P1 ok', decidedAt: '2026-11-30T15:00:00Z', decidedByName: 'Dev Admin' }));
    await settle();
    expect(row('NAM_COLLECTION').querySelector('.gate-row__status')!.textContent!.trim()).toBe('— Off');
    expect(row('NAM_COLLECTION').querySelector('.gate-enable')).not.toBeNull();
  });

  it('a 400 on decisionRef is shown under the field, in the user language', async () => {
    await init('fr', [gate(), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    const input = row('NAM_COLLECTION').querySelector<HTMLInputElement>('input')!;
    input.value = 'TREM 6854 1212';
    input.dispatchEvent(new Event('input'));
    await settle();
    row('NAM_COLLECTION').querySelector<HTMLButtonElement>('.gate-enable')!.click();
    http.expectOne(`${url}/NAM_COLLECTION`).flush({ status: 400, error: 'VALIDATION_FAILED', message: 'Validation failed', fieldErrors: { decisionRef: 'is required to enable a privacy gate' } },
      { status: 400, statusText: 'Bad Request' });
    await settle();
    const err = row('NAM_COLLECTION').querySelector('.field-error')!;
    expect(err.textContent!.trim().length).toBeGreaterThan(5);
    expect(err.textContent).not.toContain('error.');
    expect(row('NAM_COLLECTION').querySelector('.gate-row__status')!.textContent!.trim()).toBe('— Désactivé');
  });

  it('a failed load shows a banner with a retry button', async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang('en'), HttpClientTestingModule, FormsModule],
      declarations: [PrivacyGatesComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PrivacyGatesComponent);
    el = fixture.nativeElement;
    await settle();
    http.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(q('.banner--error').textContent).toContain('Server error');
    q<HTMLButtonElement>('.banner--error button').click();
    http.expectOne(url).flush([gate(), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    await settle();
    expect(el.querySelectorAll('.gate-row').length).toBe(2);
  });
});
