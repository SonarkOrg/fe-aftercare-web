import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { I18nTestingModule } from '../testing/i18n-testing.module';
import { PageTitleService } from './page-title.service';

describe('PageTitleService', () => {
  it('publishes the title and sets the document title', () => {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang()] });
    const svc = TestBed.inject(PageTitleService);
    const doc = TestBed.inject(Title);
    svc.set('page.patients');
    expect(svc.title$.value).toBe('Patients');
    expect(doc.getTitle()).toBe('Patients · Aftercare');
    svc.setParent({ label: 'page.patients', link: '/patients' });
    expect(svc.parent$.value).toEqual({ label: 'page.patients', link: '/patients' });
  });

  it('translates the title key, in French too', () => {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang('fr')] });
    const svc = TestBed.inject(PageTitleService);
    svc.set('page.dashboard');
    expect(TestBed.inject(Title).getTitle()).toBe('Tableau de bord · Aftercare');
    svc.setText('Jane Doe');
    expect(TestBed.inject(Title).getTitle()).toBe('Jane Doe · Aftercare');
  });
});
