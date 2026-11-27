import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArrivalRow } from '../../../models/arrival.model';
import { PageHarness } from '../../../testing/page-harness';
import * as F from '../../../testing/fixtures';
import { FixPanelComponent } from '../fix-panel/fix-panel.component';
import { ArrivalRowComponent } from './arrival-row.component';

describe('ArrivalRowComponent', () => {
  const h = new PageHarness();

  function setup(row: ArrivalRow, over: Partial<ArrivalRowComponent> = {}, role: 'ADMIN' | 'NURSE' | 'PHYSICIAN' | 'RECEPTION' = 'RECEPTION', lang: 'en' | 'fr' = 'en'): { f: ComponentFixture<ArrivalRowComponent>; el: HTMLElement; events: string[] } {
    const f = h.create(lang, ArrivalRowComponent, [FixPanelComponent], false, {}, role);
    Object.assign(f.componentInstance, { row }, over);
    f.componentInstance.ngOnChanges();
    const events: string[] = [];
    f.componentInstance.arrive.subscribe(() => events.push('arrive'));
    f.componentInstance.undo.subscribe(() => events.push('undo'));
    f.componentInstance.toggle.subscribe(() => events.push('toggle'));
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, events };
  }

  const check = F.arrivalRow({
    appointmentId: 78, scheduledAt: '2026-10-14T14:30:00', status: 'SCHEDULED', questionnaire: 'MISSING',
    patient: F.deskPatient({ id: 13, firstName: 'Jean', lastName: 'Gagnon', contactConsent: 'UNKNOWN', ageYears: 41, dateOfBirth: '1985-02-03' }),
    desk: { state: 'CHECK', reasons: ['QUESTIONNAIRE_MISSING'], notices: ['CONSENT_UNKNOWN'] }
  });

  it('shows time, name, age (not the birth date), type and clinician', () => {
    const { el } = setup(check);
    expect(el.querySelector('.appt__time')!.textContent).toBe('14:30');
    expect(el.querySelector('.fd-row__name')!.textContent).toBe('Jean Gagnon');
    expect(el.querySelector('.fd-row__age')!.textContent).toBe('41 yrs');
    expect(el.querySelector('.fd-row__meta')!.textContent).toContain('Pre op consult');
    expect(el.querySelector('.fd-row__meta')!.textContent).toContain('Dr Bouchard');
    expect(el.textContent).not.toContain('1985');
  });

  it('shows the birth date only on the highlighted row, with aria-current', () => {
    const idle = setup(check);
    expect(idle.el.querySelector('.fd-row__dob')).toBeNull();
    expect(idle.el.querySelector('.fd-row')!.getAttribute('aria-current')).toBeNull();
    TestBed.resetTestingModule();
    const on = setup(check, { active: true });
    expect(on.el.querySelector('.fd-row__dob')!.textContent).toContain('Born 3 Feb 1985');
    expect(on.el.querySelector('.fd-row')!.getAttribute('aria-current')).toBe('true');
    expect(on.el.querySelector('.fd-row')!.classList).toContain('is-active');
  });

  it('a highlighted row that is also expanded shows the birth date once (in the panel)', () => {
    const { el } = setup(check, { active: true, expanded: true });
    expect(el.querySelector('.fd-row__dob')).toBeNull();
    expect((el.textContent!.match(/1985/g) ?? []).length).toBe(1);
  });

  it('chips are glyph plus word: desk chip, reason, notice', () => {
    const { el } = setup(check);
    const chips = Array.from(el.querySelectorAll('.fd-row__chips .chip')).map(c => `${c.querySelector('.chip__glyph')!.textContent}|${c.querySelector('.chip__label')!.textContent}`);
    expect(chips).toEqual(['●|To check', '●|Questionnaire missing', 'ℹ|Consent not answered']);
  });

  it('ignores codes it does not know and folds notices beyond two into a +n pill', () => {
    const row = F.arrivalRow({ desk: { state: 'CHECK', reasons: ['FROM_A_LATER_PHASE', 'DOB_MISSING'], notices: ['CONSENT_UNKNOWN', 'CONSENT_UNKNOWN', 'CONSENT_UNKNOWN', 'CONSENT_UNKNOWN'] } });
    const { el } = setup(row);
    expect(el.querySelectorAll('.fd-row__chips .chip').length).toBe(1 + 1 + 2);
    expect(el.querySelector('.count-pill')!.textContent).toContain('+2');
  });

  it('an expected row has the primary arrive button; clicking it emits once', () => {
    const { el, events } = setup(check);
    const b = el.querySelector<HTMLButtonElement>('#arrive-78')!;
    expect(b.textContent!.trim()).toBe('Mark arrived');
    expect(b.classList).toContain('btn--primary');
    b.click();
    expect(events).toEqual(['arrive']);
  });

  it('an arrived row shows "Here since" with the time and an undo button instead', () => {
    const row = F.arrivalRow({ arrival: { arrivedAt: '2026-10-14T13:21:00Z', source: 'DESK', byName: 'Dev Reception' }, desk: { state: 'ARRIVED', reasons: [], notices: [] } });
    const { el, events } = setup(row);
    expect(el.querySelector('.fd-arrive')).toBeNull();
    expect(el.querySelector('.fd-row__since')!.textContent).toBe('Here since 09:21');
    el.querySelector<HTMLButtonElement>('.fd-undo')!.click();
    expect(events).toEqual(['undo']);
  });

  it('a closed row has no action button', () => {
    const { el } = setup(F.arrivalRow({ desk: { state: 'CLOSED', reasons: [], notices: [] }, status: 'COMPLETED' }));
    expect(el.querySelector('.fd-arrive')).toBeNull();
    expect(el.querySelector('.fd-undo')).toBeNull();
  });

  it('a read-only day (not today) has no buttons at all', () => {
    const arrived = F.arrivalRow({ arrival: { arrivedAt: '2026-10-14T13:21:00Z', source: 'DESK', byName: null }, desk: { state: 'ARRIVED', reasons: [], notices: [] } });
    expect(setup(check, { readOnly: true }).el.querySelector('.fd-arrive')).toBeNull();
    TestBed.resetTestingModule();
    expect(setup(arrived, { readOnly: true }).el.querySelector('.fd-undo')).toBeNull();
  });

  for (const role of ['RECEPTION', 'NURSE', 'PHYSICIAN', 'ADMIN'] as const) {
    it(`the arrive button is visible for ${role}`, () => {
      expect(setup(check, {}, role).el.querySelector('.fd-arrive')).not.toBeNull();
    });
  }

  it('the toggle reports aria-expanded and the panel appears with the row', () => {
    const closed = setup(check);
    const t = closed.el.querySelector<HTMLButtonElement>('.fd-toggle')!;
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(t.getAttribute('aria-label')).toBe('Show details of Jean Gagnon');
    expect(closed.el.querySelector('app-fix-panel')).toBeNull();
    t.click();
    expect(closed.events).toEqual(['toggle']);
    TestBed.resetTestingModule();
    const open = setup(check, { expanded: true });
    expect(open.el.querySelector('.fd-toggle')!.getAttribute('aria-expanded')).toBe('true');
    expect(open.el.querySelector('app-fix-panel')).not.toBeNull();
  });

  it('is rendered in French with the French chip words and age', () => {
    const { el } = setup(check, {}, 'RECEPTION', 'fr');
    expect(el.querySelector('.fd-row__age')!.textContent).toBe('41 ans');
    expect(el.querySelector('.fd-arrive')!.textContent!.trim()).toBe('Marquer l\'arrivée');
    expect(Array.from(el.querySelectorAll('.chip__label')).map(c => c.textContent)).toEqual(['À vérifier', 'Questionnaire manquant', 'Consentement sans réponse']);
  });
});
