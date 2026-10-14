import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppointmentStatus } from '../../models/appointment.model';
import { AppointmentBadgeComponent } from './appointment-badge.component';

describe('AppointmentBadgeComponent', () => {
  let fixture: ComponentFixture<AppointmentBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [AppointmentBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(AppointmentBadgeComponent);
  });

  const rows: [AppointmentStatus, boolean, string, string][] = [
    ['CANCELLED', false, 'Cancelled', 'badge-muted'],
    ['COMPLETED', false, 'Completed', 'badge-muted'],
    ['NO_SHOW', false, 'No-show', 'badge-muted'],
    ['NEEDS_REVIEW', false, 'Needs review', 'badge-warn'],
    ['READY', false, 'Ready', 'badge-ok'],
    ['SCHEDULED', true, 'Questionnaire missing', 'badge-alert'],
    ['SCHEDULED', false, 'Awaiting questionnaire', 'badge-info']
  ];

  for (const [status, missing, label, cls] of rows) {
    it(`${status}${missing ? ' + missing' : ''} -> ${label}`, () => {
      fixture.componentRef.setInput('appointment', { status, questionnaireMissing: missing });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
      expect(badge.textContent).toBe(label);
      expect(badge.classList).toContain(cls);
    });
  }

  it('questionnaireMissing does not override a later status', () => {
    fixture.componentRef.setInput('appointment', { status: 'CANCELLED', questionnaireMissing: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.badge').textContent).toBe('Cancelled');
  });
});
