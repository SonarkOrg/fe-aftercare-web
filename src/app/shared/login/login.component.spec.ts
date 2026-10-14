import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authMock: any;

  function setup(authenticated: boolean) {
    authMock = {
      isAuthenticated$: of(authenticated),
      loginWithRedirect: jasmine.createSpy('loginWithRedirect'),
      logout: jasmine.createSpy('logout')
    };
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      providers: [{ provide: AuthService, useValue: authMock }]
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    setup(false);
    expect(component).toBeTruthy();
  });

  it('should call loginWithRedirect when "Log in" is clicked', () => {
    setup(false);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('#login-button');
    expect(button.textContent).toContain('Log in');
    button.click();
    expect(authMock.loginWithRedirect).toHaveBeenCalledWith({ appState: { target: '/dashboard' } });
  });

  it('should show a logout button and call logout when authenticated', () => {
    setup(true);
    expect(fixture.nativeElement.querySelector('#login-button')).toBeNull();
    fixture.nativeElement.querySelector('#logout-button').click();
    expect(authMock.logout).toHaveBeenCalled();
  });
});
