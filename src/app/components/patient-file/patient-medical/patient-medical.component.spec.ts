import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { addDays, businessToday } from '../../../shared/link.util';
import { JANE, medical, staffMember, providePermissions } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { PatientMedicalComponent, REVEAL_MS } from './patient-medical.component';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';

describe('PatientMedicalComponent', () => {
  let fixture: ComponentFixture<PatientMedicalComponent>;
  let component: PatientMedicalComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const base = `${environment.apiUrl}/patients/5`;
  const MASKED = '•••• •••• ••12';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [providePermissions('NURSE')],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientMedicalComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientMedicalComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    component.patient = { ...JANE };
    component.medical = medical();
    // behave like the parent: take the emitted values back
    component.medicalChange.subscribe(m => { component.medical = m; });
    component.patientChange.subscribe(p => { component.patient = p; });
    fixture.detectChanges();
  });
  afterEach(() => {
    jasmine.clock().uninstall();
    http.verify();
  });

  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  /** ngModel connects its controls (and writes initial values / disabled) in a microtask: wait for it. */
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (sel: string, value: string, event = 'input') => {
    const input = q<HTMLInputElement>(sel);
    input.value = value;
    input.dispatchEvent(new Event(event));
    await settle();
  };
  const click = async (sel: string) => {
    q<HTMLElement>(sel).click();
    await settle();
  };

  describe('health card', () => {
    const withCard = (over: Parameters<typeof medical>[0] = {}) => {
      component.medical = medical({ cardExpiry: '2027-03', cardStatus: 'OK', cardSeenAt: '2026-10-14T13:00:00Z', ...over });
      fixture.detectChanges();
    };
    const chipText = () => q('.card-row app-status-chip').textContent!.replace(/\s+/g, ' ').trim();

    it('shows « expires 03-2027 », the chip with its glyph and the word, and « Card seen on … »', () => {
      withCard();
      const row = q('.card-row');
      expect(row.textContent).toContain('expires 03-2027');
      expect(chipText()).toContain('Card on file');
      expect(row.querySelector('.chip--good')).not.toBeNull();
      expect(row.textContent).toContain('Card seen on 14 Oct 2026');
      expect(q('.ramq-value').textContent).toBe(MASKED); // the mask is shown exactly as returned
    });

    for (const [status, tone, word] of [['EXPIRING', 'warning', 'Card expiring soon'], ['EXPIRED', 'critical', 'Card expired'], ['UNKNOWN', 'info', 'Card expiry unknown']] as const) {
      it(`${status} is a ${tone} chip with the word « ${word} »`, () => {
        withCard({ cardStatus: status });
        expect(q('.card-row').querySelector('.chip--' + tone)).withContext(status).not.toBeNull();
        expect(chipText()).toContain(word);
      });
    }

    it('says « no date » when the card has no expiry yet', () => {
      withCard({ cardExpiry: null, cardStatus: 'UNKNOWN', cardSeenAt: null });
      expect(q('.card-row').textContent).toContain('no date');
      expect(el.querySelector('.card-seen')).toBeNull();
    });

    it('shows no expiry text and the neutral « No card on file » chip when there is no number', () => {
      withCard({ healthNumberMasked: null, cardExpiry: null, cardStatus: 'NONE', cardSeenAt: null });
      expect(q('.card-row').querySelector('.chip--neutral')).not.toBeNull();
      expect(el.querySelector('.card-expiry')).toBeNull();
      expect(el.querySelector('.edit-card')).toBeNull();
    });

    it('stays out of an answer that has no card members and no number', () => {
      component.medical = medical({ healthNumberMasked: null });
      fixture.detectChanges();
      expect(el.querySelector('.card-row')).toBeNull();
    });

    it('reads an older answer without cardStatus as « expiry unknown » when a number is on file', () => {
      component.medical = medical({ cardStatus: undefined });
      fixture.detectChanges();
      // no card members at all: the row is shown from the mask, as « unknown »
      component.medical = medical({ cardStatus: undefined, cardExpiry: null });
      expect(component.cardStatus).toBe('UNKNOWN');
    });

    it('edits the expiry with PUT health-card {cardExpiry} and shows the answer', async () => {
      withCard({ cardStatus: 'EXPIRED', cardExpiry: '2025-03' });
      await click('.edit-card');
      expect(q<HTMLInputElement>('#card-expiry-input').value).toBe('03-2025');
      await type('#card-expiry-input', '03/27');
      await click('.save-card');
      const put = http.expectOne(`${base}/health-card`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ cardExpiry: '2027-03' });
      put.flush({ card: { onFile: true, expiry: '2027-03', status: 'OK', seenAt: '2026-10-14T13:00:00Z', expirySource: 'STAFF' }, warnings: [] });
      await settle();
      expect(el.querySelector('#card-expiry-input')).toBeNull();
      expect(q('.card-row').textContent).toContain('expires 03-2027');
      expect(chipText()).toContain('Card on file');
    });

    it('refuses an expiry it cannot read, with the year hint, and sends nothing', async () => {
      withCard();
      await click('.edit-card');
      await type('#card-expiry-input', '1103');
      await click('.save-card');
      http.expectNone(`${base}/health-card`);
      expect(q('#card-err').textContent).toContain('Check the year');
      expect(q('#card-expiry-input').getAttribute('aria-invalid')).toBe('true');
    });

    it('shows the error and keeps the form open when the save fails', async () => {
      withCard();
      await click('.edit-card');
      await type('#card-expiry-input', '03-2027');
      await click('.save-card');
      http.expectOne(`${base}/health-card`).flush({ status: 500, error: 'X', message: 'x', fieldErrors: {} }, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(q('#card-err').textContent).toContain('Server error');
      expect(q('#card-expiry-input')).not.toBeNull(); // the form stays open so the value is not lost
      expect(component.medical.cardExpiry).toBe('2027-03');
    });

    it('never puts the expiry in the page when the form is cancelled', async () => {
      withCard();
      await click('.edit-card');
      await type('#card-expiry-input', '09-2030');
      const cancel = Array.from(el.querySelectorAll<HTMLButtonElement>('.card-form button')).find(b => b.textContent!.includes('Cancel'))!;
      cancel.click();
      await settle();
      expect(q('.card-row').textContent).toContain('expires 03-2027');
      http.expectNone(`${base}/health-card`);
    });

    it('removing the number resets the card row to « no card », adding one makes it « expiry unknown »', async () => {
      withCard();
      await click('.remove-hn');
      await click('.confirm-inline__ok');
      http.expectOne(`${base}/health-number`).flush(null);
      await settle();
      expect(component.medical.cardStatus).toBe('NONE');
      expect(component.medical.cardExpiry).toBeNull();
      expect(component.medical.cardSeenAt).toBeNull();
      await click('.edit-hn');
      await type('#hn-input', 'TREM68541212');
      await click('.save-hn');
      http.expectOne(`${base}/health-number`).flush({ healthNumberMasked: MASKED });
      await settle();
      expect(component.medical.cardStatus).toBe('UNKNOWN');
      expect(chipText()).toContain('Card expiry unknown');
    });
  });

  describe('identity', () => {
    it('shows the masked health number, the date of birth and the age', async () => {
      expect(q('.ramq-value').textContent).toBe(MASKED);
      expect(el.querySelector('.ramq-value--open')).toBeNull();
      expect(q('.identity-card').textContent).toContain('20 May 1980');
      expect(q('.identity-card').textContent).toMatch(/\d+ y/);
    });

    it('says so when there is no health number, and offers Add', async () => {
      component.medical = medical({ healthNumberMasked: null });
      fixture.detectChanges();
      expect(q('.identity-card').textContent).toContain('None on file');
      expect(el.querySelector('.reveal-btn')).toBeNull();
      expect(q('.edit-hn').textContent).toContain('Add');
    });

    it('Reveal needs a reason of 3 to 200 characters, sends nothing before that', async () => {
      await click('.reveal-btn');
      expect(q<HTMLButtonElement>('.confirm-reveal').disabled).toBeTrue();
      await type('#reveal-reason', 'ab');
      expect(q<HTMLButtonElement>('.confirm-reveal').disabled).toBeTrue();
      q<HTMLElement>('.reveal-form').dispatchEvent(new Event('submit'));
      http.expectNone(`${base}/health-number/reveal`);
      await type('#reveal-reason', 'a'.repeat(201));
      expect(q<HTMLButtonElement>('.confirm-reveal').disabled).toBeTrue();
      await type('#reveal-reason', 'abc');
      expect(q<HTMLButtonElement>('.confirm-reveal').disabled).toBeFalse();
    });

    it('reveals the formatted number for 30 s, then reverts and drops it from the DOM', async () => {
      jasmine.clock().install();
      await click('.reveal-btn');
      await type('#reveal-reason', 'billing check');
      await click('.confirm-reveal');
      const r = http.expectOne(`${base}/health-number/reveal`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ reason: 'billing check' });
      r.flush({ healthNumber: 'TREM68541212', healthNumberMasked: MASKED, revealedAt: '2026-10-15T14:00:00Z' });
      fixture.detectChanges();
      expect(q('.ramq-value--open').textContent).toBe('TREM 6854 1212');
      expect(q('.ramq-visible').textContent).toContain('Visible for 30 s');
      expect(el.querySelector('.reveal-form')).toBeNull();

      jasmine.clock().tick(REVEAL_MS - 1);
      fixture.detectChanges();
      expect(el.textContent).toContain('TREM 6854 1212');
      jasmine.clock().tick(1);
      fixture.detectChanges();
      expect(el.textContent).not.toContain('TREM 6854 1212');
      expect(el.textContent).not.toContain('68541212');
      expect(component.revealed).toBeNull();
      expect(q('.ramq-value').textContent).toBe(MASKED);
    });

    describe('focus', () => {
      const tick = () => new Promise<void>(r => setTimeout(r));
      beforeEach(() => document.body.appendChild(el));
      afterEach(() => el.remove());

      it('after a successful reveal the Hide button has focus', async () => {
        await click('.reveal-btn');
        await type('#reveal-reason', 'billing check');
        await click('.confirm-reveal');
        http.expectOne(`${base}/health-number/reveal`).flush({ healthNumber: 'TREM68541212', healthNumberMasked: MASKED, revealedAt: 'x' });
        await settle();
        await tick();
        expect(document.activeElement).toBe(q('.hide-btn'));
      });

      it('cancelling the reveal puts focus back on the Reveal button', async () => {
        await click('.reveal-btn');
        await tick();
        expect(document.activeElement).toBe(q('#reveal-reason'));
        await click('.reveal-form .btn--secondary');
        await tick();
        expect(el.querySelector('.reveal-form')).toBeNull();
        expect(document.activeElement).toBe(q('.reveal-btn'));
      });

      it('pressing Hide puts focus back on the Reveal button', async () => {
        await click('.reveal-btn');
        await type('#reveal-reason', 'billing check');
        await click('.confirm-reveal');
        http.expectOne(`${base}/health-number/reveal`).flush({ healthNumber: 'TREM68541212', healthNumberMasked: MASKED, revealedAt: 'x' });
        await settle();
        await click('.hide-btn');
        await tick();
        expect(document.activeElement).toBe(q('.reveal-btn'));
      });
    });

    it('drops the revealed number when the tab is left', async () => {
      jasmine.clock().install();
      await click('.reveal-btn');
      await type('#reveal-reason', 'billing check');
      await click('.confirm-reveal');
      http.expectOne(`${base}/health-number/reveal`).flush({ healthNumber: 'TREM68541212', healthNumberMasked: MASKED, revealedAt: 'x' });
      fixture.detectChanges();
      expect(el.textContent).toContain('TREM 6854 1212');
      component.active = false;
      component.ngOnChanges({ active: new SimpleChange(true, false, false) });
      fixture.detectChanges();
      expect(el.textContent).not.toContain('TREM 6854 1212');
      jasmine.clock().tick(REVEAL_MS); // the timer was cleared: nothing happens
      expect(component.revealed).toBeNull();
    });

    it('clears the revealed number when the component is destroyed and never stores it', async () => {
      jasmine.clock().install();
      const setItem = spyOn(Storage.prototype, 'setItem').and.callThrough();
      const log = spyOn(console, 'log');
      await click('.reveal-btn');
      await type('#reveal-reason', 'billing check');
      await click('.confirm-reveal');
      http.expectOne(`${base}/health-number/reveal`).flush({ healthNumber: 'TREM68541212', healthNumberMasked: MASKED, revealedAt: 'x' });
      fixture.detectChanges();
      fixture.destroy();
      expect(component.revealed).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(document.title).not.toContain('68541212');
    });

    it('a failed reveal says so and shows nothing', async () => {
      await click('.reveal-btn');
      await type('#reveal-reason', 'billing check');
      await click('.confirm-reveal');
      http.expectOne(`${base}/health-number/reveal`).flush({ status: 404, error: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(q('.reveal-form .field-error').textContent).toContain('Not found. It may have been deleted.');
      expect(component.revealed).toBeNull();
    });

    it('validates the number inline without sending a request', async () => {
      await click('.edit-hn');
      const input = q<HTMLInputElement>('#hn-input');
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect(input.getAttribute('inputmode')).toBe('text');
      expect(input.getAttribute('maxlength')).toBe('14');
      await type('#hn-input', 'ABC');
      expect(q('#hn-err').textContent).toBe('Must be 4 letters and 8 digits (e.g. TREM 6854 1212)');
      expect(q<HTMLButtonElement>('.save-hn').disabled).toBeTrue();
      q<HTMLElement>('.hn-form').dispatchEvent(new Event('submit'));
      http.expectNone(`${base}/health-number`);
    });

    it('saves a valid number with PUT and shows the new masked value', async () => {
      await click('.edit-hn');
      await type('#hn-input', 'tabc 0101 0101');
      expect(el.querySelector('#hn-err')).toBeNull();
      await click('.save-hn');
      const r = http.expectOne(`${base}/health-number`);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body).toEqual({ healthNumber: 'tabc 0101 0101' });
      r.flush({ healthNumberMasked: 'TABC •••• ••01' });
      fixture.detectChanges();
      expect(q('.ramq-value').textContent).toBe('TABC •••• ••01');
      expect(el.querySelector('.hn-form')).toBeNull();
    });

    it('shows the server error for the number', async () => {
      await click('.edit-hn');
      await type('#hn-input', 'TREM 6854 1212');
      await click('.save-hn');
      http.expectOne(`${base}/health-number`).flush(
        { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { healthNumber: 'must be a valid RAMQ number (4 letters, 8 digits)' } },
        { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(q('.hn-form .field-error[role=alert]').textContent).toContain('Must be a valid health number (4 letters, 8 digits).');
    });

    it('removes the number after a confirmation', async () => {
      await click('.remove-hn');
      expect(el.querySelector('app-confirm-inline')).not.toBeNull();
      await click('.confirm-inline__ok');
      const r = http.expectOne(`${base}/health-number`);
      expect(r.request.method).toBe('DELETE');
      r.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(q('.identity-card').textContent).toContain('None on file');
    });

    it('edits the date of birth with a PUT of the full patient plus the new date', async () => {
      await click('.edit-dob');
      const input = q<HTMLInputElement>('#dob-input');
      expect(input.max).toBe(addDays(businessToday(), -1));
      await type('#dob-input', '1975-03-02');
      q<HTMLFormElement>('.inline-form').dispatchEvent(new Event('submit'));
      const r = http.expectOne(base);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body).toEqual({ ...JANE, dateOfBirth: '1975-03-02' });
      r.flush({ ...JANE, dateOfBirth: '1975-03-02' });
      fixture.detectChanges();
      expect(q('.identity-card').textContent).toContain('2 Mar 1975');
      expect(component.patient.dateOfBirth).toBe('1975-03-02');
    });
  });

  describe('lists', () => {
    it('renders the four lists with their rows', async () => {
      const lists = Array.from(el.querySelectorAll('.med-list')).map(l => l.getAttribute('data-list'));
      expect(lists).toEqual(['allergies', 'medications', 'procedures', 'diagnoses']);
      const allergy = q('[data-list=allergies] .row');
      expect(allergy.querySelector('.row__name')!.textContent).toBe('Penicillin');
      expect(allergy.querySelector('.row__sub')!.textContent).toBe('Anaphylaxis');
      expect(allergy.querySelector('.chip--critical .chip__glyph')!.textContent).toBe('▲');
      expect(allergy.querySelector('.chip--critical .chip__label')!.textContent).toBe('Severe');
      expect(q('[data-list=medications] .row__sub').textContent).toContain('500 mg · q6h');
      expect(q('[data-list=medications] .row__sub').textContent).toContain('since 1 Oct 2026');
      expect(q('[data-list=procedures] .appt__date').textContent).toContain('Sat 10 Oct 2026');
      expect(q('[data-list=procedures] .row__sub').textContent).toBe('Surgeon: Dr. Roy');
      expect(q('[data-list=diagnoses] .row__sub .mono').textContent).toBe('K35.80');
    });

    it('shows the empty states', async () => {
      component.medical = medical({ allergies: [], medications: [], procedures: [], diagnoses: [] });
      fixture.detectChanges();
      expect(q('[data-list=allergies]').textContent).toContain('No known allergies recorded.');
      expect(el.querySelectorAll('.med-list .row').length).toBe(0);
    });

    it('adds an allergy: POST, then the row appears and the form closes', async () => {
      await click('[data-list=allergies] .add-item');
      expect(q<HTMLButtonElement>('[data-list=allergies] .save-item').disabled).toBeTrue();
      await type('#mf-allergies-substance', 'Latex');
      await type('#mf-allergies-severity', 'MILD', 'change');
      await type('#mf-allergies-reaction', 'Rash');
      await click('[data-list=allergies] .save-item');
      const r = http.expectOne(`${base}/allergies`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ substance: 'Latex', severity: 'MILD', reaction: 'Rash' });
      r.flush({ id: 11, substance: 'Latex', severity: 'MILD', reaction: 'Rash', createdAt: 'x', createdByName: null, updatedAt: 'x', updatedByName: null }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      expect(el.querySelectorAll('[data-list=allergies] .row').length).toBe(2);
      expect(q('[data-list=allergies]').textContent).toContain('Latex');
      expect(el.querySelector('[data-list=allergies] .med-form')).toBeNull();
    });

    it('sends an empty optional field as null', async () => {
      await click('[data-list=allergies] .add-item');
      await type('#mf-allergies-substance', '  Latex  ');
      await click('[data-list=allergies] .save-item');
      const r = http.expectOne(`${base}/allergies`);
      expect(r.request.body).toEqual({ substance: 'Latex', severity: 'UNKNOWN', reaction: null });
      r.flush({}, { status: 500, statusText: 'x' });
    });

    it('shows a server fieldError under its input', async () => {
      await click('[data-list=allergies] .add-item');
      await type('#mf-allergies-substance', 'x');
      await click('[data-list=allergies] .save-item');
      http.expectOne(`${base}/allergies`).flush(
        { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { substance: 'size must be between 1 and 200' } }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      const group = q('#mf-allergies-substance').parentElement!;
      expect(group.querySelector('.field-error')!.textContent).toBe('200 characters at most.');
      expect(el.querySelector('[data-list=allergies] .med-form')).not.toBeNull(); // the form stays open
    });

    it('edits an item through its menu with PUT', async () => {
      await click('[data-list=allergies] .row app-row-menu .more-btn');
      await click('[data-list=allergies] .row-menu__item[data-key=edit]');
      expect(q<HTMLInputElement>('#mf-allergies-substance').value).toBe('Penicillin');
      await type('#mf-allergies-reaction', 'Hives');
      await click('[data-list=allergies] .save-item');
      const r = http.expectOne(`${base}/allergies/1`);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body.reaction).toBe('Hives');
      r.flush({ ...medical().allergies[0], reaction: 'Hives' });
      fixture.detectChanges();
      expect(q('[data-list=allergies] .row__sub').textContent).toBe('Hives');
    });

    it('removes an item after a confirmation: DELETE, then the row is gone', async () => {
      await click('[data-list=medications] .row app-row-menu .more-btn');
      await click('[data-list=medications] .row-menu__item[data-key=remove]');
      expect(q('[data-list=medications] app-confirm-inline').textContent).toContain('Remove Acetaminophen?');
      await click('[data-list=medications] .confirm-inline__ok');
      const r = http.expectOne(`${base}/medications/2`);
      expect(r.request.method).toBe('DELETE');
      r.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(el.querySelectorAll('[data-list=medications] .row').length).toBe(0);
    });

    it('a procedure offers active surgeons and physicians, then "Other" with a free-text name', async () => {
      await click('[data-list=procedures] .add-item');
      http.expectOne(x => x.url === `${environment.apiUrl}/staff`).flush([
        staffMember({ id: 1, displayName: 'Dr. Active', role: 'SURGEON' }),
        staffMember({ id: 2, displayName: 'Dr. Gone', role: 'SURGEON', active: false }),
        staffMember({ id: 3, displayName: 'Nurse Joy', role: 'NURSE' }),
        staffMember({ id: 4, displayName: 'Dr. Phys', role: 'PHYSICIAN' })
      ]);
      fixture.detectChanges();
      const options = Array.from(el.querySelectorAll<HTMLOptionElement>('#mf-procedures-surgeon option')).map(o => o.textContent!.trim());
      expect(options).toEqual(['Not recorded', 'Dr. Active', 'Dr. Phys', 'Other (type name)']);
      expect(el.querySelector('input[name=surgeonName]')).toBeNull();
      await type('#mf-procedures-surgeon', 'other', 'change');
      expect(el.querySelector('input[name=surgeonName]')).not.toBeNull();
      await type('input[name=surgeonName]', 'Dr. Visiting');
      await type('#mf-procedures-name', 'Hernia repair');
      await type('#mf-procedures-performedOn', '2026-10-12');
      await click('[data-list=procedures] .save-item');
      const r = http.expectOne(`${base}/procedures`);
      expect(r.request.body).toEqual({ name: 'Hernia repair', performedOn: '2026-10-12', surgeonStaffId: null, surgeonName: 'Dr. Visiting' });
      r.flush({}, { status: 500, statusText: 'x' });
    });

    it('a selected staff surgeon is sent by id with no free-text name', async () => {
      await click('[data-list=procedures] .add-item');
      http.expectOne(x => x.url === `${environment.apiUrl}/staff`).flush([staffMember({ id: 4, displayName: 'Dr. Phys', role: 'PHYSICIAN' })]);
      fixture.detectChanges();
      await type('#mf-procedures-surgeon', '4', 'change');
      await type('#mf-procedures-name', 'Hernia repair');
      await type('#mf-procedures-performedOn', '2026-10-12');
      await click('[data-list=procedures] .save-item');
      const r = http.expectOne(`${base}/procedures`);
      expect(r.request.body).toEqual({ name: 'Hernia repair', performedOn: '2026-10-12', surgeonStaffId: 4, surgeonName: null });
      r.flush({}, { status: 500, statusText: 'x' });
    });

    it('shows the STAFF_INACTIVE message as a banner in the form', async () => {
      await click('[data-list=procedures] .add-item');
      http.expectOne(x => x.url === `${environment.apiUrl}/staff`).flush([]);
      await type('#mf-procedures-name', 'Hernia repair');
      await type('#mf-procedures-performedOn', '2026-10-12');
      await click('[data-list=procedures] .save-item');
      http.expectOne(`${base}/procedures`).flush({ status: 409, error: 'STAFF_INACTIVE', message: 'Staff member is inactive', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(q('[data-list=procedures] .med-form .banner--error').textContent).toContain('This staff member is inactive.');
    });
  });
});
