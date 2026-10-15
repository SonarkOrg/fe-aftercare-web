import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { QuestionnairesComponent } from './questionnaires.component';

describe('QuestionnairesComponent', () => {
  let fixture: ComponentFixture<QuestionnairesComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [QuestionnairesComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QuestionnairesComponent);
  });

  afterEach(() => http.verify());

  it('lists the forms with EN title, purpose, scope, version, status and url, linking to the detail page', () => {
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/questionnaires`).flush([
      { id: 1, url: 'https://aftercare.example/fhir/Questionnaire/followup-visceral-surgery', version: '1',
        title: { fr: 'Suivi', en: 'Daily check-in — visceral surgery' }, purpose: 'FOLLOW_UP_CHECKIN',
        specialty: 'VISCERAL_SURGERY', appointmentTypes: [], status: 'ACTIVE', loadedAt: '2026-10-14T00:00:00Z' },
      { id: 3, url: 'https://aftercare.example/fhir/Questionnaire/pre-surgery', version: '1',
        title: { fr: 'Pré', en: 'Pre-surgery questionnaire' }, purpose: 'PRE_APPOINTMENT',
        specialty: null, appointmentTypes: ['SURGERY'], status: 'RETIRED', loadedAt: '2026-10-14T00:00:00Z' }
    ]);
    fixture.detectChanges();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Daily check-in — visceral surgery');
    expect(rows[0].textContent).toContain('Follow up checkin');
    expect(rows[0].textContent).toContain('Visceral surgery');
    expect(rows[0].textContent).toContain('ACTIVE');
    expect(rows[0].textContent).toContain('followup-visceral-surgery');
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('/questionnaires/1');
    expect(rows[1].textContent).toContain('Surgery');
    expect(rows[1].textContent).toContain('RETIRED');
  });

  it('shows an error when loading fails', () => {
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/questionnaires`).flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Could not load forms.');
  });
});
