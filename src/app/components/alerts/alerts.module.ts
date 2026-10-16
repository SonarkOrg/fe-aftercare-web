import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { permissionGuard } from '../../auth/permission.guard';
import { SharedModule } from '../../shared/shared.module';
import { AlertsComponent } from './alerts.component';

/** The alerts page: lazy-loaded so the initial bundle stays under budget. */
@NgModule({
  declarations: [AlertsComponent],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: AlertsComponent, canActivate: [permissionGuard], data: { title: 'page.alerts', permission: 'CLINICAL_READ' } }])]
})
export class AlertsPageModule {}
