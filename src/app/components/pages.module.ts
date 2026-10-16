import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from '../auth/permission.guard';
import { PAGES_EN } from '../i18n/dict/pages.en';
import { PAGES_FR } from '../i18n/dict/pages.fr';
import { I18nService } from '../i18n/i18n.service';
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
  { path: 'messages', component: MessagesComponent, canActivate: [permissionGuard], data: { title: 'page.messages', permission: 'CLINICAL_READ' } },
  { path: 'messages/:patientId', component: MessagesComponent, canActivate: [permissionGuard], data: { title: 'page.messages', permission: 'CLINICAL_READ', parent: { label: 'page.messages', link: '/messages' } } },
  { path: 'reports', component: ReportsComponent, canActivate: [permissionGuard], data: { title: 'page.reports', permission: 'REPORTS_READ' } },
  { path: 'settings', component: SettingsComponent, canActivate: [permissionGuard], data: { title: 'page.settings', permission: 'SETTINGS_MANAGE' } }
];

/** Messages, Reports and Settings: lazy-loaded so the initial bundle stays small. */
@NgModule({
  declarations: [MessagesComponent, ReportsComponent, SettingsComponent, StaffDirectoryComponent, AlertRulesComponent, WeekBarsComponent,
    NotificationSettingsComponent, RetentionSettingsComponent, AccessLogComponent],
  imports: [SharedModule, MenusModule, MessagingModule, ActorSelectComponent, RouterModule.forChild(PAGE_ROUTES)]
})
export class PagesModule {
  constructor(i18n: I18nService) {
    i18n.register('pages', { en: PAGES_EN, fr: PAGES_FR });
  }
}
