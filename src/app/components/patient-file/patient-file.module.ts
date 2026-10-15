import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MessagingModule } from '../../shared/message-thread/messaging.module';
import { MenusModule } from '../../shared/menus.module';
import { SharedModule } from '../../shared/shared.module';
import { PatientDetailComponent } from '../patient-detail/patient-detail.component';
import { PatientAuditComponent } from './patient-audit/patient-audit.component';
import { PatientContactsComponent } from './patient-contacts/patient-contacts.component';
import { PatientDocumentsComponent } from './patient-documents/patient-documents.component';
import { PatientMedicalComponent } from './patient-medical/patient-medical.component';
import { PatientTimelineComponent } from './patient-timeline/patient-timeline.component';

/** The patient file: lazy-loaded so the initial bundle stays small. */
@NgModule({
  declarations: [PatientDetailComponent, PatientMedicalComponent, PatientContactsComponent, PatientTimelineComponent, PatientDocumentsComponent, PatientAuditComponent],
  imports: [
    SharedModule, MenusModule, MessagingModule,
    RouterModule.forChild([{ path: '', component: PatientDetailComponent, data: { title: 'Patient', parent: { label: 'Patients', link: '/patients' } } }])
  ]
})
export class PatientFileModule {}
