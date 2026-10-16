import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from '../../auth/permission.guard';
import { SharedModule } from '../../shared/shared.module';
import { AppointmentFormComponent } from '../appointment-form/appointment-form.component';
import { AppointmentsComponent } from './appointments.component';

const ROUTES: Routes = [
  { path: '', component: AppointmentsComponent, canActivate: [permissionGuard], data: { title: 'page.appointments', permission: 'APPOINTMENT_READ' } },
  { path: 'new', component: AppointmentFormComponent, canActivate: [permissionGuard], data: { permission: 'APPOINTMENT_WRITE', title: 'page.newAppointment', parent: { label: 'page.appointments', link: '/appointments' } } },
  { path: ':id/edit', component: AppointmentFormComponent, canActivate: [permissionGuard], data: { permission: 'APPOINTMENT_WRITE', title: 'page.editAppointment', parent: { label: 'page.appointments', link: '/appointments' } } },
  { path: ':id', loadChildren: () => import('../appointment-detail/appointment-detail.module').then(m => m.AppointmentDetailModule) }
];

/** The appointment schedule and form: lazy-loaded so the initial bundle stays under budget. */
@NgModule({
  declarations: [AppointmentsComponent, AppointmentFormComponent],
  imports: [SharedModule, RouterModule.forChild(ROUTES)]
})
export class AppointmentsPagesModule {}
