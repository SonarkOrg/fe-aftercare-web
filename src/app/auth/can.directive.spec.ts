import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Permission } from '../models/me.model';
import { me } from '../testing/fixtures';
import { CanDirective } from './can.directive';
import { Permissions } from './permissions.service';
import { I18nTestingModule } from '../testing/i18n-testing.module';

@Component({
  template: `<p id="one" *appCan="'CLINICAL_READ'">clinical</p><p id="any" *appCan="['CLINICAL_WRITE', 'APPOINTMENT_WRITE']">any</p><p id="dyn" *appCan="needed">dyn</p>`
})
class HostComponent {
  needed: Permission | Permission[] = 'SETTINGS_MANAGE';
}

describe('*appCan', () => {
  let fixture: ComponentFixture<HostComponent>;
  let permissions: Permissions;
  const has = (id: string) => !!fixture.nativeElement.querySelector('#' + id);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang(), HttpClientTestingModule], declarations: [HostComponent, CanDirective] });
    permissions = TestBed.inject(Permissions);
    fixture = TestBed.createComponent(HostComponent);
  });

  it('renders nothing while the member is unknown', () => {
    fixture.detectChanges();
    expect([has('one'), has('any'), has('dyn')]).toEqual([false, false, false]);
  });

  it('takes a single permission or a list (any of them)', () => {
    permissions.seed(me('RECEPTION'));
    fixture.detectChanges();
    expect(has('one')).toBeFalse(); // reception has no CLINICAL_READ
    expect(has('any')).toBeTrue(); // but APPOINTMENT_WRITE
    expect(has('dyn')).toBeFalse();
  });

  it('shows and removes the content as the member changes', () => {
    permissions.seed(me('NURSE'));
    fixture.detectChanges();
    expect([has('one'), has('any'), has('dyn')]).toEqual([true, true, false]);

    permissions.seed(me('ADMIN'));
    fixture.detectChanges();
    expect([has('one'), has('any'), has('dyn')]).toEqual([true, true, true]);

    permissions.reset();
    fixture.detectChanges();
    expect([has('one'), has('any'), has('dyn')]).toEqual([false, false, false]);
  });

  it('follows a changing input', () => {
    permissions.seed(me('NURSE'));
    fixture.detectChanges();
    expect(has('dyn')).toBeFalse();
    fixture.componentInstance.needed = ['PATIENT_READ'];
    fixture.detectChanges();
    expect(has('dyn')).toBeTrue();
    fixture.componentInstance.needed = 'AUDIT_READ';
    fixture.detectChanges();
    expect(has('dyn')).toBeFalse();
  });

  it('does not duplicate the view on repeated emissions', () => {
    permissions.seed(me('NURSE'));
    fixture.detectChanges();
    permissions.seed(me('NURSE', { displayName: 'Renamed' }));
    permissions.seed(me('NURSE'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('#one').length).toBe(1);
  });
});
