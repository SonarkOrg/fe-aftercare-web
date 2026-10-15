import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { staffAuthGuard } from './auth/staff-auth.guard';
import { AlertsComponent } from './components/alerts/alerts.component';
import { AppointmentDetailComponent } from './components/appointment-detail/appointment-detail.component';
import { AppointmentFormComponent } from './components/appointment-form/appointment-form.component';
import { AppointmentsComponent } from './components/appointments/appointments.component';
import { HomeComponent } from './components/home/home.component';
import { QuestionnaireDetailComponent } from './components/questionnaire-detail/questionnaire-detail.component';
import { QuestionnairesComponent } from './components/questionnaires/questionnaires.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { ShellComponent } from './shell/shell.component';
import { LoginComponent } from './shared/login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  // PUBLIC (lazy): patients never log in, no shell
  { path: 'q/:code', loadChildren: () => import('./components/patient-questionnaire/patient-questionnaire.module').then(m => m.PatientQuestionnaireModule) },
  {
    path: '', component: ShellComponent, canActivate: [staffAuthGuard], children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, data: { title: 'Dashboard' } },
      { path: 'patients', component: PatientsComponent, data: { title: 'Patients' } },
      // The patient file (medical, contacts, timeline, documents, messages, access log) is lazy-loaded.
      { path: 'patients/:id', loadChildren: () => import('./components/patient-file/patient-file.module').then(m => m.PatientFileModule) },
      { path: 'appointments', component: AppointmentsComponent, data: { title: 'Appointments' } },
      { path: 'appointments/new', component: AppointmentFormComponent, data: { title: 'New appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'appointments/:id', component: AppointmentDetailComponent, data: { title: 'Appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'appointments/:id/edit', component: AppointmentFormComponent, data: { title: 'Edit appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'alerts', component: AlertsComponent, data: { title: 'Alerts' } },
      { path: 'questionnaires', component: QuestionnairesComponent, data: { title: 'Forms' } },
      { path: 'questionnaires/:id', component: QuestionnaireDetailComponent, data: { title: 'Form', parent: { label: 'Forms', link: '/questionnaires' } } },
      // Messages, Reports and Settings (lazy). Last, so every eager route above matches first.
      { path: '', loadChildren: () => import('./components/pages.module').then(m => m.PagesModule) }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
