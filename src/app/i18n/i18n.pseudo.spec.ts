import { ComponentFixture } from '@angular/core/testing';
import { AlertRulesComponent } from '../components/settings/alert-rules/alert-rules.component';
import { AccessLogComponent } from '../components/settings/access-log/access-log.component';
import { NotificationSettingsComponent } from '../components/settings/notification-settings/notification-settings.component';
import { RetentionSettingsComponent } from '../components/settings/retention-settings/retention-settings.component';
import { StaffDirectoryComponent } from '../components/settings/staff-directory/staff-directory.component';
import { SettingsComponent } from '../components/settings/settings.component';
import { AlertsComponent } from '../components/alerts/alerts.component';
import { AppointmentDetailComponent } from '../components/appointment-detail/appointment-detail.component';
import { AppointmentFormComponent } from '../components/appointment-form/appointment-form.component';
import { AppointmentsComponent } from '../components/appointments/appointments.component';
import { DashboardComponent } from '../components/dashboard/dashboard.component';
import { HomeComponent } from '../components/home/home.component';
import { MessagesComponent } from '../components/messages/messages.component';
import { PatientAuditComponent } from '../components/patient-file/patient-audit/patient-audit.component';
import { PatientContactsComponent } from '../components/patient-file/patient-contacts/patient-contacts.component';
import { PatientDocumentsComponent } from '../components/patient-file/patient-documents/patient-documents.component';
import { PatientMedicalComponent } from '../components/patient-file/patient-medical/patient-medical.component';
import { PatientNotificationsComponent } from '../components/patient-file/patient-notifications/patient-notifications.component';
import { PatientTimelineComponent } from '../components/patient-file/patient-timeline/patient-timeline.component';
import { PatientDetailComponent } from '../components/patient-detail/patient-detail.component';
import { PatientsComponent } from '../components/patients/patients.component';
import { QuestionnaireDetailComponent } from '../components/questionnaire-detail/questionnaire-detail.component';
import { QuestionnairesComponent } from '../components/questionnaires/questionnaires.component';
import { ReportsComponent } from '../components/reports/reports.component';
import { FooterComponent } from '../shared/footer/footer.component';
import { ForbiddenComponent } from '../shared/forbidden/forbidden.component';
import { LoginComponent } from '../shared/login/login.component';
import { NotStaffComponent } from '../shared/not-staff/not-staff.component';
import { WeekBarsComponent } from '../shared/week-bars/week-bars.component';
import { ShellComponent } from '../shell/shell.component';
import * as F from '../testing/fixtures';
import { AUDIT, DEF, INTAKE_RESPONSE, PageHarness } from '../testing/page-harness';

/**
 * Runtime counterpart of `npm run i18n:check`: every page is rendered in the pseudo-locale (every dictionary value
 * becomes ⟦…⟧), so any letters left outside the brackets are text that does not come from a dictionary.
 */

/** Every string value found in the objects the page was given: they are data, not interface text. */
function dataStrings(): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      out.add(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  [F.JANE, F.alertDto(), F.missedAlert(), F.appointment(), F.checkInDto({ pain: 8, temp: 38.4 }), F.followUp(), F.CLINIC, F.medical(), F.staffMember(), F.careTeamMember(), F.contact(),
    F.careNote(), F.timelineItem(), F.message(), F.conversation(), F.report(), F.notification(), F.contactPrefs(), F.notificationSettings(), F.retentionSettings(), F.retentionRun(),
    F.FULL_Q, F.SEED_RULES, DEF, AUDIT, INTAKE_RESPONSE, F.me('ADMIN'), 'Luc', 'Roy', 'Dev Admin', 'Admin Test', 'Résumé', 'Do you have a fever?', 'Avez-vous de la fièvre?', 'Recent fever', 'Fièvre récente'].forEach(walk);
  // a few values are built by components from fixture data
  ['Jane Doe', 'Marie Nurse'].forEach(s => out.add(s));
  return out;
}

// brand names and codes, English date words (dates use the en-CA locale in pseudo mode), units, and the questionnaire form's own words
const BRAND = new RegExp('\\b(' + [
  'Aftercare', 'RAMQ', 'NAM', 'SMS', 'PDF', 'JPEG', 'PNG', 'SMTP', 'Twilio', 'Auth0', 'LOG', 'CIM', 'ICD', 'URL', 'TREM', 'Dev', 'min',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
  'Oui', 'Non', 'facultatif', 'Yes', 'No', 'optional'
].join('|') + ')\\b', 'g');

