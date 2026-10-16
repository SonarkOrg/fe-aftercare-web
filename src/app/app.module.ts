import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SharedModule } from './shared/shared.module';
import { I18nService } from './i18n/i18n.service';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './shared/login/login.component';
import { staffAuthProviders } from './auth/staff-auth.providers';
import { ForbiddenInterceptor } from './auth/forbidden.interceptor';
import { StaffAuthInterceptor } from './auth/staff-auth.interceptor';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { ShellComponent } from './shell/shell.component';
import { FooterComponent } from './shared/footer/footer.component';
import { HomeComponent } from './components/home/home.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ShellComponent,
    DashboardComponent,
    PatientsComponent,
    FooterComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    { provide: APP_INITIALIZER, multi: true, useFactory: (i: I18nService) => () => i.boot(), deps: [I18nService] },
    ...staffAuthProviders,
    { provide: HTTP_INTERCEPTORS, useClass: StaffAuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ForbiddenInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
