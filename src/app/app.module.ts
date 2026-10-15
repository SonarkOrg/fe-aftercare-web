import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './shared/login/login.component';
import { staffAuthProviders } from './auth/staff-auth.providers';
import { StaffAuthInterceptor } from './auth/staff-auth.interceptor';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { ShellComponent } from './shell/shell.component';
import { StatusChipComponent } from './shared/status-chip/status-chip.component';
import { IconComponent } from './shared/icon/icon.component';
import { AvatarComponent } from './shared/avatar/avatar.component';
import { RingTileComponent } from './shared/ring-tile/ring-tile.component';
import { TrendChartComponent } from './shared/trend-chart/trend-chart.component';
import { FooterComponent } from './shared/footer/footer.component';
import { HomeComponent } from './components/home/home.component';
import { QuestionnaireFormComponent } from './fhir/questionnaire-form/questionnaire-form.component';
import { AccessLinkComponent } from './shared/access-link/access-link.component';
import { AppointmentBadgeComponent } from './shared/appointment-badge/appointment-badge.component';
import { PatientDetailComponent } from './components/patient-detail/patient-detail.component';
import { FollowUpFormComponent } from './components/follow-up-form/follow-up-form.component';
import { AlertTableComponent } from './components/alert-table/alert-table.component';
import { AlertsComponent } from './components/alerts/alerts.component';
import { AppointmentsComponent } from './components/appointments/appointments.component';
import { AppointmentDetailComponent } from './components/appointment-detail/appointment-detail.component';
import { AppointmentFormComponent } from './components/appointment-form/appointment-form.component';
import { QuestionnairesComponent } from './components/questionnaires/questionnaires.component';
import { QuestionnaireDetailComponent } from './components/questionnaire-detail/questionnaire-detail.component';
import { PatientQuestionnaireComponent } from './components/patient-questionnaire/patient-questionnaire.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ShellComponent,
    DashboardComponent,
    PatientsComponent,
    StatusChipComponent,
    IconComponent,
    TrendChartComponent,
    AvatarComponent,
    RingTileComponent,
    FooterComponent,
    HomeComponent,
    QuestionnaireFormComponent,
    AccessLinkComponent,
    AppointmentBadgeComponent,
    PatientDetailComponent,
    FollowUpFormComponent,
    AlertTableComponent,
    AlertsComponent,
    AppointmentsComponent,
    AppointmentDetailComponent,
    AppointmentFormComponent,
    QuestionnairesComponent,
    QuestionnaireDetailComponent,
    PatientQuestionnaireComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [
    ...staffAuthProviders,
    { provide: HTTP_INTERCEPTORS, useClass: StaffAuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
