import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { StaffAuth } from './auth/staff-auth';
import { I18nTestingModule } from './testing/i18n-testing.module';

describe('AppComponent', () => {
  const authFactory = jasmine.createSpy('authFactory').and.returnValue({});

  beforeEach(async () => {
    authFactory.calls.reset();
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), 
        RouterTestingModule
      ],
      declarations: [
        AppComponent
      ],
      providers: [{ provide: StaffAuth, useFactory: authFactory }]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should instantiate StaffAuth on creation', () => {
    TestBed.createComponent(AppComponent);
    expect(authFactory).toHaveBeenCalledTimes(1);
  });

  it(`should have as title 'fe-aftercare-web'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('fe-aftercare-web');
  });

  it('should render the router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
