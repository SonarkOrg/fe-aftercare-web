import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SharedModule } from './shared/shared.module';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './shared/login/login.component';
import { staffAuthProviders } from './auth/staff-auth.providers';
import { StaffAuthInterceptor } from './auth/staff-auth.interceptor';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { ShellComponent } from './shell/shell.component';
import { FooterComponent } from './shared/footer/footer.component';
import { HomeComponent } from './components/home/home.component';
import { AlertsComponent } from './components/alerts/alerts.component';
import { AppointmentsComponent } from './components/appointments/appointments.component';
import { AppointmentDetailComponent } from './components/appointment-detail/appointment-detail.component';
import { AppointmentFormComponent } from './components/appointment-form/appointment-form.component';
import { QuestionnairesComponent } from './components/questionnaires/questionnaires.component';
import { QuestionnaireDetailComponent } from './components/questionnaire-detail/questionnaire-detail.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ShellComponent,
    DashboardComponent,
    PatientsComponent,
    FooterComponent,
    HomeComponent,
    AlertsComponent,
    AppointmentsComponent,
    AppointmentDetailComponent,
    AppointmentFormComponent,
    QuestionnairesComponent,
    QuestionnaireDetailComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    ...staffAuthProviders,
    { provide: HTTP_INTERCEPTORS, useClass: StaffAuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
