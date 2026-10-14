import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StaffAuth } from '../../auth/staff-auth';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authMock: any;

  function setup(authenticated: boolean) {
    authMock = {
      isAuthenticated$: of(authenticated),
      login: jasmine.createSpy('login'),
      logout: jasmine.createSpy('logout')
    };
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      providers: [{ provide: StaffAuth, useValue: authMock }]
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    setup(false);
    expect(component).toBeTruthy();
  });

  it('should call login("/dashboard") when "Log in" is clicked', () => {
    setup(false);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('#login-button');
    expect(button.textContent).toContain('Log in');
    button.click();
    expect(authMock.login).toHaveBeenCalledWith('/dashboard');
  });

  it('should show a logout button and call logout when authenticated', () => {
    setup(true);
    expect(fixture.nativeElement.querySelector('#login-button')).toBeNull();
    fixture.nativeElement.querySelector('#logout-button').click();
    expect(authMock.logout).toHaveBeenCalled();
  });
});
