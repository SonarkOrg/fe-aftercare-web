import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppointmentStatus } from '../../models/appointment.model';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { AppointmentBadgeComponent } from './appointment-badge.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('AppointmentBadgeComponent', () => {
  let fixture: ComponentFixture<AppointmentBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang()], declarations: [AppointmentBadgeComponent, StatusChipComponent] }).compileComponents();
    fixture = TestBed.createComponent(AppointmentBadgeComponent);
  });

  const rows: [AppointmentStatus, boolean, string, string][] = [
    ['CANCELLED', false, 'Cancelled', 'chip--neutral'],
    ['COMPLETED', false, 'Completed', 'chip--neutral'],
    ['NO_SHOW', false, 'No-show', 'chip--neutral'],
    ['NEEDS_REVIEW', false, 'Needs review', 'chip--serious'],
    ['READY', false, 'Ready', 'chip--good'],
    ['SCHEDULED', true, 'Questionnaire missing', 'chip--warning'],
    ['SCHEDULED', false, 'Awaiting questionnaire', 'chip--info']
  ];

  for (const [status, missing, label, cls] of rows) {
    it(`${status}${missing ? ' + missing' : ''} -> ${label}`, () => {
      fixture.componentRef.setInput('appointment', { status, questionnaireMissing: missing });
      fixture.detectChanges();
      const chip = fixture.nativeElement.querySelector('.chip') as HTMLElement;
      expect(chip.querySelector('.chip__label')!.textContent).toBe(label);
      expect(chip.classList).toContain(cls);
    });
  }

  it('questionnaireMissing does not override a later status', () => {
    fixture.componentRef.setInput('appointment', { status: 'CANCELLED', questionnaireMissing: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chip__label').textContent).toBe('Cancelled');
  });

  it('adds a second "Here" chip (glyph and word) when the patient has arrived, and none otherwise', () => {
    fixture.componentRef.setInput('appointment', { status: 'READY', questionnaireMissing: false, arrivedAt: '2026-10-14T13:52:03Z' });
    fixture.detectChanges();
    const chips = Array.from(fixture.nativeElement.querySelectorAll('.chip')) as HTMLElement[];
    expect(chips.map(c => c.querySelector('.chip__label')!.textContent)).toEqual(['Ready', 'Here']);
    expect(chips[1].classList).toContain('chip--good');
    expect(chips[1].querySelector('.chip__glyph')!.textContent!.trim()).toBe('✓');

    fixture.componentRef.setInput('appointment', { status: 'READY', questionnaireMissing: false, arrivedAt: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chip').length).toBe(1);
  });

  it('keeps the status chip unchanged when arrivedAt is absent from the input', () => {
    fixture.componentRef.setInput('appointment', { status: 'SCHEDULED', questionnaireMissing: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chip').length).toBe(1);
  });
});
