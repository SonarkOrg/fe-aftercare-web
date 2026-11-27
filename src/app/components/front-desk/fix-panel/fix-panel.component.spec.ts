import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ArrivalRow } from '../../../models/arrival.model';
import { PageHarness } from '../../../testing/page-harness';
import * as F from '../../../testing/fixtures';
import { FixPanelComponent } from './fix-panel.component';

describe('FixPanelComponent', () => {
  const h = new PageHarness();

  const sophie = (over: Partial<ArrivalRow> = {}, consent: 'UNKNOWN' | 'GRANTED' | 'WITHDRAWN' = 'UNKNOWN', contactMissing = false): ArrivalRow => F.arrivalRow({
    appointmentId: 79, status: 'SCHEDULED', questionnaire: 'MISSING', linkUsable: true,
    patient: F.deskPatient({ id: 14, firstName: 'Sophie', lastName: 'Roy', contactConsent: consent, contactMissing }),
    desk: { state: 'CHECK', reasons: ['QUESTIONNAIRE_MISSING'], notices: consent === 'UNKNOWN' && !contactMissing ? ['CONSENT_UNKNOWN'] : [] }, ...over
  });

  function setup(row: ArrivalRow, role: 'ADMIN' | 'NURSE' | 'PHYSICIAN' | 'RECEPTION' = 'RECEPTION', lang: 'en' | 'fr' = 'en') {
    const f: ComponentFixture<FixPanelComponent> = h.create(lang, FixPanelComponent, [], false, {}, role);
    f.componentInstance.row = row;
    f.componentInstance.ngOnChanges();
    const saved: string[] = [];
    f.componentInstance.consentSaved.subscribe(v => saved.push(v));
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    return { f, el: f.nativeElement as HTMLElement, saved, http };
  }

  it('questionnaire missing and consent unknown: the question sits above a disabled "Send link"', () => {
    const { el } = setup(sophie());
    const text = el.textContent!;
    expect(text.indexOf('Accepts clinic messages?')).toBeGreaterThan(-1);
    expect(text.indexOf('Accepts clinic messages?')).toBeLessThan(text.indexOf('Send link'));
    const send = el.querySelector<HTMLButtonElement>('.fd-send-disabled')!;
    expect(send.disabled).toBeTrue();
    expect(el.querySelector('app-send-link')).toBeNull();
    expect(el.querySelector('.fd-new-link')).toBeNull(); // reception never sees a plaintext link code (A-44)
  });

  it('a clinical role is offered "New link" next to the disabled send button', () => {
    const { el } = setup(sophie(), 'NURSE');
    expect(el.querySelector('.fd-send-disabled')).not.toBeNull();
    expect(el.querySelector('.fd-new-link')).not.toBeNull();
  });

  it('"Yes" sends exactly one PUT, then the real send-link replaces the disabled button', () => {
    const { f, el, saved, http } = setup(sophie());
    el.querySelector<HTMLButtonElement>('.fd-consent-yes')!.click();
    const req = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/patients/14/contact-consent'));
    expect(req.request.body).toEqual({ contactConsent: 'GRANTED' });
    req.flush({ contactConsent: 'GRANTED' });
    f.detectChanges();
    expect(saved).toEqual(['GRANTED']);
    expect(el.querySelector('.fd-send-disabled')).toBeNull();
    expect(el.querySelector('app-send-link')).not.toBeNull();
    expect(el.querySelector('.fd-consent-yes')).toBeNull();
    http.verify();
  });

  it('"No" at the desk sends WITHDRAWN and points to the clinical team, with no send button and no new link', () => {
    const { f, el, saved, http } = setup(sophie());
    el.querySelector<HTMLButtonElement>('.fd-consent-no')!.click();
    http.expectOne(r => r.method === 'PUT').flush({ contactConsent: 'WITHDRAWN' });
    f.detectChanges();
    expect(saved).toEqual(['WITHDRAWN']);
    expect(el.textContent).toContain('a member of the clinical team can create a new link');
    expect(el.querySelector('app-send-link')).toBeNull();
    expect(el.querySelector('.fd-new-link')).toBeNull();
  });

  it('"No" for a clinical role shows the refused line, with no send button but the new link', () => {
    const { f, el, saved, http } = setup(sophie(), 'NURSE');
    el.querySelector<HTMLButtonElement>('.fd-consent-no')!.click();
    http.expectOne(r => r.method === 'PUT').flush({ contactConsent: 'WITHDRAWN' });
    f.detectChanges();
    expect(saved).toEqual(['WITHDRAWN']);
    expect(el.textContent).toContain('Messages refused: use "New link" and give the link to the patient.');
    expect(el.querySelector('app-send-link')).toBeNull();
    expect(el.querySelector('.fd-send-disabled')).toBeNull();
    expect(el.querySelector('.fd-new-link')).not.toBeNull();
  });

  it('a failed consent call shows an error and keeps the question', () => {
    const { f, el, saved, http } = setup(sophie());
    el.querySelector<HTMLButtonElement>('.fd-consent-yes')!.click();
    http.expectOne(r => r.method === 'PUT').flush({ message: 'x' }, { status: 500, statusText: 'err' });
    f.detectChanges();
    expect(saved).toEqual([]);
    expect(el.querySelector('[role=alert]')).not.toBeNull();
    expect(el.querySelector('.fd-consent-yes')).not.toBeNull();
  });

  it('does not send two consent calls while one is in flight', () => {
    const { el, http } = setup(sophie());
    const yes = el.querySelector<HTMLButtonElement>('.fd-consent-yes')!;
    yes.click();
    yes.click();
    http.expectOne(r => r.method === 'PUT');
    http.verify();
  });

  it('consent already granted: "Send link" is the real component and there is no question', () => {
    const { el } = setup(sophie({}, 'GRANTED'));
    expect(el.querySelector('app-send-link')).not.toBeNull();
    expect(el.querySelector('.fd-consent-yes')).toBeNull();
  });

  it('"New link" creates a link once and shows the copy field; the code is not in the page text', () => {
    const { f, el, http } = setup(sophie({}, 'GRANTED'), 'NURSE');
    el.querySelector<HTMLButtonElement>('.fd-new-link')!.click();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/appointments/79/access-code'));
    req.flush({ ...F.appointment({ id: 79 }), accessCode: 'dev-fake-code-123' });
    f.detectChanges();
    const input = el.querySelector<HTMLInputElement>('app-access-link input')!;
    expect(input.value).toContain('/q/dev-fake-code-123');
    http.verify();
  });

  it('a walk-in with a questionnaire offers the real "Send link" to the desk once consent is granted (A-44: no code)', () => {
    const walkIn = (consent: 'UNKNOWN' | 'GRANTED', over: Partial<ArrivalRow> = {}) =>
      sophie({ walkIn: true, desk: { state: 'ARRIVED', reasons: [], notices: [] }, ...over }, consent);
    const { f, el } = setup(walkIn('GRANTED'));
    expect(el.querySelector('.fd-walkin-link app-send-link')).not.toBeNull();
    expect(el.querySelector('.fd-new-link')).toBeNull();
    const shown = (row: ArrivalRow) => {
      f.componentInstance.row = row;
      f.componentInstance.ngOnChanges();
      f.detectChanges();
      return el.querySelector('.fd-walkin-link') !== null;
    };
    expect(shown(walkIn('UNKNOWN'))).toBeFalse();
    expect(shown(walkIn('GRANTED', { questionnaire: 'NONE', linkUsable: false }))).toBeFalse();
    expect(shown(walkIn('GRANTED', { walkIn: false }))).toBeFalse();
    expect(shown(walkIn('GRANTED'))).toBeTrue();
  });

  it('"New link" is offered only while the link is usable and the appointment is SCHEDULED', () => {
    expect(setup(sophie({ linkUsable: false }, 'GRANTED'), 'NURSE').el.querySelector('.fd-new-link')).toBeNull();
    TestBed.resetTestingModule();
    expect(setup(sophie({ status: 'READY' }, 'GRANTED'), 'NURSE').el.querySelector('.fd-new-link')).toBeNull();
  });

  it('consent unknown without a questionnaire problem: the short question and the two answers', () => {
    const row = F.arrivalRow({ patient: F.deskPatient({ contactConsent: 'UNKNOWN' }), desk: { state: 'GO', reasons: [], notices: ['CONSENT_UNKNOWN'] } });
    const { el } = setup(row);
    expect(el.textContent).toContain('Does the patient accept clinic messages?');
    expect(el.querySelector('.fd-consent-yes')).not.toBeNull();
    expect(el.querySelector('.fd-send-disabled')).toBeNull();
  });

  it('no contact details: says so, no consent question, no send; contact and birth date help plus the file link', () => {
    const row = sophie({ desk: { state: 'CHECK', reasons: ['QUESTIONNAIRE_MISSING', 'CONTACT_MISSING', 'DOB_MISSING'], notices: [] } }, 'UNKNOWN', true);
    const { el } = setup(row);
    expect(el.textContent).toContain('No e-mail or phone on file');
    expect(el.querySelector('.fd-consent-yes')).toBeNull();
    expect(el.querySelector('app-send-link')).toBeNull();
    expect(el.textContent).toContain('Add the date of birth in the file.');
    expect(el.querySelector<HTMLAnchorElement>('.fd-open-file')!.getAttribute('href')).toBe('/patients/14');
  });

  it('shows the birth date and the room in the panel', () => {
    const { el } = setup(sophie({ location: 'Salle 2' }));
    expect(el.querySelector('.fd-panel__facts')!.textContent).toContain('Born 12 Apr 1968');
    expect(el.querySelector('.fd-panel__facts')!.textContent).toContain('Salle 2');
  });

  it('a read-only day shows no consent buttons and no link actions', () => {
    const f = h.create('en', FixPanelComponent, [], false, {}, 'RECEPTION');
    f.componentInstance.row = sophie();
    f.componentInstance.readOnly = true;
    f.componentInstance.ngOnChanges();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.fd-consent-yes')).toBeNull();
    expect(el.querySelector('.fd-new-link')).toBeNull();
  });

  it('speaks French, with a non-breaking space before the question mark', () => {
    const { el } = setup(sophie(), 'NURSE', 'fr');
    expect(el.textContent).toContain('Accepte les messages de la clinique ?');
    expect(el.querySelector('.fd-consent-yes')!.textContent).toBe('Oui');
    expect(el.querySelector('.fd-new-link')!.textContent).toContain('Nouveau lien');
  });

  describe('card (phase 1B)', () => {
    const arrivedExpired = (): ArrivalRow => F.arrivalRow({
      arrival: { arrivedAt: '2026-10-14T13:00:00Z', source: 'DESK', byName: null },
      desk: { state: 'ARRIVED', reasons: ['CARD_EXPIRED'], notices: [] }, patient: F.deskPatient({ card: F.card({ status: 'EXPIRED', expiry: '2026-01' }) })
    });

    it('shows « expires 01-2026 » and the inline expiry field; Save sends PUT …/health-card with the parsed month', () => {
      const { f, el, http } = setup(arrivedExpired());
      expect(el.textContent).toContain('expires 01-2026');
      const input = el.querySelector<HTMLInputElement>('.fd-expiry')!;
      input.value = '0327';
      input.dispatchEvent(new Event('input'));
      f.detectChanges();
      el.querySelector<HTMLButtonElement>('.fd-expiry-save')!.click();
      const req = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/patients/12/health-card'));
      expect(req.request.body).toEqual({ cardExpiry: '2027-03' });
    });

    it('an unreadable expiry is refused without a request', () => {
      const { f, el, http } = setup(arrivedExpired());
      const input = el.querySelector<HTMLInputElement>('.fd-expiry')!;
      input.value = '1103';
      input.dispatchEvent(new Event('input'));
      f.detectChanges();
      el.querySelector<HTMLButtonElement>('.fd-expiry-save')!.click();
      f.detectChanges();
      http.expectNone(() => true);
      expect(el.querySelector('.field-error')!.textContent).toContain('MM-YYYY');
    });

    it('offers the two card notes on an arrived row and sends PUT …/card-note', () => {
      const { el, http } = setup(arrivedExpired());
      el.querySelector<HTMLButtonElement>('.fd-note-none')!.click();
      const req = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/appointments/77/card-note'));
      expect(req.request.body).toEqual({ note: 'NO_CARD' });
    });

    it('shows « Complete the file » for a missing date of birth', () => {
      const { el } = setup(F.arrivalRow({ desk: { state: 'CHECK', reasons: ['DOB_MISSING'], notices: [] } }));
      expect(el.querySelector('.fd-complete')!.getAttribute('href')).toBe('/patients/12?edit=1');
    });
  });
});
