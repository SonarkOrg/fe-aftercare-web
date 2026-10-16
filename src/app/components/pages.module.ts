import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from '../auth/permission.guard';
import { ActorSelectComponent } from '../shared/actor-select/actor-select.component';
import { MessagingModule } from '../shared/message-thread/messaging.module';
import { MenusModule } from '../shared/menus.module';
import { SharedModule } from '../shared/shared.module';
import { WeekBarsComponent } from '../shared/week-bars/week-bars.component';
import { MessagesComponent } from './messages/messages.component';
import { ReportsComponent } from './reports/reports.component';
import { AlertRulesComponent } from './settings/alert-rules/alert-rules.component';
import { SettingsComponent } from './settings/settings.component';
import { AccessLogComponent } from './settings/access-log/access-log.component';
import { NotificationSettingsComponent } from './settings/notification-settings/notification-settings.component';
import { RetentionSettingsComponent } from './settings/retention-settings/retention-settings.component';
import { StaffDirectoryComponent } from './settings/staff-directory/staff-directory.component';

export const PAGE_ROUTES: Routes = [
  { path: 'messages', component: MessagesComponent, canActivate: [permissionGuard], data: { title: 'Messages', permission: 'CLINICAL_READ' } },
  { path: 'messages/:patientId', component: MessagesComponent, canActivate: [permissionGuard], data: { title: 'Messages', permission: 'CLINICAL_READ', parent: { label: 'Messages', link: '/messages' } } },
  { path: 'reports', component: ReportsComponent, canActivate: [permissionGuard], data: { title: 'Reports', permission: 'REPORTS_READ' } },
  { path: 'settings', component: SettingsComponent, canActivate: [permissionGuard], data: { title: 'Settings', permission: 'SETTINGS_MANAGE' } }
];

/** Messages, Reports and Settings: lazy-loaded so the initial bundle stays small. */
@NgModule({
  declarations: [MessagesComponent, ReportsComponent, SettingsComponent, StaffDirectoryComponent, AlertRulesComponent, WeekBarsComponent,
    NotificationSettingsComponent, RetentionSettingsComponent, AccessLogComponent],
  imports: [SharedModule, MenusModule, MessagingModule, ActorSelectComponent, RouterModule.forChild(PAGE_ROUTES)]
})
export class PagesModule {}
