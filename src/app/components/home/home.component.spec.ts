import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { FooterComponent } from '../../shared/footer/footer.component';

import { HomeComponent } from './home.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), RouterTestingModule],
      declarations: [HomeComponent, FooterComponent, ...SHARED_DECLARATIONS]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sets the page title', () => {
    expect(TestBed.inject(Title).getTitle()).toBe('Home · Aftercare');
  });
});