function leftovers(root: HTMLElement, data: Set<string>): string[] {
  const texts: { text: string; node: Node }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.textContent ?? '').trim()) {
      texts.push({ text: n.textContent!, node: n });
    }
  }
  root.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach(e => {
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = e.getAttribute(a);
      if (v) {
        texts.push({ text: v, node: e });
      }
    }
  });
  const sorted = [...data].filter(s => s.length > 1).sort((a, b) => b.length - a.length);
  const bad: string[] = [];
  for (const { text, node } of texts) {
    const el = node instanceof Element ? node : node.parentElement;
    if (el?.closest('[lang]:not(html)')) {
      continue; // an explicit language fallback or a language name
    }
    let t = text;
    for (let i = 0; i < 4; i++) {
      t = t.replace(/⟦[^⟦⟧]*⟧/g, ' ');
    }
    t = t.replace(/^[^⟦⟧]*⟧/, ' ').replace(/⟦[^⟦⟧]*$/, ' '); // a label split over two elements (a ring tile)
    for (const s of sorted) {
      t = t.split(s).join(' ');
    }
    t = t.replace(BRAND, ' ');
    const m = t.match(/[A-Za-z]{3,}/g);
    if (m) {
      bad.push(`"${m.join(' ')}" in "${text.trim().slice(0, 90)}" <${el?.tagName.toLowerCase()} class="${(el as HTMLElement | null)?.className ?? ''}">`);
    }
  }
  return bad;
}

describe('pseudo-locale: no text outside the dictionaries', () => {
  const h = new PageHarness();
  const settle = (fixture: ComponentFixture<unknown>) => h.settle(fixture);

  const create = <T>(type: import('@angular/core').Type<T>, declarations: import('@angular/core').Type<unknown>[] = [], standalone = false, route: Record<string, string> = {}) => h.create('pseudo', type, declarations, standalone, route);

  const check = async (fixture: ComponentFixture<unknown>, what: string) => {
    await settle(fixture);
    const bad = leftovers(fixture.nativeElement, dataStrings());
    expect(bad).withContext(what).toEqual([]);
  };

  const PAGES: [string, () => ComponentFixture<unknown>][] = [
    ['login', () => create(LoginComponent)],
    ['not-staff', () => create(NotStaffComponent, [], true)],
    ['forbidden', () => create(ForbiddenComponent, [], true)],
    ['home', () => create(HomeComponent, [FooterComponent])],
    ['shell', () => create(ShellComponent)],
    ['dashboard', () => create(DashboardComponent)],
    ['patients', () => create(PatientsComponent)],
    ['alerts', () => create(AlertsComponent)],
    ['appointments (day)', () => create(AppointmentsComponent)],
    ['appointment form', () => create(AppointmentFormComponent)],
    ['appointment detail (with intake)', () => create(AppointmentDetailComponent, [], false, { id: '4' })],
    ['questionnaires', () => create(QuestionnairesComponent)],
    ['questionnaire detail', () => create(QuestionnaireDetailComponent, [], false, { id: '7' })],
    ['messages', () => create(MessagesComponent, [], false, { patientId: '5' })],
    ['reports', () => create(ReportsComponent, [WeekBarsComponent])]
  ];

  for (const [name, make] of PAGES) {
    it(name, async () => {
      const fixture = make();
      await check(fixture, name);
    });
  }

  it('appointments (week)', async () => {
    const fixture = create(AppointmentsComponent);
    await settle(fixture);
    (fixture.componentInstance as AppointmentsComponent).setView('week');
    await check(fixture, 'week');
  });

  it('settings, every tab', async () => {
    const fixture = create(SettingsComponent, [StaffDirectoryComponent, AlertRulesComponent, NotificationSettingsComponent, RetentionSettingsComponent, AccessLogComponent]);
    for (const tab of ['clinic', 'staff', 'notifications', 'rules', 'retention', 'access'] as const) {
      (fixture.componentInstance as SettingsComponent).tab = tab;
      await check(fixture, 'settings ' + tab);
    }
  });

  it('patient file, every tab', async () => {
    const fixture = create(PatientDetailComponent, [PatientMedicalComponent, PatientContactsComponent, PatientTimelineComponent, PatientDocumentsComponent, PatientAuditComponent, PatientNotificationsComponent], false, { id: '5' });
    await settle(fixture);
    const c = fixture.componentInstance as PatientDetailComponent;
    for (const tab of ['overview', 'medical', 'contacts', 'timeline', 'documents', 'messages', 'checkins', 'alerts', 'appointments', 'audit'] as const) {
      c.visited.add(tab);
      c.tab = tab;
      await check(fixture, 'patient file ' + tab);
    }
  });
});
