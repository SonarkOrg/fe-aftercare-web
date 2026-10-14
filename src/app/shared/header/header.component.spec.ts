import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [HeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should link to the four staff sections and drop ADD PATIENT', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('nav a'));
    expect(links.map(a => a.textContent!.trim())).toEqual(['Patients', 'Appointments', 'Alerts', 'Forms']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/dashboard', '/appointments', '/alerts', '/questionnaires']);
    expect(fixture.nativeElement.textContent).not.toContain('ADD PATIENT');
  });

  it('should not show the dev banner in the default (production) environment', () => {
    expect(fixture.nativeElement.querySelector('.dev-banner')).toBeNull();
  });
});
