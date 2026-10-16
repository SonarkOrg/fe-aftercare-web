import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { StaffAuth } from '../auth/staff-auth';
import { FhirQuestionnaireResponse } from '../fhir/fhir.model';
import { ActorSelectComponent } from '../shared/actor-select/actor-select.component';
import { MenusModule } from '../shared/menus.module';
import { MessagingModule } from '../shared/message-thread/messaging.module';
import { SendLinkComponent } from '../shared/send-link/send-link.component';
import { SharedModule } from '../shared/shared.module';
import * as F from './fixtures';
import { I18nTestingModule } from './i18n-testing.module';

/** Fixtures and a URL-routing HTTP responder shared by the pseudo-locale and the French page specs. */
export const INTAKE_RESPONSE: FhirQuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse', questionnaire: F.FULL_Q.url + '|1', status: 'completed',
  item: [{ linkId: 'PAIN', answer: [{ valueInteger: 6 }] }, { linkId: 'FEVER', answer: [{ valueBoolean: true }] }]
};
export const DEF = { id: 7, url: F.FULL_Q.url, version: '1', title: { fr: 'Suivi quotidien', en: 'Daily check-in' }, purpose: 'FOLLOW_UP_CHECKIN', specialty: 'VISCERAL_SURGERY',
  appointmentTypes: [], status: 'ACTIVE', loadedAt: '2026-10-14T00:00:00Z', questionnaire: F.FULL_Q, rules: F.SEED_RULES };
const PAGE = <T>(items: T[]) => ({ items, page: 0, size: 50, hasMore: false });
const METRICS = { from: '2026-10-14', to: '2026-10-14', total: 3, scheduled: 1, ready: 1, needsReview: 1, cancelled: 0, completed: 0, noShow: 0, questionnairesCompleted: 2, questionnaireMissing: 1, completionRate: 0.67 };
export const AUDIT = { id: 1, occurredAt: '2026-10-14T15:00:00Z', actorName: 'Dev Admin', actorSub: 'dev|admin-1', action: 'PATIENT_FILE_VIEWED', resourceType: 'PATIENT', resourceId: 5, patientId: 5, detail: null };

