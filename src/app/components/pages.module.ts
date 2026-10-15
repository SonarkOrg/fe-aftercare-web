import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MessagingModule } from '../shared/message-thread/messaging.module';
import { MenusModule } from '../shared/menus.module';
import { SharedModule } from '../shared/shared.module';
import { WeekBarsComponent } from '../shared/week-bars/week-bars.component';
import { MessagesComponent } from './messages/messages.component';
import { ReportsComponent } from './reports/reports.component';
import { AlertRulesComponent } from './settings/alert-rules/alert-rules.component';
import { SettingsComponent } from './settings/settings.component';
import { StaffDirectoryComponent } from './settings/staff-directory/staff-directory.component';

export const PAGE_ROUTES: Routes = [
  { path: 'messages', component: MessagesComponent, data: { title: 'Messages' } },
  { path: 'messages/:patientId', component: MessagesComponent, data: { title: 'Messages', parent: { label: 'Messages', link: '/messages' } } },
  { path: 'reports', component: ReportsComponent, data: { title: 'Reports' } },
  { path: 'settings', component: SettingsComponent, data: { title: 'Settings' } }
];

/** Messages, Reports and Settings: lazy-loaded so the initial bundle stays small. */
@NgModule({
  declarations: [MessagesComponent, ReportsComponent, SettingsComponent, StaffDirectoryComponent, AlertRulesComponent, WeekBarsComponent],
  imports: [SharedModule, MenusModule, MessagingModule, RouterModule.forChild(PAGE_ROUTES)]
})
export class PagesModule {}
