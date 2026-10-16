import { ComponentFixture } from '@angular/core/testing';
import { AlertsComponent } from '../components/alerts/alerts.component';
import { AppointmentDetailComponent } from '../components/appointment-detail/appointment-detail.component';
import { AppointmentsComponent } from '../components/appointments/appointments.component';
import { DashboardComponent } from '../components/dashboard/dashboard.component';
import { PatientDetailComponent } from '../components/patient-detail/patient-detail.component';
import { PatientAuditComponent } from '../components/patient-file/patient-audit/patient-audit.component';
import { PatientContactsComponent } from '../components/patient-file/patient-contacts/patient-contacts.component';
import { PatientDocumentsComponent } from '../components/patient-file/patient-documents/patient-documents.component';
import { PatientMedicalComponent } from '../components/patient-file/patient-medical/patient-medical.component';
import { PatientNotificationsComponent } from '../components/patient-file/patient-notifications/patient-notifications.component';
import { PatientTimelineComponent } from '../components/patient-file/patient-timeline/patient-timeline.component';
import { QuestionnairesComponent } from '../components/questionnaires/questionnaires.component';
import { AccessLogComponent } from '../components/settings/access-log/access-log.component';
import { AlertRulesComponent } from '../components/settings/alert-rules/alert-rules.component';
import { NotificationSettingsComponent } from '../components/settings/notification-settings/notification-settings.component';
import { RetentionSettingsComponent } from '../components/settings/retention-settings/retention-settings.component';
import { StaffDirectoryComponent } from '../components/settings/staff-directory/staff-directory.component';
import { ReportsComponent } from '../components/reports/reports.component';
import { ForbiddenComponent } from '../shared/forbidden/forbidden.component';
import { NotStaffComponent } from '../shared/not-staff/not-staff.component';
import { WeekBarsComponent } from '../shared/week-bars/week-bars.component';
import { ShellComponent } from '../shell/shell.component';
import { environment } from '../../environments/environment';
import * as F from '../testing/fixtures';
import { PageHarness } from '../testing/page-harness';

const NB = ' ';

