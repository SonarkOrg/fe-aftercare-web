import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { staffAuthGuard } from './auth/staff-auth.guard';
import { AlertsComponent } from './components/alerts/alerts.component';
import { AppointmentDetailComponent } from './components/appointment-detail/appointment-detail.component';
import { AppointmentFormComponent } from './components/appointment-form/appointment-form.component';
import { AppointmentsComponent } from './components/appointments/appointments.component';
import { HomeComponent } from './components/home/home.component';
import { PatientDetailComponent } from './components/patient-detail/patient-detail.component';
import { PatientQuestionnaireComponent } from './components/patient-questionnaire/patient-questionnaire.component';
import { QuestionnaireDetailComponent } from './components/questionnaire-detail/questionnaire-detail.component';
import { QuestionnairesComponent } from './components/questionnaires/questionnaires.component';
import { DashboardComponent } from './shared/dashboard/dashboard.component';
import { LoginComponent } from './shared/login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'q/:code', component: PatientQuestionnaireComponent }, // PUBLIC: patients never log in
  { path: 'dashboard', component: DashboardComponent, canActivate: [staffAuthGuard] },
  { path: 'patients/:id', component: PatientDetailComponent, canActivate: [staffAuthGuard] },
  { path: 'alerts', component: AlertsComponent, canActivate: [staffAuthGuard] },
  { path: 'appointments', component: AppointmentsComponent, canActivate: [staffAuthGuard] },
  { path: 'appointments/new', component: AppointmentFormComponent, canActivate: [staffAuthGuard] },
  { path: 'appointments/:id', component: AppointmentDetailComponent, canActivate: [staffAuthGuard] },
  { path: 'appointments/:id/edit', component: AppointmentFormComponent, canActivate: [staffAuthGuard] },
  { path: 'questionnaires', component: QuestionnairesComponent, canActivate: [staffAuthGuard] },
  { path: 'questionnaires/:id', component: QuestionnaireDetailComponent, canActivate: [staffAuthGuard] },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
