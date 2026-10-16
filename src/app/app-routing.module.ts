import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { meGuard, permissionGuard } from './auth/permission.guard';
import { staffAuthGuard } from './auth/staff-auth.guard';
import { AlertsComponent } from './components/alerts/alerts.component';
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
  // Outside the shell: a login with no active staff member behind it
  { path: 'not-staff', loadComponent: () => import('./shared/not-staff/not-staff.component').then(m => m.NotStaffComponent), canActivate: [staffAuthGuard], data: { title: 'Not linked' } },
  // PUBLIC (lazy): patients never log in, no shell
  { path: 'q/:code', loadChildren: () => import('./components/patient-questionnaire/patient-questionnaire.module').then(m => m.PatientQuestionnaireModule) },
  {
    path: '', component: ShellComponent, canActivate: [staffAuthGuard, meGuard], children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, data: { title: 'Dashboard' } },
      { path: 'patients', component: PatientsComponent, data: { title: 'Patients' } },
      // The patient file (medical, contacts, timeline, documents, messages, access log) is lazy-loaded.
      { path: 'patients/:id', loadChildren: () => import('./components/patient-file/patient-file.module').then(m => m.PatientFileModule) },
      { path: 'forbidden', loadComponent: () => import('./shared/forbidden/forbidden.component').then(m => m.ForbiddenComponent), data: { title: 'No access' } },
      { path: 'appointments', component: AppointmentsComponent, canActivate: [permissionGuard], data: { title: 'Appointments', permission: 'APPOINTMENT_READ' } },
      { path: 'appointments/new', component: AppointmentFormComponent, canActivate: [permissionGuard], data: { permission: 'APPOINTMENT_WRITE', title: 'New appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'appointments/:id/edit', component: AppointmentFormComponent, canActivate: [permissionGuard], data: { permission: 'APPOINTMENT_WRITE', title: 'Edit appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'appointments/:id', loadChildren: () => import('./components/appointment-detail/appointment-detail.module').then(m => m.AppointmentDetailModule) },
      { path: 'alerts', component: AlertsComponent, canActivate: [permissionGuard], data: { title: 'Alerts', permission: 'CLINICAL_READ' } },
      { path: 'questionnaires', component: QuestionnairesComponent, canActivate: [permissionGuard], data: { title: 'Forms', permission: 'FORMS_READ' } },
      { path: 'questionnaires/:id', component: QuestionnaireDetailComponent, canActivate: [permissionGuard], data: { permission: 'FORMS_READ', title: 'Form', parent: { label: 'Forms', link: '/questionnaires' } } },
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
