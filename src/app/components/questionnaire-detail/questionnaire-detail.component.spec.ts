import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { FULL_Q } from '../../testing/fixtures';
import { QuestionnaireDetailComponent } from './questionnaire-detail.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('QuestionnaireDetailComponent', () => {
  let fixture: ComponentFixture<QuestionnaireDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/questionnaires/2`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, RouterTestingModule],
      declarations: [QuestionnaireDetailComponent, QuestionnaireFormComponent, ...SHARED_DECLARATIONS],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '2' }) } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QuestionnaireDetailComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  function init() {
    fixture.detectChanges();
    http.expectOne(url).flush({
      id: 2, url: FULL_Q.url, version: '1', title: { fr: 'Suivi de test', en: 'Test check-in' }, purpose: 'FOLLOW_UP_CHECKIN',
      specialty: 'VISCERAL_SURGERY', appointmentTypes: [], status: 'ACTIVE', loadedAt: '2026-10-14T00:00:00Z',
      questionnaire: FULL_Q,
      rules: [
        { linkId: 'PAIN', operator: '>=', value: 7, outcome: { type: 'ALERT', severity: 'HIGH', message: { fr: 'Douleur', en: 'Severe pain' } } },
        { linkId: 'MOBILITY', operator: 'in', value: ['bedbound'], outcome: { type: 'ALERT', severity: 'MEDIUM', message: { fr: 'x', en: 'Bedbound' } } },
        { linkId: 'FEVER', operator: 'equals-true', outcome: { type: 'NEEDS_REVIEW', message: { fr: 'f', en: 'Fever' } } }
      ]
    });
    fixture.detectChanges();
  }

  it('renders metadata, an interactive preview with a note, and the rules table', () => {
    init();
    expect(el.querySelector('h1')!.textContent).toBe('Test check-in');
    expect(el.textContent).toContain('Preview — answers are not saved.');
    expect(el.querySelector('app-questionnaire-form .q-btn')).not.toBeNull();
    expect(el.querySelector('#submit')).toBeNull();
    const rows = Array.from(el.querySelectorAll('.rules tbody tr'))
      .map(r => Array.from(r.querySelectorAll('td')).map(td => td.textContent!.trim()).join(' | '));
    expect(rows.length).toBe(3);
    expect(rows[0]).toBe('PAIN | >= | 7 | ALERT | ▲High | Severe pain');
    expect(rows[1]).toBe('MOBILITY | in | bedbound | ALERT | ●Medium | Bedbound');
    expect(rows[2]).toBe('FEVER | equals-true | — | NEEDS_REVIEW | ◆Needs review | Fever');
  });

  it('toggles the preview language', () => {
    init();
    expect(el.querySelector('app-questionnaire-form')!.textContent).toContain('Do you have a fever?');
    (el.querySelector('#lang-fr') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-questionnaire-form')!.textContent).toContain('Avez-vous de la fièvre?');
    (el.querySelector('#lang-en') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-questionnaire-form')!.textContent).toContain('Do you have a fever?');
  });

  it('shows not found on 404', () => {
    fixture.detectChanges();
    http.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Form not found.');
  });
});
