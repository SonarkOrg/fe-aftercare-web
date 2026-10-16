import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { permissionGuard } from '../../auth/permission.guard';
import { SendLinkComponent } from '../../shared/send-link/send-link.component';
import { SharedModule } from '../../shared/shared.module';
import { AppointmentDetailComponent } from './appointment-detail.component';

/** One appointment (with its "Send link" action): lazy-loaded so the initial bundle stays small. */
@NgModule({
  declarations: [AppointmentDetailComponent],
  imports: [
    SharedModule, SendLinkComponent,
    RouterModule.forChild([{
      path: '', component: AppointmentDetailComponent, canActivate: [permissionGuard],
      data: { permission: 'APPOINTMENT_READ', title: 'Appointment', parent: { label: 'Appointments', link: '/appointments' } }
    }])
  ]
})
export class AppointmentDetailModule {}
