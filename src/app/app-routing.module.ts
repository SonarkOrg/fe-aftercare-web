import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { meGuard, permissionGuard } from './auth/permission.guard';
import { staffAuthGuard } from './auth/staff-auth.guard';
import { HomeComponent } from './components/home/home.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { ShellComponent } from './shell/shell.component';
import { LoginComponent } from './shared/login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  // Outside the shell: a login with no active staff member behind it
  { path: 'not-staff', loadComponent: () => import('./shared/not-staff/not-staff.component').then(m => m.NotStaffComponent), canActivate: [staffAuthGuard], data: { title: 'page.notLinked' } },
  // PUBLIC (lazy): patients never log in, no shell
  { path: 'q/:code', loadChildren: () => import('./components/patient-questionnaire/patient-questionnaire.module').then(m => m.PatientQuestionnaireModule) },
  {
    path: '', component: ShellComponent, canActivate: [staffAuthGuard, meGuard], children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, data: { title: 'page.dashboard' } },
      { path: 'patients', component: PatientsComponent, data: { title: 'page.patients' } },
      // The patient file (medical, contacts, timeline, documents, messages, access log) is lazy-loaded.
      { path: 'patients/:id', loadChildren: () => import('./components/patient-file/patient-file.module').then(m => m.PatientFileModule) },
      { path: 'forbidden', loadComponent: () => import('./shared/forbidden/forbidden.component').then(m => m.ForbiddenComponent), data: { title: 'page.noAccess' } },
      { path: 'appointments', loadChildren: () => import('./components/appointments/appointments-pages.module').then(m => m.AppointmentsPagesModule) },
      { path: 'alerts', loadChildren: () => import('./components/alerts/alerts.module').then(m => m.AlertsPageModule) },
      { path: 'questionnaires', loadChildren: () => import('./components/forms-pages.module').then(m => m.FormsPagesModule) },
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
