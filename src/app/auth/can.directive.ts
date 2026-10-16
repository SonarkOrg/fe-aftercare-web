import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Permission } from '../models/me.model';
import { Permissions } from './permissions.service';

/** `*appCan="'CLINICAL_READ'"` or `*appCan="['CLINICAL_WRITE', 'APPOINTMENT_WRITE']"` (any of them). */
@Directive({ selector: '[appCan]' })
export class CanDirective implements OnInit, OnDestroy {
  private needed: Permission[] = [];
  private shown = false;
  private sub?: Subscription;

  @Input() set appCan(value: Permission | Permission[]) {
    this.needed = Array.isArray(value) ? value : [value];
    this.update();
  }

  constructor(private tpl: TemplateRef<unknown>, private vcr: ViewContainerRef, private permissions: Permissions) {}

  ngOnInit(): void {
    this.sub = this.permissions.me$.subscribe(() => this.update());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private update(): void {
    const allowed = this.permissions.canAny(...this.needed);
    if (allowed && !this.shown) {
      this.vcr.createEmbeddedView(this.tpl);
      this.shown = true;
    } else if (!allowed && this.shown) {
      this.vcr.clear();
      this.shown = false;
    }
  }
}