export function respond(url: string, method: string): unknown {
  const path = url.replace(/^https?:\/\/[^/]+\/api/, '').split('?')[0];
  if (method !== 'GET') {
    return {};
  }
  const routes: [RegExp, unknown][] = [
    [/^\/me$/, F.me('ADMIN')],
    [/^\/patients$/, [F.JANE, { ...F.JANE, id: 6, firstName: 'Luc', lastName: 'Roy', activeFollowUp: null }]],
    [/^\/patients\/\d+$/, F.JANE],
    [/^\/patients\/\d+\/medical$/, F.medical()],
    [/^\/patients\/\d+\/follow-ups$/, [F.followUp()]],
    [/^\/patients\/\d+\/check-ins$/, [F.checkInDto({ pain: 8, temp: 38.4 })]],
    [/^\/check-ins$/, [F.checkInDto({ pain: 8, temp: 38.4 })]],
    [/^\/patients\/\d+\/alerts$|^\/alerts$/, [F.alertDto(), F.missedAlert()]],
    [/^\/patients\/\d+\/appointments$|^\/appointments$/, [F.appointment(), F.appointment({ id: 5, status: 'NEEDS_REVIEW', flagCount: 2 }), F.appointment({ id: 6, questionnaireMissing: true })]],
    [/^\/appointments\/metrics$/, METRICS],
    [/^\/appointments\/\d+$/, F.appointmentDetail({
      status: 'NEEDS_REVIEW', flagCount: 1, intakeSubmittedAt: '2026-10-12T15:00:00Z',
      intake: { submittedAt: '2026-10-12T15:00:00Z', questionnaireDefinitionId: 7, questionnaireUrl: F.FULL_Q.url, questionnaireVersion: '1', response: INTAKE_RESPONSE,
        flags: [{ linkId: 'FEVER', label: 'Do you have a fever?', labelFr: 'Avez-vous de la fièvre?', message: 'Recent fever', messageFr: 'Fièvre récente' }] }
    })],
    [/^\/questionnaires$/, [DEF]],
    [/^\/questionnaires\/\d+$/, DEF],
    [/^\/settings\/clinic$/, F.CLINIC],
    [/^\/settings\/notifications$/, F.notificationSettings()],
    [/^\/settings\/retention$/, F.retentionSettings()],
    [/^\/retention\/runs$/, [F.retentionRun()]],
    [/^\/staff$/, [F.staffMember(), F.staffMember({ id: 2, displayName: 'Admin Test', accessRole: 'ADMIN', auth0Subject: 'dev|admin-1' })]],
    [/^\/reports\/summary$/, F.report()],
    [/^\/messages\/inbox$/, [F.conversation()]],
    [/^\/messages\/unread-count$/, { unreadMessages: 1, conversations: 1 }],
    [/^\/patients\/\d+\/messages$/, F.thread({ items: [F.message({ sender: 'STAFF', readByPatientAt: '2026-10-14T16:00:00Z' })] })],
    [/^\/audit$|^\/patients\/\d+\/audit$/, PAGE([AUDIT])],
    [/^\/patients\/\d+\/notifications$/, PAGE([F.notification({ lastError: 'NO_CONSENT', status: 'SKIPPED' })])],
    [/^\/patients\/\d+\/contact-preferences$/, F.contactPrefs()],
    [/^\/patients\/\d+\/timeline$/, PAGE([F.timelineItem(), F.timelineItem({ id: 101, category: 'NOTE', kind: 'NOTE_ADDED', note: F.careNote(), summary: 'Note' })])],
    [/^\/patients\/\d+\/documents$/, [{ id: 3, patientId: 5, title: 'Résumé', category: 'DISCHARGE_SUMMARY', contentType: 'application/pdf', sizeBytes: 2048, originalFilename: 'a.pdf', sha256: 'x', uploadedAt: '2026-10-14T15:00:00Z', uploadedByName: 'Dev Nurse' }]],
    [/^\/patients\/\d+\/care-team$/, [F.careTeamMember()]],
    [/^\/patients\/\d+\/emergency-contacts$/, [F.contact()]]
  ];
  const hit = routes.find(([re]) => re.test(path));
  return hit ? hit[1] : [];
}

export const AUTH_STUB = {
  isAuthenticated$: of(true), userName$: of('Dev Admin'), subject$: of('dev|admin-1'), login: () => undefined, logout: () => undefined,
  getAccessToken: (): Observable<string> => of('t')
};


/** Creates a page component in a TestBed with every shared module, an ADMIN stub and the URL-routing responder. */
export class PageHarness {
  http!: HttpTestingController;

  create<T>(lang: 'fr' | 'en' | 'pseudo', type: Type<T>, declarations: Type<unknown>[] = [], standalone = false, route: Record<string, string> = {}, role: 'ADMIN' | 'NURSE' | 'PHYSICIAN' | 'RECEPTION' = 'ADMIN'): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(lang), HttpClientTestingModule, RouterTestingModule, FormsModule, SharedModule, MenusModule, MessagingModule, SendLinkComponent, ActorSelectComponent, ...(standalone ? [type] : [])],
      declarations: [...(standalone ? [] : [type]), ...declarations],
      providers: [F.providePermissions(role), { provide: StaffAuth, useValue: AUTH_STUB },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(route), queryParamMap: convertToParamMap({}) }, paramMap: of(convertToParamMap(route)), queryParamMap: of(convertToParamMap({})) } }]
    });
    this.http = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(type);
  }

  /** Answers every pending request from the fixtures, a few rounds, and renders. `override` can replace an answer by URL. */
  async settle(fixture: ComponentFixture<unknown>, override: (url: string) => unknown | undefined = () => undefined): Promise<void> {
    for (let i = 0; i < 6; i++) {
      for (const r of this.http.match(() => true)) {
        const own = r.request.method === 'GET' ? override(r.request.url) : undefined;
        r.flush((own ?? respond(r.request.url, r.request.method)) as never);
      }
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0)); // not whenStable(): the shell and the inbox keep polling timers
    }
  }
}