describe('French staff UI (fr-CA)', () => {
  const h = new PageHarness();
  const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';
  const settle = (f: ComponentFixture<unknown>, override?: (url: string) => unknown) => h.settle(f, override);
  const api = environment.apiUrl;
  const only = (re: RegExp, data: unknown) => (url: string) => (re.test(url.replace(api, '').split('?')[0]) ? data : undefined);

  describe('shell, not-staff and forbidden', () => {
    it('shell: French navigation, settings and bell labels, and the language switch', async () => {
      const f = h.create('fr', ShellComponent);
      await settle(f, only(/^\/alerts\/count$|^\/alerts$/, [F.alertDto(), F.alertDto({ id: 2 }), F.alertDto({ id: 3 })]));
      const links = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.top-nav__item')).map(a => a.querySelector('span')!.textContent!.trim());
      expect(links).toEqual(['Tableau de bord', 'Patients', 'Rendez-vous', 'Alertes', 'Messages', 'Rapports', 'Formulaires']);
      expect((f.nativeElement as HTMLElement).querySelector('.settings-btn')!.getAttribute('aria-label')).toBe('Paramètres');
      (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.menu-btn')!.click();
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('app-language-switch')).not.toBeNull();
      expect((f.nativeElement as HTMLElement).querySelector('.logout')!.textContent).toContain('Se déconnecter');
    });

    it('not-staff and forbidden pages', async () => {
      let f: ComponentFixture<unknown> = h.create('fr', NotStaffComponent, [], true);
      await settle(f);
      expect(text(f)).toContain('Votre connexion n\'est liée à aucun compte du personnel');
      expect(text(f)).toContain(`Paramètres → Personnel et de lier cette connexion${NB}:`);
    });

    it('forbidden names the role in French', async () => {
      const f = h.create('fr', ForbiddenComponent, [], true);
      await settle(f);
      expect(text(f)).toContain('Votre rôle (Administration) ne donne pas accès à cette page.');
      expect(text(f)).toContain('Retour au tableau de bord');
    });
  });

  describe('dashboard', () => {
    it('the hero date and a temperature in French', async () => {
      // A fixed clock (read when the component is created), so the expected text is a literal and not the code under test.
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date('2026-10-15T16:00:00Z'));
      const f = h.create('fr', DashboardComponent);
      f.detectChanges();
      jasmine.clock().uninstall();
      const temp = F.alertDto({ linkId: 'TEMPERATURE', answerValue: '38.4', questionLabel: 'Temperature?', questionLabelFr: 'Température?' });
      await settle(f, only(/^\/alerts$/, [temp]));
      expect((f.nativeElement as HTMLElement).querySelector('.hero__date')!.textContent).toBe('jeudi 15 octobre 2026');
      expect(text(f)).toContain(`Temp. 38,4${NB}°C`);
      expect(text(f)).toContain('À surveiller');
    });
  });

  describe('alerts', () => {
    const alerts = [
      F.alertDto({ id: 1, linkId: 'TEMPERATURE', answerValue: '38.4', questionLabel: 'Temperature?', questionLabelFr: 'Température?' }),
      F.alertDto({ id: 2, answerValue: 'true', questionLabelFr: 'Fièvre?' }),
      F.alertDto({ id: 3, answerValue: 'false', questionLabelFr: null }),
      F.missedAlert()
    ];

    it('the filter pills, the French message and question, the localised answers', async () => {
      const f = h.create('fr', AlertsComponent, [(await import('../components/alert-table/alert-table.component')).AlertTableComponent]);
      await settle(f, only(/^\/alerts$/, alerts));
      const t = text(f);
      expect(t).toContain('Tous');
      expect(t).toContain('Réponses');
      expect(t).toContain('Suivis quotidiens manqués');
      expect(t).toContain('Suivi quotidien manqué');
      expect(t).toContain('Douleur sévère signalée (8/10)');
      expect(t).toContain('Température?');
      expect(t).toContain(`Réponse 38,4`);
      expect(t).toContain('Réponse Oui');
      expect(t).toContain('Réponse Non');
      const english = (f.nativeElement as HTMLElement).querySelector('[lang=en]');
      expect(english!.textContent).toBe('Pain level?'); // questionLabelFr is null: the English label is marked
    });
  });

  describe('appointments', () => {
    it('the week range in French', async () => {
      const f = h.create('fr', AppointmentsComponent);
      await settle(f);
      (f.componentInstance as AppointmentsComponent).date = '2026-10-14';
      (f.componentInstance as AppointmentsComponent).setView('week');
      await settle(f);
      expect(text(f)).toContain('12 oct. – 18 oct. 2026');
      expect(text(f)).toContain('Cette semaine');
    });
  });

  describe('appointment detail', () => {
    it('flag label and message in French, the form in French, and the submission time', async () => {
      const f = h.create('fr', AppointmentDetailComponent, [(await import('../fhir/questionnaire-form/questionnaire-form.component')).QuestionnaireFormComponent], false, { id: '4' });
      await settle(f);
      const t = text(f);
      expect(t).toContain('Avez-vous de la fièvre? — Fièvre récente');
      expect(t).toContain('Reçu le 2026-10-12');
      expect((f.nativeElement as HTMLElement).querySelector('.q-readonly')!.textContent).toContain('Oui');
    });

    it('answers are redacted for reception, in French', async () => {
      const f = h.create('fr', AppointmentDetailComponent, [], false, { id: '4' }, 'RECEPTION');
      await settle(f, only(/^\/appointments\/\d+$/, F.appointmentDetail({ intakeRedacted: true, intakeSubmittedAt: '2026-10-12T15:00:00Z', flagCount: 2 })));
      expect(text(f)).toContain('Les réponses au questionnaire sont visibles par le personnel clinique seulement.');
      expect(text(f)).toContain('2 signalements à examiner');
    });
  });

  describe('patient file', () => {
    const all = [PatientMedicalComponent, PatientContactsComponent, PatientTimelineComponent, PatientDocumentsComponent, PatientAuditComponent, PatientNotificationsComponent];

    it('tab names, care notes, documents, timeline summaries and notifications', async () => {
      const f = h.create('fr', PatientDetailComponent, all, false, { id: '5' });
      await settle(f, only(/^\/patients\/\d+\/timeline$/, { items: [F.timelineItem(), F.timelineItem({ id: 2, summaryFr: null, summary: 'Old English row' })], page: 0, size: 30, hasMore: false }));
      const c = f.componentInstance as PatientDetailComponent;
      const tabs = Array.from((f.nativeElement as HTMLElement).querySelectorAll('[role=tab]')).map(b => b.textContent!.replace(/\d+$/, '').trim());
      expect(tabs).toContain('Sommaire');
      expect(tabs).toContain('Chronologie');
      expect(tabs).toContain('Coordonnées');
      expect(tabs).toContain('Journal des accès');
      for (const tab of ['timeline', 'documents', 'contacts'] as const) {
        c.visited.add(tab);
        c.tab = tab;
        await settle(f, only(/^\/patients\/\d+\/timeline$/, { items: [F.timelineItem(), F.timelineItem({ id: 2, summaryFr: null, summary: 'Old English row' })], page: 0, size: 30, hasMore: false }));
      }
      const t = text(f);
      expect(t).toContain('Ajouter une note d\'évolution');
      expect(t).toContain('Suivi quotidien reçu pour le 2026-10-14');
      expect(Array.from((f.nativeElement as HTMLElement).querySelectorAll('[lang=en]')).some(e => e.textContent!.includes('Old English row'))).toBeTrue();
      expect(t).toContain(`2${NB}ko`);
      expect(t).toContain('Téléverser');
      expect(t).toContain('Consent aux rappels par courriel ou texto');
      expect(t).toContain('Personnes à joindre en cas d\'urgence');
    });
  });

  describe('questionnaires, rules and reports', () => {
    it('forms list uses the French title', async () => {
      const f = h.create('fr', QuestionnairesComponent);
      await settle(f);
      expect((f.nativeElement as HTMLElement).querySelector('tbody td a')!.textContent!.trim()).toBe('Suivi quotidien');
      expect(text(f)).not.toContain('Daily check-in');
    });

    it('alert rules use the French message', async () => {
      const f = h.create('fr', AlertRulesComponent);
      await settle(f);
      expect(text(f)).toContain('Règles d\'alerte');
      expect(text(f)).toContain(F.SEED_RULES[0].outcome.message.fr);
    });

    it('reports show French percentages and weeks', async () => {
      const f = h.create('fr', ReportsComponent, [WeekBarsComponent]);
      await settle(f);
      expect(text(f)).toContain(`75${NB}%`);
      expect(text(f)).toContain('Taux de réponse aux suivis quotidiens');
      expect(text(f)).toContain('Exporter en CSV');
    });
  });

  describe('settings', () => {
    it('staff directory: role badges in French', async () => {
      const f = h.create('fr', StaffDirectoryComponent);
      await settle(f, only(/^\/staff$/, [F.staffMember({ accessRole: 'ADMIN' }), F.staffMember({ id: 2, displayName: 'Sam', accessRole: 'RECEPTION' })]));
      const badges = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.role-badge')).map(b => b.getAttribute('aria-label'));
      expect(badges).toContain(`Rôle d'accès${NB}: Administration`);
      expect(badges).toContain(`Rôle d'accès${NB}: Accueil`);
    });

    it('notification settings and retention', async () => {
      const n = h.create('fr', NotificationSettingsComponent);
      await settle(n);
      expect(text(n)).toContain('Les patients reçoivent des messages seulement si leur consentement est consigné comme accordé.');
      expect(text(n)).toContain(`jamais entre 21${NB}h et 8${NB}h`);
      expect(text(n)).toContain('Journalisation seulement');
    });

    it('retention: banner, field labels and run lines', async () => {
      const r = h.create('fr', RetentionSettingsComponent);
      await settle(r);
      expect(text(r)).toContain('responsable de la protection des renseignements personnels');
      expect(text(r)).toContain('Conserver indéfiniment');
      expect(text(r)).toContain('Exécutions récentes');
    });

    it('access log: French action labels', async () => {
      const f = h.create('fr', AccessLogComponent);
      await settle(f);
      expect(text(f)).toContain('Dossier consulté');
      expect(text(f)).toContain('NAM affiché');
    });
  });
});
