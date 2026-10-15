import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { PageTitleService } from './page-title.service';

describe('PageTitleService', () => {
  it('publishes the title and sets the document title', () => {
    const svc = TestBed.inject(PageTitleService);
    const doc = TestBed.inject(Title);
    svc.set('Patients');
    expect(svc.title$.value).toBe('Patients');
    expect(doc.getTitle()).toBe('Patients · Aftercare');
    svc.setParent({ label: 'Patients', link: '/patients' });
    expect(svc.parent$.value).toEqual({ label: 'Patients', link: '/patients' });
  });
});
