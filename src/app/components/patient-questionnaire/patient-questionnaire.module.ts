import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PatientMessagesComponent } from './patient-messages/patient-messages.component';
import { PatientQuestionnaireComponent } from './patient-questionnaire.component';

/** The public patient page (/q/:code): lazy-loaded so staff bundles do not carry it. */
@NgModule({
  declarations: [PatientQuestionnaireComponent, PatientMessagesComponent],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: PatientQuestionnaireComponent }])]
})
export class PatientQuestionnaireModule {}
