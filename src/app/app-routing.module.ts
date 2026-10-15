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
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { ShellComponent } from './shell/shell.component';
import { LoginComponent } from './shared/login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'q/:code', component: PatientQuestionnaireComponent }, // PUBLIC: patients never log in, no shell
  {
    path: '', component: ShellComponent, canActivate: [staffAuthGuard], children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, data: { title: 'Dashboard' } },
      { path: 'patients', component: PatientsComponent, data: { title: 'Patients' } },
      { path: 'patients/:id', component: PatientDetailComponent, data: { title: 'Patient', parent: { label: 'Patients', link: '/patients' } } },
      { path: 'appointments', component: AppointmentsComponent, data: { title: 'Appointments' } },
      { path: 'appointments/new', component: AppointmentFormComponent, data: { title: 'New appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'appointments/:id', component: AppointmentDetailComponent, data: { title: 'Appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'appointments/:id/edit', component: AppointmentFormComponent, data: { title: 'Edit appointment', parent: { label: 'Appointments', link: '/appointments' } } },
      { path: 'alerts', component: AlertsComponent, data: { title: 'Alerts' } },
      { path: 'questionnaires', component: QuestionnairesComponent, data: { title: 'Forms' } },
      { path: 'questionnaires/:id', component: QuestionnaireDetailComponent, data: { title: 'Form', parent: { label: 'Forms', link: '/questionnaires' } } }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
