import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AlertTableComponent } from '../components/alert-table/alert-table.component';
import { FollowUpFormComponent } from '../components/follow-up-form/follow-up-form.component';
import { QuestionnaireFormComponent } from '../fhir/questionnaire-form/questionnaire-form.component';
import { AccessLinkComponent } from './access-link/access-link.component';
import { AppointmentBadgeComponent } from './appointment-badge/appointment-badge.component';
import { AvatarComponent } from './avatar/avatar.component';
import { IconComponent } from './icon/icon.component';
import { RingTileComponent } from './ring-tile/ring-tile.component';
import { StatusChipComponent } from './status-chip/status-chip.component';
import { TrendChartComponent } from './trend-chart/trend-chart.component';

const DECLARED = [
  IconComponent, StatusChipComponent, AvatarComponent, RingTileComponent, TrendChartComponent, AppointmentBadgeComponent,
  AccessLinkComponent, AlertTableComponent, FollowUpFormComponent, QuestionnaireFormComponent
];

/** Presentational building blocks shared by the eager app and the lazy feature modules. */
@NgModule({
  declarations: DECLARED,
  imports: [CommonModule, FormsModule, RouterModule],
  exports: [...DECLARED, CommonModule, FormsModule, RouterModule]
})
export class SharedModule {}
