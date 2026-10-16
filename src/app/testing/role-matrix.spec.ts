import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Permissions } from '../auth/permissions.service';
import { PatientDocumentsComponent } from '../components/patient-file/patient-documents/patient-documents.component';
import { PatientMedicalComponent } from '../components/patient-file/patient-medical/patient-medical.component';
import { PatientTimelineComponent } from '../components/patient-file/patient-timeline/patient-timeline.component';
import { AccessRole, Permission } from '../models/me.model';
import { JANE, careNote, me, medical, providePermissions, ROLE_PERMISSIONS } from './fixtures';
import { I18nTestingModule } from './i18n-testing.module';
import { SHARED_DECLARATIONS } from './shared-declarations';

/**
 * The role matrix of the Phase A spec (2.2), written out a second time on purpose: one column per role
 * [ADMIN, PHYSICIAN, NURSE, RECEPTION]. The UI must show exactly what the permissions allow, nothing more.
 */
const GRID: Record<Permission, [boolean, boolean, boolean, boolean]> = {
  PATIENT_READ: [true, true, true, true],
  PATIENT_WRITE: [true, true, true, true],
  PATIENT_DELETE: [true, false, false, false],
  CLINICAL_READ: [true, true, true, false],
  CLINICAL_WRITE: [true, true, true, false],
  HEALTH_NUMBER_REVEAL: [true, true, true, false],
  APPOINTMENT_READ: [true, true, true, true],
  APPOINTMENT_WRITE: [true, true, true, true],
  FORMS_READ: [true, true, true, true],
  REPORTS_READ: [true, true, true, false],
  AUDIT_READ: [true, false, false, false],
  STAFF_READ: [true, true, true, true],
  STAFF_MANAGE: [true, false, false, false],
  SETTINGS_READ: [true, true, true, true],
  SETTINGS_MANAGE: [true, false, false, false]
};
const ROLES: AccessRole[] = ['ADMIN', 'PHYSICIAN', 'NURSE', 'RECEPTION'];
const PERMISSIONS = Object.keys(GRID) as Permission[];

describe('role matrix', () => {
  describe('permissions per role (fixtures, service)', () => {
    ROLES.forEach((role, col) => {
      it(`${role} has exactly the permissions of its column, in table order`, () => {
        const expected = PERMISSIONS.filter(p => GRID[p][col]);
        expect(me(role).permissions).toEqual(expected);
        expect(ROLE_PERMISSIONS[role]).toEqual(expected);
        TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [providePermissions(role)] });
        const permissions = TestBed.inject(Permissions);
        for (const p of PERMISSIONS) {
          expect(permissions.can(p)).withContext(`${role} ${p}`).toBe(GRID[p][col]);
        }
        expect(permissions.role).toBe(role);
      });
    });
  });

  /** Renders a patient-file component and reports which of its buttons exist. */
  async function render<T>(type: Type<T>, role: AccessRole, setup: (c: T) => void = () => undefined, extra: Type<unknown>[] = []): Promise<{ el: HTMLElement; http: HttpTestingController; fixture: ComponentFixture<T> }> {
    await TestBed.configureTestingModule({
      providers: [providePermissions(role)],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [type, ...extra, ...SHARED_DECLARATIONS]
    }).compileComponents();
    const fixture = TestBed.createComponent(type);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.match(() => true).forEach(r => r.flush(r.request.url.includes('timeline') ? { items: [], page: 0, size: 30, hasMore: false } : []));
    fixture.detectChanges();
    return { el: fixture.nativeElement, http, fixture };
  }
  const present = (el: HTMLElement, sel: string) => el.querySelector(sel) !== null;

  describe('medical tab actions', () => {
    // [reveal RAMQ, edit date of birth, set/edit/remove RAMQ, add item, row menus]
    const EXPECTED: Record<AccessRole, [boolean, boolean, boolean, boolean, boolean]> = {
      ADMIN: [true, true, true, true, true],
      PHYSICIAN: [true, true, true, true, true],
      NURSE: [true, true, true, true, true],
      RECEPTION: [false, true, false, false, false]
    };
    for (const role of ROLES) {
      it(`${role}: reveal, DOB, RAMQ edit/remove, add item and item menus match the matrix`, async () => {
        const { el } = await render(PatientMedicalComponent, role, c => {
          c.patient = { ...JANE };
          c.medical = medical();
        });
        const [reveal, dob, hn, add, menus] = EXPECTED[role];
        expect(present(el, '.reveal-btn')).withContext('reveal').toBe(reveal);
        expect(present(el, '.edit-dob')).withContext('edit DOB').toBe(dob);
        expect(present(el, '.edit-hn') || present(el, '.remove-hn')).withContext('RAMQ edit/remove').toBe(hn);
        expect(present(el, '.add-item')).withContext('add item').toBe(add);
        expect(present(el, 'app-row-menu')).withContext('item menus').toBe(menus);
      });
    }
  });

  describe('write actions that need CLINICAL_WRITE', () => {
    for (const role of ROLES) {
      const can = GRID.CLINICAL_WRITE[ROLES.indexOf(role)];

      it(`${role}: note composer is ${can ? 'shown' : 'hidden'}`, async () => {
        const { el } = await render(PatientTimelineComponent, role, c => (c.patientId = 5));
        expect(present(el, '.composer-card')).toBe(can);
        expect(present(el, '.save-note')).toBe(can);
      });

      it(`${role}: document upload is ${can ? 'shown' : 'hidden'}`, async () => {
        const { el } = await render(PatientDocumentsComponent, role, c => (c.patientId = 5));
        expect(present(el, '.upload-btn')).toBe(can);
      });
    }
  });

  it('keeps every fixture in this file honest: careNote builds (used by other specs of the matrix)', () => {
    expect(careNote().editableByMe).toBeTrue();
  });
});
