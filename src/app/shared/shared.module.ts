import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AlertTableComponent } from '../components/alert-table/alert-table.component';
import { FollowUpFormComponent } from '../components/follow-up-form/follow-up-form.component';
import { QuestionnaireFormComponent } from '../fhir/questionnaire-form/questionnaire-form.component';
import { CanDirective } from '../auth/can.directive';
import { I18nModule } from '../i18n/i18n.module';
import { LanguageSwitchComponent } from '../i18n/language-switch/language-switch.component';
import { AccessLinkComponent } from './access-link/access-link.component';
import { AppointmentBadgeComponent } from './appointment-badge/appointment-badge.component';
import { AvatarComponent } from './avatar/avatar.component';
import { IconComponent } from './icon/icon.component';
import { RingTileComponent } from './ring-tile/ring-tile.component';
import { RoleBadgeComponent } from './role-badge/role-badge.component';
import { StatusChipComponent } from './status-chip/status-chip.component';
import { TrendChartComponent } from './trend-chart/trend-chart.component';

const DECLARED = [
  IconComponent, StatusChipComponent, AvatarComponent, RingTileComponent, TrendChartComponent, AppointmentBadgeComponent,
  AccessLinkComponent, AlertTableComponent, FollowUpFormComponent, QuestionnaireFormComponent,
  CanDirective, RoleBadgeComponent, LanguageSwitchComponent
];

/** Presentational building blocks shared by the eager app and the lazy feature modules. */
@NgModule({
  declarations: DECLARED,
  imports: [CommonModule, FormsModule, RouterModule, I18nModule],
  exports: [...DECLARED, CommonModule, FormsModule, RouterModule, I18nModule]
})
export class SharedModule {}
