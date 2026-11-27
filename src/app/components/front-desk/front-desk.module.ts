import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from '../../auth/permission.guard';
import { FRONT_DESK_EN } from '../../i18n/dict/front-desk.en';
import { FRONT_DESK_FR } from '../../i18n/dict/front-desk.fr';
import { I18nService } from '../../i18n/i18n.service';
import { MenusModule } from '../../shared/menus.module';
import { SendLinkComponent } from '../../shared/send-link/send-link.component';
import { SharedModule } from '../../shared/shared.module';
import { ArrivalBoxComponent } from './arrival-box/arrival-box.component';
import { ArrivalRowComponent } from './arrival-row/arrival-row.component';
import { ArrivalsComponent } from './arrivals/arrivals.component';
import { CardBannerComponent } from './card-banner/card-banner.component';
import { FdDrawerDirective } from './fd-drawer.directive';
import { FixPanelComponent } from './fix-panel/fix-panel.component';
import { QuickPatientComponent } from './quick-patient/quick-patient.component';
import { ResultPanelComponent } from './result-panel/result-panel.component';
import { ScanGuardDirective } from './scan-guard.directive';
import { UndoToastComponent } from './undo-toast/undo-toast.component';
import { WalkInComponent } from './walk-in/walk-in.component';

const ROUTES: Routes = [
  { path: '', component: ArrivalsComponent, canActivate: [permissionGuard], data: { title: 'page.arrivals', permission: 'APPOINTMENT_READ', parent: { label: 'page.appointments', link: '/appointments' } } }
];

/** The front-desk Arrivals screen (`/appointments/arrivals`): lazy-loaded, with its own dictionary scope. */
@NgModule({
  declarations: [
    ArrivalsComponent, ArrivalBoxComponent, ArrivalRowComponent, FixPanelComponent, UndoToastComponent, QuickPatientComponent, WalkInComponent,
    ResultPanelComponent, CardBannerComponent, ScanGuardDirective, FdDrawerDirective
  ],
  imports: [SharedModule, MenusModule, SendLinkComponent, RouterModule.forChild(ROUTES)]
})
export class FrontDeskModule {
  constructor(i18n: I18nService) {
    i18n.register('frontDesk', { en: FRONT_DESK_EN, fr: FRONT_DESK_FR });
  }
}
