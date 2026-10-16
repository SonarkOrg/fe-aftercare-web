import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from '../auth/permission.guard';
import { SharedModule } from '../shared/shared.module';
import { QuestionnaireDetailComponent } from './questionnaire-detail/questionnaire-detail.component';
import { QuestionnairesComponent } from './questionnaires/questionnaires.component';

const ROUTES: Routes = [
  { path: '', component: QuestionnairesComponent, canActivate: [permissionGuard], data: { title: 'page.forms', permission: 'FORMS_READ' } },
  { path: ':id', component: QuestionnaireDetailComponent, canActivate: [permissionGuard], data: { permission: 'FORMS_READ', title: 'page.form', parent: { label: 'page.forms', link: '/questionnaires' } } }
];

/** The forms list and detail: lazy-loaded so the initial bundle stays under budget. */
@NgModule({
  declarations: [QuestionnairesComponent, QuestionnaireDetailComponent],
  imports: [SharedModule, RouterModule.forChild(ROUTES)]
})
export class FormsPagesModule {}
