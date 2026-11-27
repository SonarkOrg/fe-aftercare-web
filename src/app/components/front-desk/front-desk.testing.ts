import { Type } from '@angular/core';
import { ArrivalBoxComponent } from './arrival-box/arrival-box.component';
import { ArrivalRowComponent } from './arrival-row/arrival-row.component';
import { CardBannerComponent } from './card-banner/card-banner.component';
import { FdDrawerDirective } from './fd-drawer.directive';
import { FixPanelComponent } from './fix-panel/fix-panel.component';
import { QuickPatientComponent } from './quick-patient/quick-patient.component';
import { ResultPanelComponent } from './result-panel/result-panel.component';
import { ScanGuardDirective } from './scan-guard.directive';
import { UndoToastComponent } from './undo-toast/undo-toast.component';
import { WalkInComponent } from './walk-in/walk-in.component';

/** Everything the Arrivals page declares besides itself, for specs that build it outside its lazy module. */
export const FRONT_DESK_DECLARATIONS: Type<unknown>[] = [
  ArrivalBoxComponent, ArrivalRowComponent, FixPanelComponent, UndoToastComponent, QuickPatientComponent, WalkInComponent,
  ResultPanelComponent, CardBannerComponent, ScanGuardDirective, FdDrawerDirective
];
