import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PATIENT_FILE_EN } from '../../i18n/dict/patient-file.en';
import { PATIENT_FILE_FR } from '../../i18n/dict/patient-file.fr';
import { I18nService } from '../../i18n/i18n.service';
import { SendLinkComponent } from '../../shared/send-link/send-link.component';
import { ActorSelectComponent } from '../../shared/actor-select/actor-select.component';
import { MessagingModule } from '../../shared/message-thread/messaging.module';
import { MenusModule } from '../../shared/menus.module';
import { SharedModule } from '../../shared/shared.module';
import { PatientDetailComponent } from '../patient-detail/patient-detail.component';
import { PatientAuditComponent } from './patient-audit/patient-audit.component';
import { PatientContactsComponent } from './patient-contacts/patient-contacts.component';
import { PatientNotificationsComponent } from './patient-notifications/patient-notifications.component';
import { PatientDocumentsComponent } from './patient-documents/patient-documents.component';
import { PatientMedicalComponent } from './patient-medical/patient-medical.component';
import { PatientTimelineComponent } from './patient-timeline/patient-timeline.component';

/** The patient file: lazy-loaded so the initial bundle stays small. */
@NgModule({
  declarations: [PatientDetailComponent, PatientMedicalComponent, PatientContactsComponent, PatientTimelineComponent, PatientDocumentsComponent, PatientAuditComponent, PatientNotificationsComponent],
  imports: [
    SharedModule, MenusModule, MessagingModule, SendLinkComponent, ActorSelectComponent,
    RouterModule.forChild([{ path: '', component: PatientDetailComponent, data: { title: 'page.patient', parent: { label: 'page.patients', link: '/patients' } } }])
  ]
})
export class PatientFileModule {
  constructor(i18n: I18nService) {
    i18n.register('patientFile', { en: PATIENT_FILE_EN, fr: PATIENT_FILE_FR });
  }
}
