import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { DashboardComponent } from './dashboard.component';
import { HeaderComponent } from '../header/header.component';
import { Patient } from '../../models/patient.model';
import { environment } from '../../../environments/environment';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/patients`;
  const jane: Patient = {
    id: 5,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    gender: 'female',
    address: { city: 'Springfield', state: 'IL', zip: '62701' }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule],
      declarations: [DashboardComponent, HeaderComponent]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function init(rows: Patient[] = []) {
    fixture.detectChanges(); // ngOnInit
    httpMock.expectOne(base).flush(rows);
    fixture.detectChanges();
  }

  it('should GET patients on init and render the rows', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([jane]);
    fixture.detectChanges();

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Jane Doe');
    expect(rows[0].textContent).toContain('Springfield');
  });

  it('should show "No patients yet." when the list is empty', () => {
    init([]);
    expect(fixture.nativeElement.textContent).toContain('No patients yet.');
  });

  it('should show an error, not "No patients yet.", when loading fails', () => {
    spyOn(console, 'error');
    fixture.detectChanges();
    httpMock.expectOne(base).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Could not load patients.');
    expect(text).not.toContain('No patients yet.');
  });

  it('should POST a new patient without id, reload the list and reset the form', () => {
    init([]);
    component.patient = {
      firstName: 'Ann',
      lastName: 'Lee',
      email: 'ann@example.com',
      phone: '555-0111',
      gender: 'female',
      address: { city: 'Austin', state: 'TX', zip: '73301' }
    };

    component.addPatient();
    expect(component.saving).toBeTrue();
    const post = httpMock.expectOne(`${base}/register`);
    expect(post.request.method).toBe('POST');
    expect('id' in post.request.body).toBeFalse();
    expect(post.request.body.firstName).toBe('Ann');
    post.flush({ ...post.request.body, id: 9 });

    expect(component.saving).toBeFalse();
    expect(component.patient.firstName).toBe('');
    expect('id' in component.patient).toBeFalse();
    httpMock.expectOne(base).flush([jane]);
    expect(component.patients.length).toBe(1);
  });

  it('should DELETE and reload when the user confirms', () => {
    init([jane]);
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    component.deletePatient(jane);

    expect(confirmSpy).toHaveBeenCalledWith('Delete Jane Doe?');
    const req = httpMock.expectOne(`${base}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.expectOne(base).flush([]);
  });

  it('should not send anything when the user cancels the delete', () => {
    init([jane]);
    spyOn(window, 'confirm').and.returnValue(false);

    component.deletePatient(jane);

    httpMock.expectNone(`${base}/5`);
  });
});
